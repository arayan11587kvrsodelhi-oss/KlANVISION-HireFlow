"""Server-side session management via rotating refresh tokens.

Flow
----
1. Login issues an **access token** (returned in the JSON body) and a refresh
   token (set as an HttpOnly cookie). The refresh token's SHA-256 digest is the
   only thing stored.
2. ``POST /auth/refresh`` looks the digest up, checks it is unconsumed,
   unrevoked and unexpired, then *rotates*: the current row is marked consumed
   and a replacement row is issued in the same family.
3. If a **consumed** token is presented, the whole family is revoked. That is
   the standard replay-detection rule: a stolen cookie that is used after the
   legitimate client rotated it kills the session for both parties instead of
   silently granting the attacker a parallel session.
4. Logout revokes the token (and its family). Because the access token is a
   short-lived JWT, it also carries the session id in ``sid``; logout marks the
   session revoked so a still-valid access token presented afterwards is
   refused by :func:`assert_session_active`.

This makes "logout" and "expiry" real server-side facts, not a localStorage
deletion.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import RefreshToken
from app.services import auth as auth_service
from app.security.errors import AuthError

settings = get_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def issue_refresh_token(
    db: Session,
    *,
    user_id: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
    family_id: Optional[str] = None,
    previous_token_id: Optional[str] = None,
) -> tuple[str, RefreshToken]:
    """Create and persist a refresh token. Returns the raw value and the row."""
    raw = auth_service.generate_refresh_token()
    row = RefreshToken(
        user_id=user_id,
        token_hash=auth_service.hash_refresh_token(raw),
        family_id=family_id or auth_service.generate_refresh_token()[:36],
        previous_token_id=previous_token_id,
        user_agent=(user_agent or "")[:255] or None,
        ip_address=(ip_address or "")[:64] or None,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(row)
    db.flush()
    return raw, row


def revoke_family(db: Session, family_id: str) -> None:
    """Revoke every token in a session family (used on replay and logout)."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def family_id_for_raw(db: Session, raw_token: str) -> Optional[str]:
    """Return the session family owning ``raw_token``, or None if unknown.

    Read-only lookup used by logout to learn which family the cookie refers to
    without performing the revocation itself.
    """
    if not raw_token:
        return None
    digest = auth_service.hash_refresh_token(raw_token)
    return db.execute(
        select(RefreshToken.family_id).where(RefreshToken.token_hash == digest)
    ).scalar_one_or_none()


def session_family_belongs_to(db: Session, family_id: str, user_id: str) -> bool:
    """True when ``family_id`` is a session belonging to ``user_id``.

    Guards logout against an access token that names a family it does not own:
    the ``sid`` claim is attacker-influenced in the sense that any signed token
    carries one, so ownership is re-proved from the database rather than assumed.
    """
    return (
        db.execute(
            select(RefreshToken.id)
            .where(
                RefreshToken.family_id == family_id,
                RefreshToken.user_id == user_id,
            )
            .limit(1)
        ).scalar_one_or_none()
        is not None
    )


def revoke_token_by_raw(db: Session, raw_token: str) -> None:
    """Revoke the session that owns ``raw_token``, if any. Idempotent."""
    if not raw_token:
        return
    digest = auth_service.hash_refresh_token(raw_token)
    row = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    ).scalar_one_or_none()
    if row is not None:
        revoke_family(db, row.family_id)
        if row.revoked_at is None:
            row.revoked_at = _now()


def rotate_refresh_token(
    db: Session,
    raw_token: str,
    *,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> tuple[str, RefreshToken]:
    """Validate + rotate a refresh token.

    Raises ``AuthError`` if the token is unknown, expired, revoked, or already
    consumed (replay), in which case the family is revoked.
    """
    digest = auth_service.hash_refresh_token(raw_token)
    row = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    ).scalar_one_or_none()

    if row is None:
        raise AuthError("Invalid session")

    if row.consumed_at is not None or row.revoked_at is not None:
        # Replay of a rotated token, or use after logout: kill the family.
        revoke_family(db, row.family_id)
        db.commit()
        raise AuthError("Session expired. Please sign in again.")

    if row.expires_at <= _now():
        row.revoked_at = _now()
        db.commit()
        raise AuthError("Session expired. Please sign in again.")

    if row.user is None or not row.user.is_active:
        revoke_family(db, row.family_id)
        db.commit()
        raise AuthError("Account is no longer active")

    row.consumed_at = _now()
    raw, new_row = issue_refresh_token(
        db,
        user_id=row.user_id,
        user_agent=user_agent,
        ip_address=ip_address,
        family_id=row.family_id,
        previous_token_id=row.id,
    )
    return raw, new_row


def is_session_revoked(db: Session, family_id: str) -> bool:
    """True when the session family has no live token left.

    Called on every authenticated request so that logout invalidates the
    still-unexpired access token, not just the refresh cookie. A family is dead
    when every row is revoked, expired, or gone entirely - the last case covers
    an account whose rows were removed by ``ON DELETE CASCADE`` (account
    deletion), where checking ``revoked_at`` alone would wrongly report live.
    """
    active = db.execute(
        select(RefreshToken.id).where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.consumed_at.is_(None),
            RefreshToken.expires_at > _now(),
        ).limit(1)
    ).first()
    return active is None


def assert_refresh_session_valid(db: Session, raw_token: str) -> RefreshToken:
    """Non-mutating check used by endpoints that only need the session's owner."""
    digest = auth_service.hash_refresh_token(raw_token)
    row = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    ).scalar_one_or_none()
    if row is None or not row.is_active:
        raise AuthError("Invalid session")
    return row

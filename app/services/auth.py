"""Authentication primitives: password hashing and JWT access tokens.

Design
------
* Passwords: bcrypt via passlib, cost from settings. Verification of a missing
  user still runs a dummy hash so login timing does not reveal which emails exist.
* Access token: short-lived, stateless JWT signed HS256. It is returned in the
  JSON body and held **in memory** by the browser (never localStorage, never a
  cookie) so it cannot be read by injected script after the tab closes and is
  not auto-attached to cross-site requests (no CSRF surface).
* Refresh token: opaque 256-bit random value, delivered in an HttpOnly cookie,
  with only its SHA-256 digest stored server-side. See ``app/services/session.py``.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()

# The ``bcrypt`` package is used directly rather than ``passlib``: passlib 1.7.4
# is unmaintained and its bcrypt backend detection calls ``hashpw`` with a
# >72-byte probe, which current bcrypt releases reject, so importing passlib
# fails outright. Direct bcrypt also makes the 72-byte limit explicit.
ACCESS_TOKEN_TYPE = "access"
MAX_BCRYPT_BYTES = 72

# Pre-computed hash used to equalise timing when the email does not exist.
_DUMMY_HASH = bcrypt.hashpw(b"hireflow-dummy-password-for-timing-equalisation", bcrypt.gensalt(rounds=4))


def _password_bytes(password: str) -> bytes:
    """Encode a password, refusing silent bcrypt truncation."""
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_BCRYPT_BYTES:
        raise ValueError("Password must be at most 72 bytes long")
    return encoded


def get_password_hash(password: str) -> str:
    """Hash a plaintext password with bcrypt at the configured cost."""
    hashed = bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt(rounds=settings.BCRYPT_COST))
    return hashed.decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def verify_dummy_password(plain_password: str) -> None:
    """Burn comparable CPU time when a user record does not exist."""
    try:
        bcrypt.checkpw(plain_password.encode("utf-8")[:MAX_BCRYPT_BYTES], _DUMMY_HASH)
    except (ValueError, TypeError):
        pass


def create_access_token(
    subject: str,
    *,
    role: str,
    session_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, datetime]:
    """Create a signed access token.

    Args:
        subject: The user id (never the email; ids are opaque).
        role: The user's role, included for convenience only. Authorization
            always re-reads the role from the database.
        session_id: Refresh-token family id. Lets logout revoke access tokens
            that are still inside their expiry window.
        expires_delta: Optional lifetime override.

    Returns:
        ``(token, expires_at)``.
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": settings.JWT_ISSUER,
        # Unique per token: makes each token distinguishable for logging/audit.
        "jti": secrets.token_urlsafe(16),
        "sid": session_id,
    }
    token = jwt.encode(payload, settings.signing_key, algorithm=settings.JWT_ALGORITHM)
    return token, expire


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate an access token.

    Returns the payload, or ``None`` for any invalid/expired/forged token. The
    caller must still load the user from the database - the payload is a claim,
    not an authorization decision.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.signing_key,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["exp", "sub", "type", "iss"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        return None
    if not isinstance(payload.get("sub"), str) or not payload["sub"]:
        return None
    return payload


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------

def generate_refresh_token() -> str:
    """Generate an opaque, high-entropy refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Digest a refresh token for storage (never store the raw value)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_tokens_equal(left: str, right: str) -> bool:
    """Constant-time comparison of two token digests."""
    return hmac.compare_digest(left, right)

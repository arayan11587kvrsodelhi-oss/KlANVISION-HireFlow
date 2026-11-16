"""Authentication endpoints.

POST /auth/register  - create a candidate or recruiter account (no auto-login)
POST /auth/login     - verify credentials, issue access + refresh
POST /auth/refresh   - rotate the refresh cookie, issue a new access token
POST /auth/logout    - revoke the session server-side and clear the cookie
GET  /auth/me        - the authenticated caller, re-read from the database
POST /auth/change-password - self-service password change
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import update

from app.config import get_settings
from app.models.user import RefreshToken
from app.schemas.common import MessageResponse
from app.schemas.user import (
    LoginRequest,
    MeResponse,
    PasswordChangeRequest,
    RegisterRequest,
    RegisterResponse,
    Token,
)
from app.security import cookies
from app.security.deps import CurrentUserDep, DbSession, _extract_bearer_token
from app.security.errors import AuthError
from app.security.rate_limit import client_ip, enforce_auth_rate_limit
from app.services import auth as auth_service
from app.services import session as session_service
from app.services import users as user_service
from app.services.serializers import serialize_me

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _issue_tokens(db, user, request: Request, response: Response) -> Token:
    """Create a refresh session and return the access token.

    Both tokens are created from the same session family so logout can revoke
    the access token too.
    """
    raw_refresh, row = session_service.issue_refresh_token(
        db,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip(request),
    )
    db.commit()
    access_token, expires_at = auth_service.create_access_token(
        user.id, role=user.role, session_id=row.family_id
    )
    cookies.set_refresh_cookie(response, raw_refresh)
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a candidate or recruiter account",
)
def register(payload: RegisterRequest, request: Request, db: DbSession) -> RegisterResponse:
    enforce_auth_rate_limit(request, str(payload.email))
    user = user_service.register(db, payload)
    return RegisterResponse(user_id=user.id, email=user.email, role=user.role)


@router.post("/login", response_model=Token, summary="Sign in")
def login(
    payload: LoginRequest, request: Request, response: Response, db: DbSession
) -> Token:
    enforce_auth_rate_limit(request, str(payload.email))
    user = user_service.authenticate(db, str(payload.email), payload.password)
    if user is None:
        # Identical response for unknown email and wrong password.
        raise AuthError("Incorrect email or password", code="invalid_credentials")
    if not user.is_active:
        # Deliberately distinguishable from bad credentials, so a suspended
        # user is not left retrying passwords forever in confusion. This is
        # only reachable after the password has been verified, so it does not
        # leak account existence to someone who does not know the password.
        raise AuthError("This account has been suspended", code="account_suspended")
    return _issue_tokens(db, user, request, response)


@router.post("/refresh", response_model=Token, summary="Rotate session")
def refresh(request: Request, response: Response, db: DbSession) -> Token:
    from app.security.middleware import enforce_same_origin

    enforce_same_origin(request, settings.CORS_ORIGINS)

    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not raw_token:
        cookies.clear_refresh_cookie(response)
        raise AuthError("No active session")

    try:
        new_raw, row = session_service.rotate_refresh_token(
            db,
            raw_token,
            user_agent=request.headers.get("user-agent"),
            ip_address=client_ip(request),
        )
        db.commit()
    except AuthError:
        cookies.clear_refresh_cookie(response)
        raise

    user = row.user
    if user is None or not user.is_active:
        session_service.revoke_family(db, row.family_id)
        db.commit()
        cookies.clear_refresh_cookie(response)
        raise AuthError("Account is no longer active")

    access_token, _ = auth_service.create_access_token(
        user.id, role=user.role, session_id=row.family_id
    )
    cookies.set_refresh_cookie(response, new_raw)
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", response_model=MessageResponse, summary="Sign out")
def logout(request: Request, response: Response, db: DbSession) -> MessageResponse:
    """Sign out the caller's session(s).

    Two independent credentials can represent a session here:

    * the refresh cookie, which is what keeps the session renewable, and
    * the Bearer access token, whose ``sid`` claim names the session family.

    Revoking only via the cookie (the previous behaviour) left a live access
    token behind whenever the cookie was absent - a client that cleared cookies,
    or any caller that sent only the Authorization header. The access token's
    ``sid`` is therefore used as a second, independent revocation source.

    If both are present and name *different* sessions, both are revoked: a
    logout must never leave one of the caller's own sessions usable.

    The ``sid`` is only ever taken from a token whose signature, issuer and
    expiry :func:`decode_access_token` has already verified - it is a claim
    read from a validated token, never a caller-supplied session id.
    """
    from app.security.middleware import enforce_same_origin

    enforce_same_origin(request, settings.CORS_ORIGINS)

    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    cookie_family = (
        session_service.family_id_for_raw(db, raw_token) if raw_token else None
    )

    bearer_family = None
    bearer = _extract_bearer_token(request)
    if bearer:
        payload = auth_service.decode_access_token(bearer)
        if payload is not None:
            sid = payload.get("sid")
            # Only a string sid from a *verified* token is considered; the
            # ownership check below stops a token naming someone else's family.
            if isinstance(sid, str) and sid:
                owns = session_service.session_family_belongs_to(
                    db, sid, payload["sub"]
                )
                if owns:
                    bearer_family = sid

    revoked = False
    if raw_token:
        session_service.revoke_token_by_raw(db, raw_token)
        revoked = revoked or cookie_family is not None
    if bearer_family and bearer_family != cookie_family:
        session_service.revoke_family(db, bearer_family)
        revoked = True

    if revoked:
        db.commit()
    cookies.clear_refresh_cookie(response)
    # Idempotent by design: signing out twice, or without a session, is not an
    # error and must not disclose whether a session existed.
    return MessageResponse(message="Signed out")


@router.get("/me", response_model=MeResponse, summary="Current user")
def me(current: CurrentUserDep) -> MeResponse:
    return serialize_me(current)


@router.post("/change-password", response_model=MessageResponse, summary="Change password")
def change_password(
    payload: PasswordChangeRequest,
    response: Response,
    current: CurrentUserDep,
    db: DbSession,
) -> MessageResponse:
    user_service.change_password(
        db, current.user, payload.current_password, payload.new_password
    )
    # Every session of this user is invalidated on password change, including
    # a possible attacker session.
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == current.id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()
    cookies.clear_refresh_cookie(response)
    return MessageResponse(message="Password changed. Please sign in again.")

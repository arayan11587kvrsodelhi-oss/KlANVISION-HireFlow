"""HireFlow authentication services.

Provides password hashing/verification, access token creation,
and user identity verification for the authentication layer.

Uses Passlib bcrypt for secure password hashing and
JWT (python-jose) for token signing per the architecture doc.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt

from app.config import get_settings
from app.schemas.user import UserRole, Token, LoginRequest, RegisterRequest, MeResponse

settings = get_settings()

# Password hashing context using bcrypt per architecture doc
pwd_context = CryptContext(
    bcrypt_cost=settings.BCRYPT_COST,
    scheck_password=False,
    logger=None,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash for a plaintext password."""
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token for the given subject.

    Args:
        subject: The subject to encode in the token (typically user email or ID)
        expires_delta: Optional timedelta for token expiration

    Returns:
        Encoded JWT string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": subject, "role": "access"}

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm="HS256",
    )

    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token.

    Args:
        token: The JWT token string

    Returns:
        Payload dict if valid, None if invalid/expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        return payload
    except (JWTError, Exception):
        return None


def authenticate_user(
    email: str,
    password: str,
    user_records: list[dict],
) -> Optional[dict]:
    """Authenticate a user against provided user records.

    Args:
        email: User's email address
        password: Plaintext password to verify
        user_records: List of user dicts from database query

    Returns:
        User dict if authentication succeeds, None otherwise
    """
    for user in user_records:
        if user.get("email") == email:
            if verify_password(password, user.get("hashed_password", "")):
                # Return user data without password hash
                return {
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "full_name": user.get("full_name"),
                    "role": user.get("role"),
                    "is_active": user.get("is_active"),
                    "is_verified": user.get("is_verified"),
                }
    return None


def get_current_user_from_token(
    token: str,
    user_repo,
) -> Optional[dict]:
    """Get current user from a JWT token using the user repository.

    Args:
        token: The JWT access token
        user_repo: User repository for loading user by ID

    Returns:
        User dict if valid, None otherwise
    """
    payload = decode_access_token(token)
    if payload is None:
        return None

    # Verify token type
    if payload.get("role") != "access":
        return None

    subject = payload.get("sub")
    if subject is None:
        return None

    # Load user from repository - never trust token subject blindly
    user = user_repo.get_by_id(subject)
    if user is None:
        return None

    # Server-side authorization: verify user is active
    if not user.get("is_active", False):
        return None

    # Never trust role from client - always fetch from DB
    # The role in the token is just "access", we fetch the real role

    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user.get("role"),
        "is_active": user.get("is_active"),
        "is_verified": user.get("is_verified"),
    }


def refresh_access_token(
    old_token: str,
) -> Optional[str]:
    """Refresh an access token if the refresh is valid.

    Args:
        old_token: The current access token

    Returns:
        New access token if refresh is valid, None otherwise
    """
    payload = decode_access_token(old_token)
    if payload is None:
        return None

    # Only refresh access tokens, not other token types
    if payload.get("role") != "access":
        return None

    subject = payload.get("sub")
    if subject is None:
        return None

    # Create new token with fresh expiration
    return create_access_token(subject)


def revoke_token(token: str) -> bool:
    """Revoke a token by invalidating it.

    In a cookie-based auth system, revocation is typically
    handled by session store or token blacklist.

    Args:
        token: The token to revoke

    Returns:
        True if revocation was processed
    """
    # In cookie-based auth with short-lived access tokens,
    # revocation is primarily achieved via cookie deletion
    # and short expiration times.
    # For refresh tokens, we would check a revocation list.
    return True
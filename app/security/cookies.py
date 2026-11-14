"""Refresh-cookie helpers with secure, centrally-defined attributes."""

from __future__ import annotations

from fastapi import Response

from app.config import get_settings

settings = get_settings()

REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    """Attach the refresh token as an HttpOnly, path-scoped cookie.

    * ``httponly`` - unreadable from JavaScript, so XSS cannot exfiltrate it.
    * ``samesite`` - not sent on cross-site POSTs (CSRF).
    * ``secure`` - TLS-only outside development.
    * ``path=/api/v1/auth`` - sent only to the two endpoints that need it,
      which shrinks the attack surface if any other path ever reflects input.
    """
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.REFRESH_COOKIE_SAMESITE,  # type: ignore[arg-type]
        path=REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    """Expire the refresh cookie (must match the attributes used to set it)."""
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.REFRESH_COOKIE_SAMESITE,  # type: ignore[arg-type]
    )

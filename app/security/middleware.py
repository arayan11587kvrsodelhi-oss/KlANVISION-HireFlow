
"""HTTP hardening middleware and origin checks."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers

        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )

        is_development = get_settings().is_development
        is_docs_page = request.url.path in {
            "/api/docs",
            "/api/redoc",
            "/docs/oauth2-redirect",
        }

        if is_development and is_docs_page:
            # Swagger/Redoc require external assets and inline initialization.
            headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "connect-src 'self'; "
                "font-src 'self' data:; "
                "frame-ancestors 'none'; "
                "base-uri 'none'; "
                "form-action 'none'"
            )
        else:
            # Strict policy for API responses and all production responses.
            headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; "
                "base-uri 'none'; form-action 'none'",
            )

        if request.url.scheme == "https":
            headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )

        return response


def enforce_same_origin(request: Request, allowed_origins: list[str]) -> None:
    """Reject cross-site calls to cookie-authenticated endpoints."""

    from app.security.errors import ForbiddenError

    origin = request.headers.get("Origin")
    if origin is None:
        return

    normalized = origin.rstrip("/")
    allowed = {o.rstrip("/") for o in allowed_origins}

    if normalized not in allowed:
        raise ForbiddenError("Cross-site request rejected")

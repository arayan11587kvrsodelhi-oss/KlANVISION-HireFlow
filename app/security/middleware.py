"""HTTP hardening middleware and origin checks.

* :class:`SecurityHeadersMiddleware` adds defence-in-depth headers. The API only
  emits JSON (and a forced-download resume attachment), so a restrictive CSP
  costs nothing and neutralises content sniffing / framing tricks.
* :func:`enforce_same_origin` is the CSRF control for the cookie-carried refresh
  token.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach standard security headers to every response."""

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
        # JSON API: nothing should ever be rendered, embedded or invoked.
        headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
        if request.url.scheme == "https":
            headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


def enforce_same_origin(request: Request, allowed_origins: list[str]) -> None:
    """Reject cross-site calls to cookie-authenticated endpoints (CSRF guard).

    Browsers attach ``Origin`` to cross-origin requests *and* to same-origin
    fetch/XHR POSTs, so requiring it to be an allowed origin blocks a malicious
    site from replaying the refresh cookie. Requests without ``Origin`` (curl,
    server-to-server) are not a browser CSRF vector because they carry no
    ambient browser cookies.
    """
    from app.security.errors import ForbiddenError

    origin = request.headers.get("Origin")
    if origin is None:
        return
    normalized = origin.rstrip("/")
    allowed = {o.rstrip("/") for o in allowed_origins}
    if normalized not in allowed:
        raise ForbiddenError("Cross-site request rejected")

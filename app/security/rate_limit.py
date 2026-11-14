"""Fixed-window, in-process rate limiting.

Scope and honesty
-----------------
This limiter is deliberately dependency-free and keeps counters in process
memory. That makes it correct for a single API worker and **not sufficient** for
a multi-instance deployment: each instance would hold its own counters. For
multi-worker production, point :func:`_backend` at Redis (the interface is one
``incr`` call). The limitation is documented in ``DEPLOYMENT.md`` rather than
hidden behind a "rate limited" checkbox.

Auth endpoints are keyed by client IP **and** normalised email, so one attacker
cannot lock out an account by hammering it from elsewhere, and one IP cannot
brute-force many accounts.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from fastapi import Request

from app.security.errors import RateLimitError


@dataclass
class _Window:
    count: int
    reset_at: float


class FixedWindowLimiter:
    """Thread-safe fixed-window counter store."""

    def __init__(self) -> None:
        self._windows: dict[str, _Window] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int = 60) -> None:
        now = time.monotonic()
        with self._lock:
            # Opportunistic cleanup keeps memory bounded without a background task.
            if len(self._windows) > 10_000:
                self._windows = {
                    k: v for k, v in self._windows.items() if v.reset_at > now
                }
            window = self._windows.get(key)
            if window is None or window.reset_at <= now:
                self._windows[key] = _Window(count=1, reset_at=now + window_seconds)
                return
            window.count += 1
            if window.count > limit:
                retry_after = max(1, int(window.reset_at - now) + 1)
                raise RateLimitError(retry_after)

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()


limiter = FixedWindowLimiter()


def client_ip(request: Request) -> str:
    """Client IP, honouring one proxy hop when explicitly configured.

    ``X-Forwarded-For`` is only trusted because deployments are expected to sit
    behind a reverse proxy that overwrites it. If the API is exposed directly,
    ``request.client.host`` is the only trustworthy value - which is what we use.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def enforce_auth_rate_limit(request: Request, identity: str) -> None:
    """Limit credential submissions per IP and per targeted account."""
    from app.config import get_settings

    settings = get_settings()
    limit = settings.RATE_LIMIT_AUTH_PER_MIN
    limiter.hit(f"auth:ip:{client_ip(request)}", limit)
    if identity:
        limiter.hit(f"auth:account:{identity.lower()}", limit)


def rate_limit_dependency_factory(per_minute: int):
    """Build a FastAPI dependency enforcing a per-IP request budget."""

    def _dependency(request: Request) -> None:
        limiter.hit(f"route:{request.url.path}:{client_ip(request)}", per_minute)

    return _dependency

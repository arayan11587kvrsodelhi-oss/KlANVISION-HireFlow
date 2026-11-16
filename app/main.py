"""FastAPI application entry point for HireFlow."""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import ALL_ROUTERS
from app.config import Settings, get_settings
from app.security.errors import AuthError, ForbiddenError, NotFoundError, RateLimitError
from app.security.middleware import SecurityHeadersMiddleware

settings: Settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _error(
    status_code: int,
    detail: str,
    code: str,
    headers: Mapping[str, str] | None = None,
    errors: list[dict] | None = None,
) -> JSONResponse:
    body: dict = {"detail": detail, "code": code}
    if errors:
        body["errors"] = errors
    return JSONResponse(status_code=status_code, content=body, headers=dict(headers) if headers else None)


from collections.abc import Mapping
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info("Starting HireFlow API (environment=%s)", settings.ENVIRONMENT)
    # The DSN is never logged, not even partially: it carries the password.
    yield
    logger.info("Shutting down HireFlow API")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        lifespan=lifespan,
        title="HireFlow API",
        description="Recruitment platform API (FastAPI + SQLAlchemy + PostgreSQL)",
        version="1.0.0",
        # Interactive docs are a developer tool: never exposed in production.
        docs_url="/api/docs" if settings.is_development else None,
        redoc_url="/api/redoc" if settings.is_development else None,
        openapi_url="/api/openapi.json" if settings.is_development else None,
    )

    # ---- Middleware (outermost first) --------------------------------
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        # Explicit origins only. ``allow_credentials`` is required for the
        # refresh cookie, which is exactly why a wildcard origin must never be
        # used (browsers reject it, but we also refuse to configure it).
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
        expose_headers=["Retry-After", "Content-Disposition"],
        max_age=600,
    )

    # ---- Routers ------------------------------------------------------
    for router in ALL_ROUTERS:
        app.include_router(router, prefix="/api/v1")

    # ---- Exception handlers: one error envelope everywhere ------------
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Re-shape pydantic errors into a stable, non-leaky list. The raw
        # exception carries the submitted value in ``input``; we drop it.
        errors = [
            {
                "field": ".".join(str(part) for part in err.get("loc", [])[1:]) or "body",
                "message": err.get("msg", "Invalid value"),
            }
            for err in exc.errors()
        ]
        return _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Request validation failed",
            "validation_error",
            errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(
            exc.status_code,
            str(exc.detail),
            getattr(exc, "code", "error"),
            exc.headers,
        )

    @app.exception_handler(AuthError)
    async def _auth_handler(request: Request, exc: AuthError) -> JSONResponse:
        return _error(
            401, str(exc.detail), getattr(exc, "code", "not_authenticated"), dict(exc.headers or {})
        )

    @app.exception_handler(ForbiddenError)
    async def _forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
        return _error(403, str(exc.detail), "forbidden")

    @app.exception_handler(NotFoundError)
    async def _not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return _error(404, str(exc.detail), "not_found")

    @app.exception_handler(RateLimitError)
    async def _rate_limit_handler(request: Request, exc: RateLimitError) -> JSONResponse:
        return _error(429, str(exc.detail), "rate_limited", dict(exc.headers or {}))

    @app.exception_handler(SQLAlchemyError)
    async def _db_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        # Log the exception type and the request id; never its text, which can
        # contain parameter values.
        logger.exception("Database error on %s %s", request.method, request.url.path)
        return _error(500, "A database error occurred", "database_error")

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        if settings.is_development:
            # Developer detail only; never in staging/production.
            return _error(500, f"{type(exc).__name__}: {exc}", "internal_error")
        return _error(500, "Internal server error", "internal_error")

    # ---- Request logging (no bodies, no query strings, no headers) ----
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_id=%s %s %s -> unhandled", request_id, request.method, request.url.path
            )
            raise
        duration_ms = (time.perf_counter() - started) * 1000
        # Path only: query strings can contain search terms / emails.
        logger.info(
            "request_id=%s %s %s -> %s %.1fms",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-Id"] = request_id
        return response

    return app


app = create_app()

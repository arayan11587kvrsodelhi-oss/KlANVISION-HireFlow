"""FastAPI application entry point for HireFlow.

Configures the FastAPI app with middleware, dependencies, event handlers,
and includes all versioned API routers.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings, Settings
from app.db.session import get_db_session

from app.api.v1.health import router as health_router

# Get settings instance
settings: Settings = get_settings()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        FastAPI: The configured FastAPI application instance.
    """
    app = FastAPI(
        title="HireFlow API",
        description="Full-stack hiring platform with FastAPI, SQLAlchemy, and PostgreSQL",
        version="1.0.0",
        docs_url="/api/docs" if settings.is_development else None,
        redoc_url="/api/redoc" if settings.is_development else None,
        openapi_url="/api/openapi.json" if settings.is_development else None,
    )

    # Configure CORS - allow origins from settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register versioned API routers
    app.include_router(health_router, prefix="/api/v1", tags=["api v1"])

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected exceptions globally.

        Logs the exception and returns a consistent error response.
        """
        logger.error(
            "Unhandled exception: %s %s -> %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )

        if settings.is_development:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": str(exc),
                    "path": str(request.url.path),
                },
            )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next) -> JSONResponse:
        """Log incoming requests and response times."""
        response = await call_next(request)
        logger.info(
            "%s %s -> %s %s",
            request.method,
            request.url.path,
            response.status_code,
            getattr(response, "header", {}).get("content-length", "unknown"),
        )
        return response

    # Database session dependency setup
    @app.on("startup")
    async def startup() -> None:
        """Run on application startup."""
        logger.info("Starting HireFlow API...")
        logger.info("Environment: %s", settings.ENVIRONMENT)
        logger.info("Database DSN: %s", settings.NEON_DSN.split("@")[-1] if "@" in settings.NEON_DSN else "***masked***")
        # Note: Database connection is managed per-request via get_db_session dependency

    # Shutdown event
    @app.on("shutdown")
    async def shutdown() -> None:
        """Run on application shutdown."""
        logger.info("Shutting down HireFlow API...")

    return app
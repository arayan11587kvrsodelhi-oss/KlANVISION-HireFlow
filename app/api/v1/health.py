"""Health endpoints.

``/health`` is a shallow liveness probe (no DB). ``/health/ready`` checks the
database, which is what a load balancer / deploy gate should use before routing
traffic: an API that cannot reach Postgres is not ready.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.db.session import SessionLocal

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health", summary="Liveness probe")
def health_check() -> dict:
    """Process is up and able to serve requests."""
    return {"status": "healthy", "service": "hireflow-api"}


@router.get("/health/ready", summary="Readiness probe (includes database)")
def readiness(response: Response) -> dict:
    """Verify the API can reach the database."""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - the point is to catch anything
        # Log the type only: the DSN and driver message can contain credentials.
        logger.error("Readiness check failed: %s", type(exc).__name__)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "unreachable"}
    return {"status": "ready", "database": "ok"}

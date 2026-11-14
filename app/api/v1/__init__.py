"""HireFlow API v1 routers."""

from app.api.v1.admin import router as admin_router
from app.api.v1.applications import router as applications_router
from app.api.v1.auth import router as auth_router
from app.api.v1.candidates import router as candidates_router
from app.api.v1.companies import router as companies_router
from app.api.v1.health import router as health_router
from app.api.v1.jobs import router as jobs_router

# Order matters only for readability; paths are disjoint.
ALL_ROUTERS = (
    health_router,
    auth_router,
    companies_router,
    jobs_router,
    applications_router,
    candidates_router,
    admin_router,
)

__all__ = ["ALL_ROUTERS"]

"""Health check endpoint for the HireFlow API."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check", tags=["api v1"])
async def health_check() -> dict:
    """Return the API health status.

    Returns a simple JSON response indicating the service is running
    and healthy. Can be used by load balancers and monitoring systems.
    """
    return {"status": "healthy", "service": "hireflow-api"}
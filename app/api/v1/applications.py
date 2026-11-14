"""Applications: candidate submission/history and recruiter pipeline management.

Candidate *self* views live under ``/candidates/me`` (see ``candidates.py``).
This router owns the application resource itself plus the recruiter pipeline.
Every recruiter route is scoped to applications whose job belongs to the
caller's company; the company id is resolved from the membership table.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from app.schemas.application import (
    ApplicationCounts,
    ApplicationCreate,
    ApplicationOut,
    ApplicationStatus,
    ApplicationStatusUpdate,
)
from app.security.deps import CandidateDep, DbSession, RecruiterDep
from app.services import applications as application_service
from app.services.serializers import serialize_application

router = APIRouter(prefix="/applications", tags=["applications"])


# ---------------------------------------------------------------------------
# Candidate
# ---------------------------------------------------------------------------

@router.post(
    "/jobs/{job_id}",
    response_model=ApplicationOut,
    status_code=201,
    summary="Apply to a job (candidate)",
)
def apply_to_job(
    job_id: str, payload: ApplicationCreate, current: CandidateDep, db: DbSession
) -> ApplicationOut:
    application = application_service.apply_to_job(db, current, job_id, payload)
    return serialize_application(
        application, include_recruiter_fields=False, include_history=True
    )


# ---------------------------------------------------------------------------
# Recruiter pipeline
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[ApplicationOut],
    summary="Applicants for my company (recruiter)",
)
def list_applications(
    current: RecruiterDep,
    db: DbSession,
    job_id: Optional[str] = Query(default=None, max_length=36),
    status: Optional[ApplicationStatus] = None,
    search: Optional[str] = Query(default=None, max_length=120),
) -> list[ApplicationOut]:
    rows = application_service.list_company_applications(
        db, current, job_id=job_id, status=status, search=search
    )
    return [
        serialize_application(row, include_recruiter_fields=True, include_history=False)
        for row in rows
    ]


@router.get(
    "/counts", response_model=ApplicationCounts, summary="Pipeline counts (recruiter)"
)
def pipeline_counts(current: RecruiterDep, db: DbSession) -> ApplicationCounts:
    return ApplicationCounts(**application_service.company_pipeline_counts(db, current))


@router.get(
    "/{application_id}", response_model=ApplicationOut, summary="Applicant dossier (recruiter)"
)
def get_application(
    application_id: str, current: RecruiterDep, db: DbSession
) -> ApplicationOut:
    application = application_service.get_company_application(db, current, application_id)
    return serialize_application(
        application, include_recruiter_fields=True, include_history=True
    )


@router.patch(
    "/{application_id}",
    response_model=ApplicationOut,
    summary="Update stage/notes/rating (recruiter)",
)
def update_application(
    application_id: str,
    payload: ApplicationStatusUpdate,
    current: RecruiterDep,
    db: DbSession,
) -> ApplicationOut:
    application = application_service.update_application_status(
        db, current, application_id, payload
    )
    return serialize_application(
        application, include_recruiter_fields=True, include_history=True
    )

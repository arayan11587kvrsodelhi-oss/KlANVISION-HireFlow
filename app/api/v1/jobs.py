"""Job board and recruiter job management endpoints.

Read routes are public (they serve the anonymous job board) but their visibility
depends on the caller: drafts are only visible to their owning company and to
admins. Write routes are recruiter-only and derive the owning company server-side.
"""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Query, status

from app.schemas.common import MessageResponse, Page
from app.schemas.job import JobCreate, JobOut, JobUpdate
from app.security.deps import (
    CandidateDep,
    DbSession,
    OptionalUserDep,
    RecruiterDep,
    StaffDep,
)
from app.security.errors import ForbiddenError
from app.services import applications as application_service
from app.services import jobs as job_service
from app.services.serializers import serialize_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


# ---------------------------------------------------------------------------
# Public / authenticated reads
# ---------------------------------------------------------------------------

@router.get("", response_model=Page[JobOut], summary="Search the job board")
def search_jobs(
    db: DbSession,
    current: OptionalUserDep,
    q: Optional[str] = Query(default=None, max_length=120),
    location: Optional[str] = Query(default=None, max_length=120),
    workplace_type: Optional[Literal["Remote", "Hybrid", "On-site"]] = None,
    job_type: Optional[Literal["Full-time", "Part-time", "Contract", "Internship"]] = None,
    experience_level: Optional[Literal["Entry", "Mid", "Senior", "Lead", "Executive"]] = None,
    department: Optional[str] = Query(default=None, max_length=120),
    salary_min: Optional[int] = Query(default=None, ge=0),
    salary_max: Optional[int] = Query(default=None, ge=0),
    status_filter: Optional[Literal["draft", "published", "closed"]] = Query(
        default=None, alias="status"
    ),
    company_id: Optional[str] = Query(default=None, max_length=36),
    sort: Literal["newest", "salary-high", "salary-low"] = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[JobOut]:
    jobs, total = job_service.search_jobs(
        db,
        current,
        query=q,
        location=location,
        workplace_type=workplace_type,
        job_type=job_type,
        experience_level=experience_level,
        department=department,
        salary_min=salary_min,
        salary_max=salary_max,
        status=status_filter,
        company_id=company_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return Page.build(
        items=job_service.serialize_jobs(db, jobs),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/mine", response_model=list[JobOut], summary="My company's jobs (recruiter)")
def my_company_jobs(current: RecruiterDep, db: DbSession) -> list[JobOut]:
    if not current.company_id:
        raise ForbiddenError("Your recruiter account is not linked to a company")
    jobs = job_service.list_company_jobs(db, str(current.company_id))
    return job_service.serialize_jobs(db, jobs)


@router.get("/saved", response_model=list[JobOut], summary="My saved jobs (candidate)")
def my_saved_jobs(current: CandidateDep, db: DbSession) -> list[JobOut]:
    jobs = job_service.list_saved_jobs(db, current.id)
    return job_service.serialize_jobs(db, jobs)


@router.get("/saved/ids", response_model=list[str], summary="Ids of my saved jobs")
def my_saved_job_ids(current: CandidateDep, db: DbSession) -> list[str]:
    return job_service.list_saved_job_ids(db, current.id)


@router.get("/applied/ids", response_model=list[str], summary="Ids of jobs I applied to")
def my_applied_job_ids(current: CandidateDep, db: DbSession) -> list[str]:
    return application_service.applied_job_ids(db, current)


@router.get("/{job_id}", response_model=JobOut, summary="Job detail")
def get_job(job_id: str, current: OptionalUserDep, db: DbSession) -> JobOut:
    job = job_service.get_job_for_reader(db, job_id, current)
    return serialize_job(job, applicants_count=job_service.job_applicant_count(db, job.id))


# ---------------------------------------------------------------------------
# Recruiter writes
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job (recruiter)",
)
def create_job(payload: JobCreate, current: RecruiterDep, db: DbSession) -> JobOut:
    job = job_service.create_job(db, current, payload)
    return serialize_job(job, applicants_count=0)


@router.patch(
    "/{job_id}",
    response_model=JobOut,
    summary="Update a job (owning recruiter, or admin for moderation)",
)
def update_job(
    job_id: str, payload: JobUpdate, current: StaffDep, db: DbSession
) -> JobOut:
    # `get_owned_job` applies the company scope for recruiters and grants
    # admins moderation rights.
    job = job_service.update_job(db, current, job_id, payload)
    return serialize_job(job, applicants_count=job_service.job_applicant_count(db, job.id))


@router.delete(
    "/{job_id}",
    response_model=MessageResponse,
    summary="Delete a job (owning recruiter, or admin for moderation)",
)
def delete_job(job_id: str, current: StaffDep, db: DbSession) -> MessageResponse:
    job_service.delete_job(db, current, job_id)
    return MessageResponse(message="Job deleted")


@router.post(
    "/{job_id}/save", response_model=list[str], summary="Toggle bookmark (candidate)"
)
def toggle_save(job_id: str, current: CandidateDep, db: DbSession) -> list[str]:
    _, saved_ids = job_service.toggle_saved_job(db, current.id, job_id)
    return saved_ids


@router.delete(
    "/{job_id}/save", response_model=list[str], summary="Remove a bookmark (candidate)"
)
def remove_saved_job(job_id: str, current: CandidateDep, db: DbSession) -> list[str]:
    """Idempotent removal: un-saving a job that is not saved is not an error."""
    return job_service.remove_saved_job(db, current.id, job_id)

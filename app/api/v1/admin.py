"""Administrator endpoints. Every route requires the admin role."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.admin import (
    AccountStatusUpdate,
    AdminCandidateOut,
    AdminMetrics,
    CompanyVerificationUpdate,
    JobFeaturedUpdate,
)
from app.schemas.company import CompanyOut
from app.schemas.job import JobOut
from app.security.deps import AdminDep, DbSession
from app.security.errors import NotFoundError
from app.services import admin as admin_service
from app.services import jobs as job_service
from app.services.serializers import serialize_company, serialize_job

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics", response_model=AdminMetrics, summary="Platform counters")
def metrics(current: AdminDep, db: DbSession) -> AdminMetrics:
    return admin_service.get_metrics(db)


@router.get(
    "/candidates", response_model=list[AdminCandidateOut], summary="Candidate directory"
)
def list_candidates(
    current: AdminDep,
    db: DbSession,
    search: str | None = Query(default=None, max_length=120),
) -> list[AdminCandidateOut]:
    return [AdminCandidateOut(**row) for row in admin_service.list_candidates(db, search=search)]


@router.patch(
    "/candidates/{candidate_id}/status",
    response_model=AdminCandidateOut,
    summary="Activate or suspend a candidate account",
)
def set_candidate_status(
    candidate_id: str, payload: AccountStatusUpdate, current: AdminDep, db: DbSession
) -> AdminCandidateOut:
    admin_service.set_candidate_active(db, candidate_id, payload.is_active)
    rows = admin_service.list_candidates(db)
    for row in rows:
        if row["id"] == candidate_id:
            return AdminCandidateOut(**row)
    raise NotFoundError("Candidate not found")


@router.patch(
    "/companies/{company_id}/verification",
    response_model=CompanyOut,
    summary="Grant or revoke verified-employer status",
)
def set_company_verification(
    company_id: str, payload: CompanyVerificationUpdate, current: AdminDep, db: DbSession
) -> CompanyOut:
    company = admin_service.set_company_verified(db, company_id, payload.is_verified)
    from app.services.companies import get_public_company

    _, count = get_public_company(db, company.id)
    return serialize_company(company, open_jobs_count=count)


@router.get("/jobs", response_model=list[JobOut], summary="All jobs incl. drafts")
def all_jobs(current: AdminDep, db: DbSession) -> list[JobOut]:
    jobs, _ = job_service.search_jobs(db, current, page=1, page_size=100)
    return job_service.serialize_jobs(db, jobs)


@router.patch(
    "/jobs/{job_id}/featured", response_model=JobOut, summary="Feature/unfeature a job"
)
def set_featured(
    job_id: str, payload: JobFeaturedUpdate, current: AdminDep, db: DbSession
) -> JobOut:
    # Featuring a role on the public board is editorial: admins only. Recruiters
    # must not be able to buy visibility for their own company's listings.
    # `get_owned_job` below still accepts the admin principal.
    job = job_service.get_owned_job(db, job_id, current)
    job_service.set_featured(db, job, payload.featured)
    return serialize_job(job, applicants_count=job_service.job_applicant_count(db, job.id))

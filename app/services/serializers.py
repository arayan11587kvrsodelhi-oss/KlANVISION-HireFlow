"""ORM -> API response serializers.

Keeping this in one module guarantees the same field names and derived values
(applicant counts, company names, resume sizes) everywhere, and gives a single
file to review when asking "does this response leak more than it should?".
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional, Sequence

from app.models.application import Application, ApplicationStatusHistory
from app.models.company import Company
from app.models.job import Job, JobBullet
from app.models.resume import Resume
from app.models.user import CandidateProfile, User
from app.schemas.application import ApplicationOut, StatusHistoryEntry
from app.schemas.candidate import (
    CandidateProfileOut,
    EducationOut,
    ResumeSummary,
    WorkExperienceOut,
)
from app.schemas.resume import ResumeOut
from app.schemas.company import CompanyOut
from app.schemas.job import JobOut
from app.schemas.user import MeResponse
from app.security.deps import CurrentUser


def human_size(num_bytes: Optional[int]) -> str:
    """Format a byte count for display (e.g. ``248 KB``)."""
    if not num_bytes or num_bytes <= 0:
        return "0 KB"
    if num_bytes < 1024:
        return f"{num_bytes} B"
    kb = num_bytes / 1024
    if kb < 1024:
        return f"{round(kb)} KB"
    return f"{kb / 1024:.1f} MB"


def _bullets(job: Job, kind: str) -> list[str]:
    items: Iterable[JobBullet] = getattr(job, kind, [])
    return [item.text for item in items]


def serialize_job(job: Job, *, applicants_count: int = 0) -> JobOut:
    company: Company | None = job.company
    return JobOut(
        id=job.id,
        title=job.title,
        company_id=job.company_id,
        company_name=company.name if company else "",
        company_logo=company.logo if company else None,
        company_verified=bool(company.is_verified) if company else False,
        location=job.location,
        workplace_type=job.workplace_type,
        job_type=job.job_type,
        experience_level=job.experience_level,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        salary_currency=job.salary_currency,
        department=job.department,
        description=job.description,
        responsibilities=_bullets(job, "responsibilities"),
        requirements=_bullets(job, "requirements"),
        benefits=_bullets(job, "benefits"),
        posted_date=job.published_at or job.created_at,
        status=job.status,
        applicants_count=applicants_count,
        featured=job.is_featured,
    )


def serialize_company(company: Company, *, open_jobs_count: int = 0) -> CompanyOut:
    return CompanyOut(
        id=company.id,
        name=company.name,
        description=company.description,
        website=company.website,
        industry=company.industry,
        location=company.location,
        employee_count=company.employee_count,
        logo=company.logo,
        is_verified=company.is_verified,
        open_jobs_count=open_jobs_count,
        created_at=company.created_at,
    )


def serialize_resume_summary(resume: Resume, *, download_url: str) -> ResumeSummary:
    return ResumeSummary(
        id=resume.id,
        file_name=resume.filename,
        file_size=human_size(resume.size_bytes),
        uploaded_at=resume.uploaded_at,
        download_url=download_url,
    )


def _active_resume(profile: CandidateProfile) -> Resume | None:
    resumes = [r for r in (profile.user.resumes or []) if r.status == "active"]
    if not resumes:
        return None
    return max(resumes, key=lambda r: r.uploaded_at)


def serialize_resume(resume: Resume) -> ResumeOut:
    return ResumeOut(
        id=resume.id,
        file_name=resume.filename,
        file_size=human_size(resume.size_bytes),
        mimetype=resume.mimetype,
        uploaded_at=resume.uploaded_at,
        download_url=f"/api/v1/candidates/me/resume/{resume.id}",
    )


def serialize_candidate_profile(profile: CandidateProfile) -> CandidateProfileOut:
    resume = _active_resume(profile)
    return CandidateProfileOut(
        full_name=profile.full_name,
        headline=profile.headline,
        bio=profile.bio,
        phone=profile.phone,
        location=profile.location,
        website=profile.website,
        github=profile.github,
        linkedin=profile.linkedin,
        skills=[skill.name for skill in profile.skills],
        experience=[
            WorkExperienceOut(
                id=item.id,
                role=item.role,
                company=item.company,
                location=item.location,
                start_date=item.start_date,
                end_date=item.end_date,
                current=item.is_current,
                description=item.description,
            )
            for item in profile.experience
        ],
        education=[
            EducationOut(
                id=item.id,
                degree=item.degree,
                field=item.field,
                institution=item.institution,
                start_year=item.start_year,
                end_year=item.end_year,
                gpa=item.gpa,
            )
            for item in profile.education
        ],
        resume=(
            serialize_resume_summary(
                resume, download_url=f"/api/v1/candidates/me/resume/{resume.id}"
            )
            if resume
            else None
        ),
        updated_at=profile.updated_at,
    )


def serialize_me(current: CurrentUser) -> MeResponse:
    user: User = current.user
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,  # type: ignore[arg-type]
        is_active=user.is_active,
        is_verified=user.is_verified,
        full_name=current.full_name,
        company_id=current.company_id,
        company_name=current.company_name,
        created_at=user.created_at,
    )


def serialize_application(
    application: Application,
    *,
    include_recruiter_fields: bool,
    include_history: bool = False,
) -> ApplicationOut:
    """Serialize an application for its owner or for a recruiter.

    ``include_recruiter_fields`` gates the *internal* review fields. The
    recruiter's feedback note is intentionally shared with the candidate - the
    UI presents it as "latest communication from recruiter" - so ``notes`` is
    always populated while ``rating`` stays internal to the hiring team.
    """
    job: Job = application.job
    company: Company = job.company
    candidate_user: User = application.candidate
    profile: CandidateProfile | None = candidate_user.candidate_profile
    resume = application.resume

    history: Sequence[ApplicationStatusHistory] = (
        application.status_history if include_history else []
    )

    return ApplicationOut(
        id=application.id,
        job_id=job.id,
        job_title=job.title,
        company_id=company.id,
        company_name=company.name,
        company_logo=company.logo,
        candidate_id=candidate_user.id,
        candidate_name=(profile.full_name if profile and profile.full_name else candidate_user.email),
        candidate_email=candidate_user.email,
        # Contact details and internal notes are recruiter-only: a candidate
        # reading their own application does not need (and does not get) their
        # own data echoed back through a path intended for reviewers.
        candidate_phone=(profile.phone if include_recruiter_fields and profile else None),
        candidate_headline=(profile.headline if profile else None),
        resume_file_name=application.resume_filename or (resume.filename if resume else None),
        resume_size=human_size(resume.size_bytes) if resume else None,
        resume_download_url=(
            f"/api/v1/candidates/me/resume/{resume.id}" if resume else None
        ),
        cover_letter=application.cover_letter,
        applied_date=application.applied_at,
        status=application.status,
        stage_updated_at=application.status_updated_at,
        # Feedback is two-way by design; the private internal score is not.
        notes=application.recruiter_notes,
        rating=application.rating if include_recruiter_fields else None,
        history=[
            StatusHistoryEntry(
                previous_status=entry.previous_status,
                new_status=entry.new_status,
                changed_at=entry.changed_at,
            )
            for entry in history
        ],
    )

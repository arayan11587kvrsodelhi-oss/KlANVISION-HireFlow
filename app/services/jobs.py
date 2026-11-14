"""Job posting business logic.

Visibility rules
----------------
* Public/anonymous: only ``published`` jobs.
* Candidate: only ``published`` jobs (a draft must never leak a company's
  unreleased hiring plans).
* Recruiter: published jobs plus every job of **their own** company.
* Admin: everything.

Mutation rules
--------------
A recruiter may only touch a job whose ``company_id`` equals the company id
resolved from their membership row. That id comes from the database, never from
the request body or a query parameter.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.application import Application
from app.models.company import Company
from app.models.job import Job, JobBullet
from app.models.user import SavedJob
from app.schemas.job import JobCreate, JobUpdate
from app.security.deps import CurrentUser
from app.security.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.services import serializers

BULLET_KINDS = {
    "responsibilities": "responsibility",
    "requirements": "requirement",
    "benefits": "benefit",
}

_JOB_LOADERS = (
    joinedload(Job.company),
    selectinload(Job.responsibilities),
    selectinload(Job.requirements),
    selectinload(Job.benefits),
)


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

def _applicant_counts(db: Session, job_ids: Iterable[str]) -> dict[str, int]:
    """Applicant count per job in one grouped query (avoids an N+1 loop)."""
    ids = list(job_ids)
    if not ids:
        return {}
    rows = db.execute(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_(ids))
        .group_by(Application.job_id)
    ).all()
    return {job_id: count for job_id, count in rows}


def _escape_like(value: str) -> str:
    """Escape LIKE metacharacters so user input is matched literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def visible_jobs_query(current: Optional[CurrentUser]) -> Select:
    """Base query restricted to the jobs this principal may see."""
    query = select(Job).options(*_JOB_LOADERS)
    if current is None:
        return query.where(Job.status == "published")
    if current.role == "admin":
        return query
    if current.role == "recruiter" and current.company_id:
        return query.where(
            or_(Job.status == "published", Job.company_id == current.company_id)
        )
    return query.where(Job.status == "published")


def get_job_for_reader(db: Session, job_id: str, current: Optional[CurrentUser]) -> Job:
    """Fetch a job the principal is allowed to see, else 404."""
    job = db.execute(
        select(Job).options(*_JOB_LOADERS).where(Job.id == job_id)
    ).unique().scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")

    if current is None or current.role == "candidate":
        # Drafts and closed postings are invisible to candidates and guests;
        # reporting 404 (not 403) avoids confirming that a draft id exists.
        if job.status != "published":
            raise NotFoundError("Job not found")
    elif current.role == "recruiter":
        if job.status != "published" and job.company_id != current.company_id:
            raise NotFoundError("Job not found")
    return job


def get_owned_job(db: Session, job_id: str, current: CurrentUser) -> Job:
    """Fetch a job and assert the caller may modify it.

    Recruiters are confined to their own company. Administrators are the
    platform operators and may moderate any job (that is what "delete an abusive
    listing" means), so they are exempt from the company check - but not from
    authentication or the role check.
    """
    job = db.execute(
        select(Job).options(*_JOB_LOADERS).where(Job.id == job_id)
    ).unique().scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")
    if current.role == "admin":
        return job
    if current.role != "recruiter":
        raise ForbiddenError("Only recruiters can manage job postings")
    if job.company_id != current.company_id:
        raise NotFoundError("Job not found")
    return job


def search_jobs(
    db: Session,
    current: Optional[CurrentUser],
    *,
    query: Optional[str] = None,
    location: Optional[str] = None,
    workplace_type: Optional[str] = None,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    department: Optional[str] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    status: Optional[str] = None,
    company_id: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list, int]:
    """Filtered, sorted, paginated job search. Returns ``(items, total)``."""
    stmt = visible_jobs_query(current).join(Company, Job.company_id == Company.id)

    if query:
        # Parameterised LIKE - the value is bound, never interpolated, so a
        # quote or a comment sequence cannot alter the SQL. The LIKE wildcards
        # are escaped as well, so typing "%" searches for a percent sign instead
        # of matching every row.
        pattern = f"%{_escape_like(query.strip())}%"
        stmt = stmt.where(
            or_(
                Job.title.ilike(pattern),
                Job.description.ilike(pattern),
                Job.department.ilike(pattern),
                Company.name.ilike(pattern),
            )
        )
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{_escape_like(location.strip())}%"))
    if workplace_type:
        stmt = stmt.where(Job.workplace_type == workplace_type)
    if job_type:
        stmt = stmt.where(Job.job_type == job_type)
    if experience_level:
        stmt = stmt.where(Job.experience_level == experience_level)
    if department:
        stmt = stmt.where(Job.department.ilike(_escape_like(department.strip())))
    if company_id:
        stmt = stmt.where(Job.company_id == company_id)
    if status:
        # A status filter can only ever narrow the visibility predicate above.
        stmt = stmt.where(Job.status == status)
    if salary_min is not None and salary_min > 0:
        stmt = stmt.where(Job.salary_max >= salary_min)
    if salary_max is not None and salary_max > 0:
        stmt = stmt.where(Job.salary_min <= salary_max)

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    if sort == "salary-high":
        stmt = stmt.order_by(Job.salary_max.desc(), Job.created_at.desc())
    elif sort == "salary-low":
        stmt = stmt.order_by(Job.salary_min.asc(), Job.created_at.desc())
    else:
        stmt = stmt.order_by(
            Job.is_featured.desc(),
            func.coalesce(Job.published_at, Job.created_at).desc(),
        )

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    jobs = list(db.execute(stmt).unique().scalars().all())
    return jobs, total


def list_company_jobs(db: Session, company_id: str) -> list:
    jobs = list(
        db.execute(
            select(Job)
            .options(*_JOB_LOADERS)
            .where(Job.company_id == company_id)
            .order_by(Job.created_at.desc())
        ).unique().scalars().all()
    )
    return jobs


def serialize_jobs(db: Session, jobs: list) -> list:
    counts = _applicant_counts(db, [job.id for job in jobs])
    return [serializers.serialize_job(job, applicants_count=counts.get(job.id, 0)) for job in jobs]


def job_applicant_count(db: Session, job_id: str) -> int:
    return db.execute(
        select(func.count(Application.id)).where(Application.job_id == job_id)
    ).scalar_one()


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------

def _replace_bullets(db: Session, job: Job, payload: JobCreate | JobUpdate) -> None:
    for attribute, kind in BULLET_KINDS.items():
        values = getattr(payload, attribute, None)
        if values is None:
            continue
        # Delete-then-insert keeps ordering contiguous and the operation atomic
        # (the whole update is committed together).
        db.execute(
            JobBullet.__table__.delete().where(
                JobBullet.job_id == job.id, JobBullet.kind == kind
            )
        )
        for position, text in enumerate(values):
            db.add(JobBullet(job_id=job.id, kind=kind, position=position, text=text))


def create_job(db: Session, current: CurrentUser, payload: JobCreate) -> Job:
    if current.role != "recruiter":
        # Admins moderate; they do not act as employers without a company.
        raise ForbiddenError("Only recruiters can create job postings")
    company_id = current.company_id
    if not company_id:
        raise ForbiddenError("Your recruiter account is not linked to a company")

    now = datetime.now(timezone.utc)
    job = Job(
        title=payload.title,
        description=payload.description,
        department=payload.department,
        location=payload.location,
        workplace_type=payload.workplace_type,
        job_type=payload.job_type,
        experience_level=payload.experience_level,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
        status=payload.status,
        company_id=company_id,
        created_by=current.recruiter_profile.id if current.recruiter_profile else None,
        published_at=now if payload.status == "published" else None,
    )
    db.add(job)
    db.flush()
    _replace_bullets(db, job, payload)
    db.commit()
    db.refresh(job)
    return get_owned_job(db, job.id, current)


def update_job(db: Session, current: CurrentUser, job_id: str, payload: JobUpdate) -> Job:
    job = get_owned_job(db, job_id, current)

    data = payload.model_dump(exclude_unset=True, exclude=set(BULLET_KINDS))
    next_min = data.get("salary_min", job.salary_min)
    next_max = data.get("salary_max", job.salary_max)
    if next_max < next_min:
        raise ValidationError("salary_max must be greater than or equal to salary_min")

    for field, value in data.items():
        setattr(job, field, value)

    if "status" in data:
        if data["status"] == "published" and job.published_at is None:
            job.published_at = datetime.now(timezone.utc)

    _replace_bullets(db, job, payload)
    db.commit()
    db.refresh(job)
    return get_owned_job(db, job.id, current)


def delete_job(db: Session, current: CurrentUser, job_id: str) -> None:
    job = get_owned_job(db, job_id, current)
    db.delete(job)
    db.commit()


def set_featured(db: Session, job: Job, featured: bool) -> Job:
    job.is_featured = featured
    db.commit()
    db.refresh(job)
    return job


# ---------------------------------------------------------------------------
# Saved jobs
# ---------------------------------------------------------------------------

def list_saved_job_ids(db: Session, user_id: str) -> list[str]:
    rows = db.execute(
        select(SavedJob.job_id).where(SavedJob.user_id == user_id)
    ).scalars().all()
    return list(rows)


def list_saved_jobs(db: Session, user_id: str) -> list:
    jobs = list(
        db.execute(
            select(Job)
            .options(*_JOB_LOADERS)
            .join(SavedJob, SavedJob.job_id == Job.id)
            .where(SavedJob.user_id == user_id)
            .order_by(SavedJob.created_at.desc())
        ).unique().scalars().all()
    )
    return jobs


def remove_saved_job(db: Session, user_id: str, job_id: str) -> list[str]:
    """Remove a bookmark if present. Idempotent.

    Unlike :func:`toggle_saved_job` this never checks job visibility: a job that
    was closed or deleted after being bookmarked must still be removable.
    """
    existing = db.execute(
        select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
    ).scalar_one_or_none()
    if existing is not None:
        db.delete(existing)
        db.commit()
    return list_saved_job_ids(db, user_id)


def toggle_saved_job(db: Session, user_id: str, job_id: str) -> tuple[bool, list[str]]:
    """Toggle a bookmark. Returns ``(saved_now, all_saved_ids)``."""
    job = db.execute(select(Job).where(Job.id == job_id)).scalar_one_or_none()
    if job is None or job.status != "published":
        raise NotFoundError("Job not found")

    existing = db.execute(
        select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
    ).scalar_one_or_none()
    if existing is not None:
        db.delete(existing)
        saved = False
    else:
        db.add(SavedJob(user_id=user_id, job_id=job_id))
        saved = True
    try:
        db.commit()
    except IntegrityError:
        # Double-click race: the row already exists, which is the desired state.
        db.rollback()
        saved = True
    return saved, list_saved_job_ids(db, user_id)

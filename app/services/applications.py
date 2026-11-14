"""Application (job-application) business logic.

Every function in this module starts by proving ownership:

* candidate reads  -> filtered by ``candidate_id == current.id`` (from the token)
* recruiter reads  -> filtered by ``Job.company_id == current.company_id``
* status updates   -> same recruiter check, plus the state machine

The candidate id and company id are never parameters supplied by the client in a
form that could be spoofed; they are always ``CurrentUser`` properties resolved
from the database in :mod:`app.security.deps`.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.application import APPLICATION_STATUSES, Application, ApplicationStatusHistory
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationStatusUpdate
from app.security.deps import CurrentUser
from app.security.errors import ConflictError, NotFoundError, ValidationError

# Allowed stage transitions. Prevents "Selected -> Applied" regressions and
# arbitrary jumps that would corrupt pipeline reporting. A recruiter may still
# move a candidate back one step explicitly where it is meaningful.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "Applied": {"Shortlisted", "Interview", "Rejected"},
    "Shortlisted": {"Interview", "Rejected", "Applied"},
    "Interview": {"Selected", "Rejected", "Shortlisted"},
    "Selected": {"Interview", "Rejected"},
    "Rejected": {"Shortlisted", "Interview"},
}

_APPLICATION_LOADERS = (
    joinedload(Application.job).joinedload(Job.company),
    joinedload(Application.candidate).joinedload(User.candidate_profile),
    joinedload(Application.resume),
    selectinload(Application.status_history),
)


def _active_resume(db: Session, user_id: str) -> Optional[Resume]:
    return db.execute(
        select(Resume)
        .where(Resume.owner_id == user_id, Resume.status == "active")
        .order_by(Resume.uploaded_at.desc())
        .limit(1)
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Candidate side
# ---------------------------------------------------------------------------

def apply_to_job(
    db: Session, current: CurrentUser, job_id: str, payload: ApplicationCreate
) -> Application:
    """Submit an application as the authenticated candidate."""
    job = db.execute(
        select(Job).options(joinedload(Job.company)).where(Job.id == job_id)
    ).scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")
    if job.status != "published":
        raise ConflictError("This position is not currently accepting applications")

    existing = db.execute(
        select(Application.id).where(
            Application.candidate_id == current.id, Application.job_id == job.id
        )
    ).first()
    if existing is not None:
        raise ConflictError("You have already applied to this position")

    resume = _active_resume(db, current.id)
    if resume is None:
        raise ValidationError("Please upload a resume before applying")

    application = Application(
        candidate_id=current.id,
        job_id=job.id,
        status="Applied",
        cover_letter=payload.cover_letter,
        resume_id=resume.id,
        resume_filename=resume.filename,
    )
    db.add(application)
    try:
        db.flush()
        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                previous_status="Applied",
                new_status="Applied",
                changed_by=current.id,
            )
        )
        db.commit()
    except IntegrityError:
        # Concurrent double-submit: the unique (candidate_id, job_id) constraint
        # is the authority, not the earlier SELECT.
        db.rollback()
        raise ConflictError("You have already applied to this position")

    return get_candidate_application(db, current, application.id)


def list_candidate_applications(
    db: Session, current: CurrentUser, *, status: Optional[str] = None
) -> list[Application]:
    stmt = (
        select(Application)
        .options(*_APPLICATION_LOADERS)
        .where(Application.candidate_id == current.id)
        .order_by(Application.applied_at.desc())
    )
    if status:
        stmt = stmt.where(Application.status == status)
    return list(db.execute(stmt).unique().scalars().all())


def get_candidate_application(db: Session, current: CurrentUser, application_id: str) -> Application:
    application = db.execute(
        select(Application)
        .options(*_APPLICATION_LOADERS)
        .where(Application.id == application_id, Application.candidate_id == current.id)
    ).unique().scalar_one_or_none()
    if application is None:
        # 404 rather than 403: another candidate's application must not be
        # distinguishable from one that does not exist.
        raise NotFoundError("Application not found")
    return application


def applied_job_ids(db: Session, current: CurrentUser) -> list[str]:
    return list(
        db.execute(
            select(Application.job_id).where(Application.candidate_id == current.id)
        ).scalars().all()
    )


_COUNT_KEYS = {
    "Applied": "applied",
    "Shortlisted": "shortlisted",
    "Interview": "interview",
    "Selected": "selected",
    "Rejected": "rejected",
}


def candidate_application_counts(db: Session, current: CurrentUser) -> dict[str, int]:
    """Application counts by stage for the authenticated candidate."""
    rows = db.execute(
        select(Application.status, func.count(Application.id))
        .where(Application.candidate_id == current.id)
        .group_by(Application.status)
    ).all()
    counts = {field: 0 for field in _COUNT_KEYS.values()}
    for status, count in rows:
        field = _COUNT_KEYS.get(status)
        if field:
            counts[field] = count
    counts["total"] = sum(counts.values())
    return counts


# ---------------------------------------------------------------------------
# Recruiter side
# ---------------------------------------------------------------------------

def _recruiter_scoped_query(current: CurrentUser, db: Session):
    """Applications whose job belongs to the caller's company. Admin: all."""
    stmt = select(Application).options(*_APPLICATION_LOADERS)
    if current.role == "admin":
        return stmt
    if not current.company_id:
        raise NotFoundError("Application not found")
    return stmt.join(Job, Application.job_id == Job.id).where(
        Job.company_id == current.company_id
    )


def list_company_applications(
    db: Session,
    current: CurrentUser,
    *,
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> list[Application]:
    stmt = _recruiter_scoped_query(current, db).order_by(Application.applied_at.desc())
    if job_id:
        stmt = stmt.where(Application.job_id == job_id)
    if status:
        stmt = stmt.where(Application.status == status)
    applications = list(db.execute(stmt).unique().scalars().all())

    if search:
        needle = search.strip().lower()
        filtered = []
        for application in applications:
            profile = application.candidate.candidate_profile
            name = (profile.full_name if profile and profile.full_name else "").lower()
            email = application.candidate.email.lower()
            title = application.job.title.lower()
            if needle in name or needle in email or needle in title:
                filtered.append(application)
        return filtered
    return applications


def get_company_application(db: Session, current: CurrentUser, application_id: str) -> Application:
    application = db.execute(
        _recruiter_scoped_query(current, db).where(Application.id == application_id)
    ).unique().scalar_one_or_none()
    if application is None:
        raise NotFoundError("Application not found")
    return application


def update_application_status(
    db: Session,
    current: CurrentUser,
    application_id: str,
    payload: ApplicationStatusUpdate,
) -> Application:
    """Move an application through the pipeline.

    Authorization is re-proved here (not inherited from the router) so that a
    future endpoint that calls this function cannot bypass it.
    """
    application = get_company_application(db, current, application_id)

    if payload.status == application.status and payload.notes is None and payload.rating is None:
        return application

    if payload.status != application.status:
        allowed = ALLOWED_TRANSITIONS.get(application.status, set())
        if payload.status not in allowed:
            raise ConflictError(
                f"Cannot move an application from {application.status} to {payload.status}"
            )
        previous = application.status
        application.status = payload.status
        db.add(
            ApplicationStatusHistory(
                application_id=application.id,
                previous_status=previous,
                new_status=payload.status,
                changed_by=current.id,
            )
        )

    if payload.notes is not None:
        application.recruiter_notes = payload.notes.strip() or None
    if payload.rating is not None:
        application.rating = payload.rating

    db.commit()
    return get_company_application(db, current, application_id)


def company_pipeline_counts(db: Session, current: CurrentUser) -> dict[str, int]:
    """Pipeline counts across the caller's company's applications."""
    stmt = select(Application.status, func.count(Application.id)).group_by(Application.status)
    if current.role != "admin":
        stmt = stmt.join(Job, Application.job_id == Job.id).where(
            Job.company_id == current.company_id
        )
    rows = db.execute(stmt).all()
    counts = {field: 0 for field in _COUNT_KEYS.values()}
    for status, count in rows:
        field = _COUNT_KEYS.get(status)
        if field:
            counts[field] = count
    counts["total"] = sum(counts.values())
    return counts

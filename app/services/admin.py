"""Platform administration logic (admin role only).

The admin surface is intentionally narrow and matches the existing admin UI:
platform counters, candidate account governance, company accreditation, and job
moderation. It deliberately does **not** expose candidate phone numbers,
resumes or application contents - an administrator governs accounts, they do
not read dossiers.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.application import Application
from app.models.company import Company
from app.models.job import Job
from app.models.user import CandidateProfile, User
from app.schemas.admin import AdminMetrics
from app.security.errors import NotFoundError


def get_metrics(db: Session) -> AdminMetrics:
    total_candidates = db.execute(
        select(func.count(User.id)).where(User.role == "candidate")
    ).scalar_one()
    total_companies = db.execute(select(func.count(Company.id))).scalar_one()
    total_jobs = db.execute(select(func.count(Job.id))).scalar_one()
    active_applications = db.execute(
        select(func.count(Application.id)).where(Application.status != "Rejected")
    ).scalar_one()
    hired_total = db.execute(
        select(func.count(Application.id)).where(Application.status == "Selected")
    ).scalar_one()
    return AdminMetrics(
        total_candidates=total_candidates,
        total_companies=total_companies,
        total_jobs=total_jobs,
        active_applications=active_applications,
        hired_total=hired_total,
    )


def list_candidates(db: Session, *, search: str | None = None) -> list[dict]:
    stmt = (
        select(User)
        .options(
            joinedload(User.candidate_profile).selectinload(CandidateProfile.skills),
            selectinload(User.applications),
        )
        .where(User.role == "candidate")
        .order_by(User.created_at.desc())
    )
    users = list(db.execute(stmt).unique().scalars().all())
    results = []
    for user in users:
        profile = user.candidate_profile
        row = {
            "id": user.id,
            "email": user.email,
            "full_name": profile.full_name if profile else None,
            "headline": profile.headline if profile else None,
            "location": profile.location if profile else None,
            "skills": [s.name for s in profile.skills] if profile else [],
            "applications_count": len(user.applications),
            "is_active": user.is_active,
            "registered_date": user.created_at,
        }
        if search:
            needle = search.strip().lower()
            haystack = " ".join(
                filter(
                    None,
                    [
                        (row["full_name"] or "").lower(),
                        row["email"].lower(),
                        " ".join(row["skills"]).lower(),
                    ],
                )
            )
            if needle not in haystack:
                continue
        results.append(row)
    return results


def set_candidate_active(db: Session, user_id: str, is_active: bool) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None or user.role != "candidate":
        raise NotFoundError("Candidate not found")
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def set_company_verified(db: Session, company_id: str, is_verified: bool) -> Company:
    company = db.execute(select(Company).where(Company.id == company_id)).scalar_one_or_none()
    if company is None:
        raise NotFoundError("Company not found")
    company.is_verified = is_verified
    db.commit()
    db.refresh(company)
    return company

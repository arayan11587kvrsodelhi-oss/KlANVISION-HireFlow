"""Company business logic.

A recruiter may only read and update **their own** company. The company id is
taken from ``CurrentUser`` (resolved from the membership table), never from the
request, so ``/recruiter/company/{other_id}`` cannot exist as an attack surface.
Public company listings expose only the fields needed by the job board.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.job import Job
from app.schemas.company import CompanyUpdate
from app.security.deps import CurrentUser
from app.security.errors import NotFoundError


def _open_job_counts(db: Session, company_ids: list[str]) -> dict[str, int]:
    if not company_ids:
        return {}
    rows = db.execute(
        select(Job.company_id, func.count(Job.id))
        .where(Job.company_id.in_(company_ids), Job.status == "published")
        .group_by(Job.company_id)
    ).all()
    return {company_id: count for company_id, count in rows}


def list_companies(db: Session) -> list:
    companies = list(db.execute(select(Company).order_by(Company.name)).scalars().all())
    counts = _open_job_counts(db, [c.id for c in companies])
    return [(company, counts.get(company.id, 0)) for company in companies]


def get_public_company(db: Session, company_id: str) -> tuple[Company, int]:
    company = db.execute(select(Company).where(Company.id == company_id)).scalar_one_or_none()
    if company is None:
        raise NotFoundError("Company not found")
    counts = _open_job_counts(db, [company.id])
    return company, counts.get(company.id, 0)


def get_own_company(db: Session, current: CurrentUser) -> tuple[Company, int]:
    """The authenticated recruiter's company."""
    company_id = current.company_id
    if not company_id:
        raise NotFoundError("Your account is not linked to a company")
    contact_company_id: str = company_id
    return get_public_company(db, contact_company_id)


def update_own_company(db: Session, current: CurrentUser, payload: CompanyUpdate) -> tuple[Company, int]:
    company, count = get_own_company(db, current)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company, count

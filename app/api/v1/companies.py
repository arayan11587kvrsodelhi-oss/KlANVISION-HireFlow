"""Company endpoints.

* Public: list companies and read one company (job-board sidebar).
* Recruiter: read/update **my** company only - there is no ``{company_id}``
  parameter, so a recruiter cannot address another company at all.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.company import CompanyOut, CompanyUpdate
from app.security.deps import DbSession, RecruiterDep
from app.services import companies as company_service
from app.services.serializers import serialize_company

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut], summary="List companies")
def list_companies(db: DbSession) -> list[CompanyOut]:
    pairs = company_service.list_companies(db)
    return [serialize_company(c, open_jobs_count=n) for c, n in pairs]


@router.get("/me", response_model=CompanyOut, summary="My company (recruiter)")
def my_company(current: RecruiterDep, db: DbSession) -> CompanyOut:
    company, count = company_service.get_own_company(db, current)
    return serialize_company(company, open_jobs_count=count)


@router.patch("/me", response_model=CompanyOut, summary="Update my company (recruiter)")
def update_my_company(
    payload: CompanyUpdate, current: RecruiterDep, db: DbSession
) -> CompanyOut:
    company, count = company_service.update_own_company(db, current, payload)
    return serialize_company(company, open_jobs_count=count)


@router.get("/{company_id}", response_model=CompanyOut, summary="Company profile")
def get_company(company_id: str, db: DbSession) -> CompanyOut:
    company, count = company_service.get_public_company(db, company_id)
    return serialize_company(company, open_jobs_count=count)

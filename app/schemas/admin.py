"""Admin-only schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

AdminUserRole = Literal["candidate", "recruiter", "admin"]


class AdminMetrics(BaseModel):
    """Platform counters computed from the database."""

    total_candidates: int
    total_companies: int
    total_jobs: int
    active_applications: int
    hired_total: int


class AdminCandidateOut(BaseModel):
    """Candidate row in the admin directory.

    Intentionally excludes phone, resume and applications' content: the
    directory is for account governance, not for reading candidate dossiers.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    applications_count: int = 0
    is_active: bool
    registered_date: datetime


class AccountStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class CompanyVerificationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_verified: bool


class JobFeaturedUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    featured: bool

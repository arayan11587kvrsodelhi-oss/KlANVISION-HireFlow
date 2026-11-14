"""Job schemas.

``JobCreate``/``JobUpdate`` contain **no** ``company_id`` or ``company_name``
field: the owning company is always derived from the authenticated recruiter's
membership. The company fields that appear in ``JobOut`` are read-only.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.job import EXPERIENCE_LEVELS, JOB_STATUSES, JOB_TYPES, WORKPLACE_TYPES

WorkplaceType = Literal["Remote", "Hybrid", "On-site"]
JobType = Literal["Full-time", "Part-time", "Contract", "Internship"]
ExperienceLevel = Literal["Entry", "Mid", "Senior", "Lead", "Executive"]
JobStatus = Literal["draft", "published", "closed"]

MAX_BULLETS = 30
MAX_BULLET_LEN = 500


def _clean_bullets(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    cleaned: list[str] = []
    for raw in values:
        text = (raw or "").strip()
        if not text:
            continue
        if len(text) > MAX_BULLET_LEN:
            raise ValueError(f"each list item must be at most {MAX_BULLET_LEN} characters")
        cleaned.append(text)
    if len(cleaned) > MAX_BULLETS:
        raise ValueError(f"at most {MAX_BULLETS} list items are allowed")
    return cleaned


class _JobFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=200)
    department: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=200)
    workplace_type: WorkplaceType = "Remote"
    job_type: JobType = "Full-time"
    experience_level: ExperienceLevel = "Mid"
    salary_min: int = Field(ge=0, le=100_000_000)
    salary_max: int = Field(ge=0, le=100_000_000)
    salary_currency: str = Field(default="USD", min_length=3, max_length=3)
    description: str = Field(min_length=20, max_length=20_000)
    responsibilities: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    benefits: List[str] = Field(default_factory=list)

    @field_validator("title", "department", "location")
    @classmethod
    def _strip(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("salary_currency")
    @classmethod
    def _currency(cls, value: str) -> str:
        upper = value.upper()
        if not upper.isalpha():
            raise ValueError("salary_currency must be a 3-letter ISO code")
        return upper

    @field_validator("responsibilities", "requirements", "benefits")
    @classmethod
    def _bullets(cls, values: List[str]) -> List[str]:
        return _clean_bullets(values)

    @model_validator(mode="after")
    def _salary_order(self):
        if self.salary_max < self.salary_min:
            raise ValueError("salary_max must be greater than or equal to salary_min")
        return self


class JobCreate(_JobFields):
    """Create a job. Optionally publish immediately."""

    status: Literal["draft", "published"] = "draft"


class JobUpdate(BaseModel):
    """Partial update; only supplied fields change."""

    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    department: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=200)
    workplace_type: Optional[WorkplaceType] = None
    job_type: Optional[JobType] = None
    experience_level: Optional[ExperienceLevel] = None
    salary_min: Optional[int] = Field(default=None, ge=0, le=100_000_000)
    salary_max: Optional[int] = Field(default=None, ge=0, le=100_000_000)
    salary_currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    description: Optional[str] = Field(default=None, min_length=20, max_length=20_000)
    responsibilities: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    status: Optional[JobStatus] = None

    @field_validator("responsibilities", "requirements", "benefits")
    @classmethod
    def _bullets(cls, values: Optional[List[str]]) -> Optional[List[str]]:
        return None if values is None else _clean_bullets(values)

    @field_validator("title", "department", "location")
    @classmethod
    def _strip(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class JobStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: JobStatus


class JobOut(BaseModel):
    """Public job representation consumed by the SPA."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    company_id: str
    company_name: str
    company_logo: Optional[str] = None
    company_verified: bool = False
    location: Optional[str] = None
    workplace_type: str
    job_type: str
    experience_level: str
    salary_min: int
    salary_max: int
    salary_currency: str
    department: Optional[str] = None
    description: str
    responsibilities: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    benefits: List[str] = Field(default_factory=list)
    posted_date: datetime
    status: str
    applicants_count: int = 0
    featured: bool = False


class JobSummaryCounts(BaseModel):
    """Recruiter dashboard counters, always scoped to the caller's company."""

    total_jobs: int
    published_jobs: int
    draft_jobs: int
    closed_jobs: int
    total_applicants: int
    in_interview: int
    offers_extended: int

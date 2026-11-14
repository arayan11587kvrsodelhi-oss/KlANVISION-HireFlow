"""Candidate profile schemas.

Security note: these models carry **no** user/profile identifier fields. The
profile being read or written is always the authenticated caller's own
(``/candidates/me``), so a client cannot ask for someone else's profile.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

URL_PATTERN = re.compile(r"^https?://[^\s]{3,}$", re.IGNORECASE)
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
YEAR_PATTERN = re.compile(r"^\d{4}$")


def _optional_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not URL_PATTERN.match(value):
        raise ValueError("must be an absolute http(s) URL")
    return value


class ResumeSummary(BaseModel):
    """Metadata for the candidate's current resume (no file bytes)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    file_size: str
    uploaded_at: datetime
    download_url: str


class WorkExperienceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    location: Optional[str] = Field(default=None, max_length=200)
    start_date: str = Field(description="YYYY-MM")
    end_date: Optional[str] = Field(default=None, description="YYYY-MM")
    current: bool = False
    description: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("start_date")
    @classmethod
    def _valid_start(cls, value: str) -> str:
        if not MONTH_PATTERN.match(value):
            raise ValueError("must be in YYYY-MM format")
        return value

    @field_validator("end_date")
    @classmethod
    def _valid_end(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not MONTH_PATTERN.match(value):
            raise ValueError("must be in YYYY-MM format")
        return value

    @model_validator(mode="after")
    def _dates_consistent(self) -> "WorkExperienceIn":
        if self.current:
            self.end_date = None
        elif self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class WorkExperienceOut(WorkExperienceIn):
    id: str


class EducationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    degree: str = Field(min_length=1, max_length=200)
    field: Optional[str] = Field(default=None, max_length=200)
    institution: str = Field(min_length=1, max_length=200)
    start_year: Optional[str] = Field(default=None, max_length=10)
    end_year: Optional[str] = Field(default=None, max_length=10)
    gpa: Optional[str] = Field(default=None, max_length=20)

    @field_validator("start_year", "end_year")
    @classmethod
    def _valid_year(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not YEAR_PATTERN.match(value):
            raise ValueError("must be a four-digit year")
        return value


class EducationOut(EducationIn):
    id: str


class CandidateProfileUpdate(BaseModel):
    """Partial update of the caller's candidate profile."""

    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    headline: Optional[str] = Field(default=None, max_length=200)
    bio: Optional[str] = Field(default=None, max_length=4000)
    phone: Optional[str] = Field(default=None, max_length=30)
    location: Optional[str] = Field(default=None, max_length=200)
    website: Optional[str] = Field(default=None, max_length=200)
    github: Optional[str] = Field(default=None, max_length=200)
    linkedin: Optional[str] = Field(default=None, max_length=200)

    @field_validator("website", "github", "linkedin")
    @classmethod
    def _urls(cls, value: Optional[str]) -> Optional[str]:
        return _optional_url(value)

    @field_validator("full_name", "headline", "phone", "location")
    @classmethod
    def _strip(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SkillsUpdate(BaseModel):
    """Replace the full skill list."""

    model_config = ConfigDict(extra="forbid")

    skills: List[str] = Field(max_length=100)

    @field_validator("skills")
    @classmethod
    def _clean(cls, values: List[str]) -> List[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in values:
            skill = raw.strip()
            if not skill:
                continue
            if len(skill) > 60:
                raise ValueError("each skill must be at most 60 characters")
            key = skill.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(skill)
        return cleaned


class CandidateProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience: List[WorkExperienceOut] = Field(default_factory=list)
    education: List[EducationOut] = Field(default_factory=list)
    resume: Optional[ResumeSummary] = None
    updated_at: Optional[datetime] = None

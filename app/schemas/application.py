"""Application schemas.

``ApplicationCreate`` accepts only the *job id* plus submission content. The
candidate identity is taken from the access token, never from the body, which
removes the ability to submit an application on someone else's behalf.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ApplicationStatus = Literal["Applied", "Shortlisted", "Interview", "Selected", "Rejected"]
# Alias used in query-parameter annotations (kept distinct for readability).
StatusLiteralType = ApplicationStatus


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cover_letter: Optional[str] = Field(default=None, max_length=8000)


class ApplicationStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ApplicationStatus
    notes: Optional[str] = Field(default=None, max_length=2000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)


class StatusHistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    previous_status: str
    new_status: str
    changed_at: datetime


class ApplicationOut(BaseModel):
    """Application as seen by the candidate who owns it."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    job_title: str
    company_id: str
    company_name: str
    company_logo: Optional[str] = None
    candidate_id: str
    candidate_name: str
    candidate_email: str
    candidate_phone: Optional[str] = None
    candidate_headline: Optional[str] = None
    resume_file_name: Optional[str] = None
    resume_size: Optional[str] = None
    resume_download_url: Optional[str] = None
    cover_letter: Optional[str] = None
    applied_date: datetime
    status: str
    stage_updated_at: datetime
    notes: Optional[str] = None
    rating: Optional[int] = None
    history: List[StatusHistoryEntry] = Field(default_factory=list)


class RecruiterApplicationOut(ApplicationOut):
    """Same field set as ``ApplicationOut``.

    The fields that expose candidate contact details and recruiter notes are
    only ever populated by the recruiter-scoped endpoint, which first proves the
    application belongs to one of the caller's company's jobs.
    """


class ApplicationCounts(BaseModel):
    """Counts by stage.

    ``extra="allow"`` (default) is deliberate: the service returns the lowercase
    form matching these field names, so the model validates them directly.
    """

    applied: int = 0
    shortlisted: int = 0
    interview: int = 0
    selected: int = 0
    rejected: int = 0
    total: int = 0

    model_config = ConfigDict(extra="forbid")

"""Company schemas.

``CompanyUpdate`` deliberately excludes ``is_verified``: accreditation is an
admin-only action with its own endpoint. Any body that tries to set it is
rejected (``extra="forbid"``) rather than silently ignored.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMPLOYEE_COUNT_OPTIONS = (
    "1 - 10",
    "10 - 50",
    "50 - 150",
    "150 - 500",
    "500 - 1000",
    "1000+",
)


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    website: Optional[str] = Field(default=None, max_length=200)
    industry: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=200)
    employee_count: Optional[str] = Field(default=None, max_length=40)

    @field_validator("website")
    @classmethod
    def _website(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not value.startswith(("http://", "https://")):
            raise ValueError("website must start with http:// or https://")
        return value

    @field_validator("employee_count")
    @classmethod
    def _employees(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        return value


class CompanyOut(BaseModel):
    """Public company view."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    employee_count: Optional[str] = None
    logo: Optional[str] = None
    is_verified: bool = False
    open_jobs_count: int = 0
    created_at: datetime

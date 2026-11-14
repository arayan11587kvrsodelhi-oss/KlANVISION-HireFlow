"""Pydantic v2 schemas for authentication and identity."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Deliberately no dependency on ``email-validator``: a conservative pattern is
# enough to reject malformed input, and the real authority on whether an address
# works is delivery, not a client-side regex.
EMAIL_PATTERN = re.compile(
    r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r"@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$"
)


def _clean_email(value: str) -> str:
    email = value.strip()
    if len(email) > 254 or not EMAIL_PATTERN.match(email):
        raise ValueError("invalid email address")
    return email.lower()

UserRole = Literal["candidate", "recruiter", "admin"]

# Public registration may only create candidate or recruiter accounts. Admin
# accounts are created by an operator with the CLI bootstrap command.
PublicRole = Literal["candidate", "recruiter"]


class Token(BaseModel):
    """Access token plus the metadata the SPA needs."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")


class LoginRequest(BaseModel):
    """Login credentials."""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _clean_email(value)


class RegisterRequest(BaseModel):
    """Public registration request.

    ``role`` may be candidate or recruiter; ``company_name`` is required for
    recruiters and is used to create their company on the server.
    """

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _clean_email(value)
    role: PublicRole = "candidate"
    company_name: Optional[str] = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _validate_password_and_company(self) -> "RegisterRequest":
        if len(self.password.encode("utf-8")) > 72:
            # bcrypt only considers the first 72 bytes; reject rather than
            # silently truncating so two different passwords cannot collide.
            raise ValueError("Password must be at most 72 bytes long")
        if not any(char.isdigit() for char in self.password) or not any(
            char.isalpha() for char in self.password
        ):
            raise ValueError("Password must contain both letters and numbers")
        # Strip surrounding whitespace from the display values.
        self.full_name = self.full_name.strip()
        if not self.full_name:
            raise ValueError("full_name must not be blank")
        if self.role == "recruiter":
            if not self.company_name or not self.company_name.strip():
                raise ValueError("company_name is required for recruiter accounts")
            self.company_name = self.company_name.strip()
        else:
            self.company_name = None
        return self


class RegisterResponse(BaseModel):
    """Registration result. Registration does not sign the user in."""

    user_id: str
    email: str
    role: PublicRole
    message: str = "Account created. Please sign in."


class MeResponse(BaseModel):
    """The authenticated caller, resolved from the database on every request."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    full_name: Optional[str] = None
    # Derived server-side from the recruiter's membership. Clients must treat
    # this as read-only; it is never accepted back as input.
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    created_at: datetime


class PasswordChangeRequest(BaseModel):
    """Self-service password change."""

    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _passwords_match(self) -> "PasswordChangeRequest":
        if self.new_password != self.confirm_new_password:
            raise ValueError("New passwords do not match")
        if self.new_password == self.current_password:
            raise ValueError("New password must differ from the current password")
        return self

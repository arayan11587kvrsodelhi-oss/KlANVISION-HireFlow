"""HireFlow Pydantic v2 schemas for authentication."""

from __future__ import annotations

from typing import Optional, Literal

from pydantic import BaseModel, Field, validator


UserRole = Literal["candidate", "recruiter", "admin"]


class Token(BaseModel):
    """Response schema for authentication tokens."""
    access_token: str = Field(..., description="HTTP-only cookie secure access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(
        default=30, description="Minutes until access token expires"
    )


class LoginRequest(BaseModel):
    """Login request schema."""
    email: str = Field(..., max_length=254, description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    remember: Optional[bool] = Field(
        default=False, description="Remember me for extended session"
    )

    @validator("email")
    def validate_email_format(cls, v: str) -> str:
        """Basic email format validation."""
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v


class RegisterRequest(BaseModel):
    """Candidate registration request schema."""
    email: str = Field(
        ..., max_length=254, description="User email address", example="candidate@example.com"
    )
    password: str = Field(
        ..., min_length=8, max_length=128, description="User password"
    )
    full_name: Optional[str] = Field(
        None, max_length=200, description="Candidate's full name"
    )
    role: UserRole = Field(
        default="candidate",
        description="User role (candidate by default, recruiters apply separately)",
    )

    @validator("email")
    def validate_email_format(cls, v: str) -> str:
        """Basic email format validation."""
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v


class RegisterResponse(BaseModel):
    """Registration response schema."""
    user_id: str = Field(..., description=" newly created user UUID")
    email: str = Field(..., description="Registered email address")
    role: UserRole = Field(..., description="Assigned user role")
    message: str = Field(
        ..., description="Confirmation message"
    )


class MeResponse(BaseModel):
    """Current user response schema."""
    id: str = Field(..., description="User UUID")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    is_active: bool = Field(..., description="Whether the user account is active")
    is_verified: bool = Field(
        False, description="Whether the user email is verified"
    )
    full_name: Optional[str] = Field(
        None, max_length=200, description="User's full name (if candidate profile)"
    )


class CSRFToken(BaseModel):
    """CSRF synchronizer token response/schema."""
    csrf_token: str = Field(
        ..., description="CSRF token value for state-changing requests"
    )


class PasswordChangeRequest(BaseModel):
    """Password change request schema."""
    current_password: str = Field(
        ..., min_length=8, description="Current user password"
    )
    new_password: str = Field(
        ..., min_length=8, max_length=128, description="New user password"
    )
    confirm_new_password: str = Field(
        ..., min_length=8, max_length=128,
        description="Confirm new user password"
    )

    @validator("confirm_new_password")
    def passwords_match(cls, v: str, values) -> str:
        """Validate that new passwords match."""
        if values and "new_password" in values.data:
            if v != values.data["new_password"]:
                raise ValueError("Passwords do not match")
        return v
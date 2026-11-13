"""Application configuration using pydantic-settings.

Loads environment variables from `.env` file and provides typed settings
for the FastAPI application. Never hardcodes credentials or secrets.
"""

import os
from typing import List

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All values are read from environment variables with sensible defaults.
    Sensitive values should never be committed to version control.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Allow extra env vars for flexibility
    )

    # Database configuration
    NEON_DSN: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/hrflow",
        description="Neon PostgreSQL connection string",
    )

    # Security configuration
    SECRET_KEY: str = Field(
        default="change-me-in-production",
        description="Secret key for JWT signing (256-bit minimum)",
    )
    BCRYPT_COST: int = Field(
        default=12,
        description="Bcrypt cost factor for password hashing (8-31)",
        ge=8,
        le=31,
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=15,
        description="Access token lifetime in minutes",
        gt=0,
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30,
        description="Refresh token lifetime in days",
        gt=0,
    )

    # CORS configuration
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:5173"],
        description="Allowed CORS origins for frontend",
    )

    # Environment
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: development, staging, production",
    )

    # Rate limiting
    RATE_LIMIT_PER_MIN: int = Field(
        default=100,
        description="General rate limit per minute",
        gt=0,
    )
    RATE_LIMIT_AUTH_PER_MIN: int = Field(
        default=5,
        description="Auth rate limit per minute",
        gt=0,
    )

    # S3 resume storage configuration
    S3_ENDPOINT: str = Field(
        default="https://s3.us-east-1.amazonaws.com",
        description="S3-compatible storage endpoint",
    )
    S3_BUCKET: str = Field(
        default="hireflow-resumes",
        description="S3 bucket name for resume storage",
    )
    S3_ACCESS_KEY_ID: SecretStr = Field(
        default="",
        description="S3 access key ID",
    )
    S3_SECRET_ACCESS_KEY: SecretStr = Field(
        default="",
        description="S3 secret access key",
    )

    # CSRF configuration
    CSRF_COOKIE_NAME: str = Field(
        default="csrf_token",
        description="Name of the CSRF cookie",
    )

    # Admin user (created on first run)
    ADMIN_EMAIL: str = Field(
        default="admin@hireflow.local",
        description="Initial admin email address",
    )
    ADMIN_PASSWORD: str = Field(
        default="admin-change-me-immediately",
        description="Initial admin password (change after first login)",
    )

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"


# Singleton instance
settings = Settings()


def get_settings() -> Settings:
    """Get the application settings instance.

    Returns:
        Settings: The singleton settings object.
    """
    return settings
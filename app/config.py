
"""Application configuration using pydantic-settings.

Loads environment variables from `.env` file and provides typed settings
for the FastAPI application. Never hardcodes credentials or secrets.

Production safety: secrets have no usable default. The application refuses
to boot in a non-development environment when SECRET_KEY is missing, too
short, or still set to a placeholder value.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that must never be used to sign production tokens.
_INSECURE_SECRET_VALUES = {
    "change-me-in-production",
    "your-256-bit-secret-key-here-minimum-32-characters",
    "secret",
    "changeme",
    "change-me-generate-with-python-secrets",
}


def _is_insecure_secret(value: str) -> bool:
    """True when a value is a placeholder, padded or not."""
    lowered = value.lower()
    if lowered in _INSECURE_SECRET_VALUES:
        return True

    return any(
        phrase in lowered
        for phrase in _INSECURE_SECRET_VALUES
        if len(phrase) >= 8
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
        enable_decoding=False,
    )

    # ------------------------------------------------------------------
    # Database configuration
    # ------------------------------------------------------------------
    NEON_DSN: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/hrflow",
        description="PostgreSQL connection string (postgresql+psycopg://...)",
    )
    DB_POOL_SIZE: int = Field(default=5, gt=0, description="Connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=10, ge=0, description="Pool overflow")
    DB_POOL_RECYCLE_SECONDS: int = Field(
        default=300,
        gt=0,
        description="Recycle connections before managed Postgres drops them",
    )
    DB_ECHO: bool = Field(default=False, description="Echo SQL statements")

    # ------------------------------------------------------------------
    # Security configuration
    # ------------------------------------------------------------------
    SECRET_KEY: Optional[str] = Field(
        default=None,
        description="Secret key for JWT signing (256-bit minimum). Required outside development.",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    JWT_ISSUER: str = Field(default="hireflow-api", description="JWT issuer claim")
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
        le=120,
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30,
        description="Refresh token lifetime in days",
        gt=0,
        le=365,
    )
    REFRESH_COOKIE_SAMESITE: str = Field(default="lax")
    REFRESH_COOKIE_SECURE: Optional[bool] = Field(
        default=None,
        description="Force the Secure flag on the refresh cookie (defaults to non-development)",
    )
    REFRESH_COOKIE_NAME: str = Field(default="hireflow_refresh")

    # ------------------------------------------------------------------
    # CORS configuration
    # ------------------------------------------------------------------
    CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        description="Allowed CORS origins for the frontend",
    )

    # ------------------------------------------------------------------
    # Environment
    # ------------------------------------------------------------------
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: development, staging, production",
    )

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------
    RATE_LIMIT_PER_MIN: int = Field(
        default=240,
        description="General authenticated request budget per minute",
        gt=0,
    )
    RATE_LIMIT_AUTH_PER_MIN: int = Field(
        default=10,
        description="Login/registration attempts per minute per client IP",
        gt=0,
    )

    # ------------------------------------------------------------------
    # Resume storage
    # ------------------------------------------------------------------
    RESUME_STORAGE_DIR: str = Field(
        default="var/resumes",
        description="Directory used to store uploaded resume files",
    )
    RESUME_MAX_BYTES: int = Field(
        default=10 * 1024 * 1024,
        description="Maximum accepted resume size in bytes",
        gt=0,
    )
    S3_ENDPOINT: str = Field(
        default="https://s3.us-east-1.amazonaws.com",
        description="S3-compatible storage endpoint",
    )
    S3_BUCKET: str = Field(
        default="hireflow-resumes",
        description="S3 bucket name for resume storage",
    )
    S3_ACCESS_KEY_ID: SecretStr = Field(default="", description="S3 access key ID")
    S3_SECRET_ACCESS_KEY: SecretStr = Field(
        default="",
        description="S3 secret access key",
    )

    # ------------------------------------------------------------------
    # Admin bootstrap
    # ------------------------------------------------------------------
    ADMIN_EMAIL: str = Field(
        default="admin@hireflow.local",
        description="Email used by the optional admin bootstrap command",
    )
    ADMIN_PASSWORD: Optional[SecretStr] = Field(
        default=None,
        description="Password used by the optional admin bootstrap command",
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("ENVIRONMENT")
    @classmethod
    def _validate_environment(cls, value: str) -> str:
        """Accept only explicitly supported environment names."""
        allowed = {"development", "staging", "production"}
        normalized = value.strip().lower()

        if normalized not in allowed:
            raise ValueError(
                f"ENVIRONMENT must be one of {sorted(allowed)}"
            )

        return normalized

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Accept a comma-separated string as well as a JSON list."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                return value
            return [item.strip() for item in raw.split(",") if item.strip()]
        return value

    @field_validator("REFRESH_COOKIE_SAMESITE")
    @classmethod
    def _validate_samesite(cls, value: str) -> str:
        allowed = {"lax", "strict", "none"}
        lowered = value.lower()

        if lowered not in allowed:
            raise ValueError(
                f"REFRESH_COOKIE_SAMESITE must be one of {sorted(allowed)}"
            )

        return lowered

    @model_validator(mode="after")
    def _enforce_production_secrets(self) -> "Settings":
        is_dev = self.ENVIRONMENT == "development"

        if not is_dev:
            if self.SECRET_KEY and _is_insecure_secret(self.SECRET_KEY):
                raise ValueError(
                    "SECRET_KEY is set to a placeholder value; generate a unique secret"
                )

            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to at least 32 characters outside development"
                )

            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "Wildcard CORS origin is not allowed outside development"
                )

        if (
            self.REFRESH_COOKIE_SAMESITE == "none"
            and not self.refresh_cookie_secure
        ):
            raise ValueError(
                "SameSite=None requires a Secure refresh cookie; "
                "set REFRESH_COOKIE_SECURE=true"
            )

        return self

    # ------------------------------------------------------------------
    # Derived helpers
    # ------------------------------------------------------------------
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"

    @property
    def signing_key(self) -> str:
        """Return the JWT signing key.

        The fallback is for local development only.
        """
        if self.SECRET_KEY:
            return self.SECRET_KEY

        return "hireflow-development-only-signing-key-please-set-SECRET_KEY"

    @property
    def refresh_cookie_secure(self) -> bool:
        if self.REFRESH_COOKIE_SECURE is not None:
            return self.REFRESH_COOKIE_SECURE

        return not self.is_development


@lru_cache
def get_settings() -> Settings:
    """Get the application settings instance (cached per process)."""
    return Settings()


settings = get_settings()

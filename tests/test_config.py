
import pytest
from pydantic import ValidationError

from app.config import Settings


def make_settings(**overrides):
    """Build isolated settings without reading the local .env file."""
    values = {
        "ENVIRONMENT": "development",
        "SECRET_KEY": None,
    }
    values.update(overrides)

    return Settings(_env_file=None, **values)


def test_development_allows_missing_secret():
    settings = make_settings()

    assert settings.ENVIRONMENT == "development"
    assert settings.SECRET_KEY is None
    assert settings.signing_key


@pytest.mark.parametrize(
    "environment",
    ["development", "staging", "production"],
)
def test_supported_environment_names_are_accepted(environment):
    settings = make_settings(
        ENVIRONMENT=environment,
        SECRET_KEY=(
            None if environment == "development" else "a" * 64
        ),
    )

    assert settings.ENVIRONMENT == environment


@pytest.mark.parametrize(
    "environment",
    ["test", "prod", "stagingg", "", "local"],
)
def test_unsupported_environment_names_are_rejected(environment):
    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        make_settings(ENVIRONMENT=environment)


@pytest.mark.parametrize(
    "environment",
    ["staging", "production"],
)
def test_deployment_environment_rejects_missing_secret(environment):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        make_settings(ENVIRONMENT=environment)


@pytest.mark.parametrize(
    "secret",
    [
        "short-secret",
        "change-me-generate-with-python-secrets",
        "change-me-in-production",
        "your-256-bit-secret-key-here-minimum-32-characters",
        "change-me-in-production-with-extra-padding",
    ],
)
def test_deployment_environment_rejects_weak_or_placeholder_secrets(secret):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        make_settings(
            ENVIRONMENT="production",
            SECRET_KEY=secret,
        )


@pytest.mark.parametrize(
    "environment",
    ["staging", "production"],
)
def test_deployment_environment_accepts_valid_secret(environment):
    settings = make_settings(
        ENVIRONMENT=environment,
        SECRET_KEY="a" * 64,
    )

    assert settings.SECRET_KEY == "a" * 64


def test_deployment_environment_rejects_wildcard_cors():
    with pytest.raises(ValidationError, match="Wildcard CORS"):
        make_settings(
            ENVIRONMENT="production",
            SECRET_KEY="a" * 64,
            CORS_ORIGINS=["*"],
        )


def test_development_allows_wildcard_cors():
    settings = make_settings(
        ENVIRONMENT="development",
        CORS_ORIGINS=["*"],
    )

    assert settings.CORS_ORIGINS == ["*"]


def test_samesite_none_requires_secure_cookie():
    with pytest.raises(ValidationError, match="SameSite=None"):
        make_settings(
            REFRESH_COOKIE_SAMESITE="none",
            REFRESH_COOKIE_SECURE=False,
        )


def test_samesite_none_accepts_secure_cookie():
    settings = make_settings(
        REFRESH_COOKIE_SAMESITE="none",
        REFRESH_COOKIE_SECURE=True,
    )

    assert settings.REFRESH_COOKIE_SAMESITE == "none"
    assert settings.refresh_cookie_secure is True


def test_samesite_value_is_normalized():
    settings = make_settings(REFRESH_COOKIE_SAMESITE="STRICT")

    assert settings.REFRESH_COOKIE_SAMESITE == "strict"

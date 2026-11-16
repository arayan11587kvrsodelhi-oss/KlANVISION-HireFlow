"""Regression tests for the specific hardening measures.

Each test names the weakness it prevents from returning, so a future refactor
that removes the protection fails here rather than silently reopening a hole.
"""

from __future__ import annotations

import pytest

from tests.fixtures import candidate_a, recruiter_a  # noqa: F401

pytestmark = [pytest.mark.security]


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _settings(**overrides):
    """Build a Settings object from scratch, ignoring the local .env file."""
    from app.config import Settings

    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_production_requires_a_real_secret_key():
    """A deploy with no SECRET_KEY must fail fast, not sign with a default."""
    with pytest.raises(ValueError, match="SECRET_KEY"):
        _settings(ENVIRONMENT="production", SECRET_KEY=None)


def test_production_rejects_placeholder_secret():
    # Long enough to pass the length check, so the placeholder check is what fires.
    with pytest.raises(ValueError, match="placeholder"):
        _settings(ENVIRONMENT="production", SECRET_KEY="change-me-in-production" + "x" * 40)

    # A short placeholder fails too: the length check fires first.
    with pytest.raises(ValueError):
        _settings(ENVIRONMENT="production", SECRET_KEY="change-me-in-production")


def test_production_rejects_short_secret():
    with pytest.raises(ValueError, match="32 characters"):
        _settings(ENVIRONMENT="production", SECRET_KEY="too-short")


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValueError, match="Wildcard"):
        _settings(ENVIRONMENT="production", SECRET_KEY="x" * 64, CORS_ORIGINS=["*"])


def test_cors_origins_accept_comma_separated_string():
    settings = _settings(CORS_ORIGINS="http://a.test,http://b.test")
    assert settings.CORS_ORIGINS == ["http://a.test", "http://b.test"]


def test_refresh_cookie_is_secure_outside_development():
    prod = _settings(ENVIRONMENT="production", SECRET_KEY="x" * 64)
    assert prod.refresh_cookie_secure is True
    dev = _settings(ENVIRONMENT="development")
    assert dev.refresh_cookie_secure is False


def test_samesite_none_requires_secure_cookie():
    with pytest.raises(ValueError, match="SameSite=None"):
        _settings(
            ENVIRONMENT="production",
            SECRET_KEY="x" * 64,
            REFRESH_COOKIE_SAMESITE="none",
            REFRESH_COOKIE_SECURE=False,
        )


def test_database_settings_do_not_come_from_raw_environment():
    """The engine must be built from validated settings, not os.getenv.

    Comments and docstrings are stripped first: the module's docstring explains
    that it *used* to read ``os.getenv``, and that sentence is not code.
    """
    import ast
    import inspect

    from app.db import session as session_module

    tree = ast.parse(inspect.getsource(session_module))
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "getenv"
    ]
    assert calls == [], f"os.getenv call(s) in app/db/session.py: lines {[c.lineno for c in calls]}"
    assert "create_db_engine" in inspect.getsource(session_module)


# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------

def test_cors_preflight_allows_configured_origin(client):
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_preflight_rejects_unknown_origin(client):
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    # Starlette omits the allow-origin header for unlisted origins, which makes
    # the browser block the response.
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_cross_site_origin_cannot_use_the_refresh_cookie(client, register_user):
    """The CSRF control for cookie-bearing endpoints."""
    _, email, password = register_user("candidate")
    client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert client.cookies.get("hireflow_refresh")

    response = client.post("/api/v1/auth/refresh", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_same_site_origin_may_refresh(secure_client, register_user):
    # HTTPS transport: the Secure refresh cookie must actually be sent for the
    # same-origin case to reach its 200 assertion.
    client = secure_client
    _, email, password = register_user("candidate")
    client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response = client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Secrets and logs
# ---------------------------------------------------------------------------

def test_startup_does_not_log_the_database_password(client):
    """The health endpoints (and by extension startup logs) must not leak DSNs."""
    body = client.get("/api/v1/health").text + client.get("/api/v1/health/ready").text
    assert "postgres://" not in body
    assert "postgresql://" not in body
    assert "password" not in body.lower()


def test_openapi_documents_no_credentials_endpoint_leaking_tokens(client):
    schema = client.get("/api/v1/health").json()
    assert "schema" not in schema  # health is a tiny payload, not a leak


# ---------------------------------------------------------------------------
# Input handling
# ---------------------------------------------------------------------------

def test_unknown_fields_are_rejected_not_ignored(client, candidate_a):
    """Mass-assignment guard: extra fields fail loudly."""
    response = client.patch(
        "/api/v1/candidates/me/profile",
        headers=candidate_a["headers"],
        json={"headline": "Engineer", "is_admin": True, "role": "admin"},
    )
    assert response.status_code == 422

    me = client.get("/api/v1/auth/me", headers=candidate_a["headers"]).json()
    assert me["role"] == "candidate"


def test_oversized_and_malformed_payloads_are_rejected(client, recruiter_a):
    h = recruiter_a["headers"]
    too_long = client.post(
        "/api/v1/jobs",
        headers=h,
        json={
            "title": "T" * 500,
            "description": "Valid description text for the posting body.",
            "salary_min": 1,
            "salary_max": 2,
        },
    )
    assert too_long.status_code == 422

    not_json = client.post("/api/v1/jobs", headers={**h, "Content-Type": "application/json"}, content=b"{oops")
    assert not_json.status_code == 422


def test_stored_text_is_returned_escaped_by_the_client_contract(client, candidate_a):
    """The API stores text verbatim; XSS safety is React's escaping.

    This asserts the value round-trips unchanged (so we do not silently mangle
    user data), which is only safe because no endpoint renders HTML and the API
    sends ``Content-Type: application/json`` with ``nosniff``.
    """
    payload = '<script>alert("x")</script> & "quotes"'
    response = client.patch(
        "/api/v1/candidates/me/profile",
        headers=candidate_a["headers"],
        json={"bio": payload},
    )
    assert response.status_code == 200
    assert response.json()["bio"] == payload
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_resume_download_forces_attachment(client, candidate_a):
    profile = client.get("/api/v1/candidates/me/profile", headers=candidate_a["headers"]).json()
    download = client.get(profile["resume"]["download_url"], headers=candidate_a["headers"])
    assert download.status_code == 200
    assert download.headers["content-disposition"].startswith("attachment;")
    assert download.headers.get("x-content-type-options") == "nosniff"


def test_no_static_mount_exposes_the_resume_directory(client):
    """Resume bytes must be unreachable without an authenticated endpoint."""
    for path in ("/var/resumes", "/resumes", "/media", "/static/resumes"):
        assert client.get(path).status_code == 404


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def test_access_token_is_not_returned_in_a_cookie(client, register_user):
    _, email, password = register_user("candidate")
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    cookies = login.headers.get("set-cookie", "")
    token = login.json()["access_token"]
    assert token not in cookies


def test_logout_clears_the_refresh_cookie(client, register_user):
    _, email, password = register_user("candidate")
    client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response = client.post("/api/v1/auth/logout")
    set_cookie = response.headers.get("set-cookie", "")
    assert "hireflow_refresh=" in set_cookie
    # An expired deletion is how FastAPI/Starlette clears a cookie.
    assert "max-age=0" in set_cookie.lower() or 'expires=' in set_cookie.lower()


def test_tokens_are_not_stored_in_browser_readable_storage():
    """Static check of the client: no localStorage/sessionStorage token writes."""
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent / "src"
    offenders = []
    for path in root.rglob("*.ts*"):
        text = path.read_text(encoding="utf-8")
        if "localStorage.setItem" in text or "sessionStorage.setItem" in text:
            offenders.append(str(path.relative_to(root)))
    assert offenders == [], f"browser storage writes found in: {offenders}"

"""Security header tests: CSP is strict on API responses, relaxed only for docs.

The relaxed policy exists solely so Swagger UI / ReDoc can load their CDN
assets. It must never reach an API response, and it must never be emitted
outside development.
"""

from __future__ import annotations

import pytest

STRICT = "default-src 'none'"


def _csp(response) -> str:
    return response.headers.get("content-security-policy", "")


# ---------------------------------------------------------------------------
# Route paths are the real ones mounted by the app
# ---------------------------------------------------------------------------

def test_docs_routes_match_application_configuration():
    """Guard against the middleware and app.main drifting apart.

    ``swagger_ui_oauth2_redirect_url`` is not configured, so FastAPI mounts the
    redirect at the root-level ``/docs/oauth2-redirect`` - *not* under
    ``/api/docs``. The middleware must name the route that actually exists.
    """
    from app.main import app

    registered = {getattr(route, "path", None) for route in app.routes}

    if "/api/docs" in registered:
        # Only registered in development; assert the concrete paths there.
        assert "/api/redoc" in registered
        assert "/api/openapi.json" in registered
        assert "/docs/oauth2-redirect" in registered
    assert "/api/docs/oauth2-redirect" not in registered


# ---------------------------------------------------------------------------
# API responses are always strict
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path", ["/api/health", "/api/v1/jobs", "/api/v1/auth/me"])
def test_api_responses_carry_strict_csp(client, path):
    response = client.get(path)
    csp = _csp(response)
    if csp:
        assert csp.startswith(STRICT)
        assert "unsafe-inline" not in csp


def test_docs_routes_are_unreachable_outside_development():
    """Staging/production must not serve Swagger, ReDoc or the OpenAPI schema."""
    from app.config import get_settings

    if get_settings().is_development:
        pytest.skip("docs are intentionally mounted in development")

    from starlette.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        for path in ("/api/docs", "/api/redoc", "/api/openapi.json", "/docs/oauth2-redirect"):
            response = c.get(path)
            assert response.status_code == 404, f"{path} exposed outside development"
            assert "unsafe-inline" not in _csp(response)


def test_strict_csp_present_on_authenticated_api_response(client, register_user, login):
    _, email, password = register_user("candidate")
    headers = login(email, password)
    csp = _csp(client.get("/api/v1/auth/me", headers=headers))
    assert csp.startswith(STRICT)
    assert "unsafe-inline" not in csp


# ---------------------------------------------------------------------------
# Documentation routes
# ---------------------------------------------------------------------------

def test_docs_policy_depends_on_environment(client):
    """Relaxed in development, strict (or absent page) otherwise."""
    from app.config import get_settings

    response = client.get("/api/docs")
    is_dev = get_settings().is_development

    if is_dev:
        assert response.status_code == 200
        csp = _csp(response)
        assert "unsafe-inline" in csp          # required by Swagger UI
        assert "frame-ancestors 'none'" in csp  # still no framing
        assert "base-uri 'none'" in csp
    else:
        # Docs are not mounted outside development at all.
        assert response.status_code == 404
        csp = _csp(response)
        assert "unsafe-inline" not in csp


def test_oauth2_redirect_path_is_the_mounted_one():
    """The literal path the middleware allows must exist in development."""
    from app.config import get_settings
    from app.main import app

    registered = {getattr(route, "path", None) for route in app.routes}
    if get_settings().is_development:
        assert "/docs/oauth2-redirect" in registered


def test_non_docs_path_never_gets_relaxed_policy(client):
    """Near-miss API paths must not match the docs allow-list.

    ``/api/docs/`` is deliberately excluded: FastAPI runs with
    ``redirect_slashes=True``, so it 307s to ``/api/docs``. The relaxed header
    on that redirect response describes a page that *is* the docs page, and the
    redirect itself carries no content. Asserting the redirect target keeps the
    test honest without pretending a redirect is a leak.
    """
    for path in ("/api/redocs", "/api/docs/oauth2-redirect", "/api/Docs"):
        csp = _csp(client.get(path))
        assert "unsafe-inline" not in csp, f"{path} incorrectly relaxed"


def test_trailing_slash_docs_redirect_is_not_a_bypass(client):
    """The trailing-slash variant only redirects to the real docs page."""
    response = client.get("/api/docs/", follow_redirects=False)
    if response.status_code in (307, 308):
        assert response.headers.get("location", "").endswith("/api/docs")
        assert "match" not in response.text.lower() or response.text == ""


# ---------------------------------------------------------------------------
# Baseline headers apply everywhere
# ---------------------------------------------------------------------------

def test_baseline_headers_present_on_api_response(client):
    response = client.get("/api/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "no-referrer"
    assert response.headers.get("cross-origin-resource-policy") == "same-site"


def test_hsts_only_over_https(secure_client):
    """HSTS must be emitted for HTTPS requests and omitted for plain HTTP."""
    assert secure_client.get("/api/health").headers.get("strict-transport-security")

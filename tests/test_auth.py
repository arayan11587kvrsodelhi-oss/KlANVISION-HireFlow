"""Authentication lifecycle: registration, login, refresh, logout, passwords."""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


def _email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def test_register_candidate_creates_profile(client, app_session):
    from app.models.user import CandidateProfile, User

    email = _email("cand")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Ada Lovelace", "role": "candidate"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == email
    assert body["role"] == "candidate"
    assert "password" not in response.text

    user = app_session.query(User).filter_by(email=email).one()
    assert user.hashed_password != "Password123"
    assert user.hashed_password.startswith("$2")  # bcrypt
    assert app_session.query(CandidateProfile).filter_by(user_id=user.id).one().full_name == "Ada Lovelace"


def test_register_recruiter_creates_company_and_owner_membership(client, app_session):
    from app.models.company import Company, RecruiterCompanyMembership
    from app.models.user import RecruiterProfile, User

    email = _email("rec")
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123",
            "full_name": "Grace Hopper",
            "role": "recruiter",
            "company_name": "Compiler Corp",
        },
    )
    assert response.status_code == 201, response.text

    user = app_session.query(User).filter_by(email=email).one()
    profile = app_session.query(RecruiterProfile).filter_by(user_id=user.id).one()
    membership = app_session.query(RecruiterCompanyMembership).filter_by(recruiter_id=profile.id).one()
    assert membership.role == "owner"
    company = app_session.query(Company).filter_by(id=membership.company_id).one()
    assert company.name == "Compiler Corp"
    assert company.is_verified is False  # never self-verified


def test_register_duplicate_email_is_conflict(client, register_user):
    _, email, _ = register_user("candidate")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Copy Cat"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_email_uniqueness_is_case_insensitive(client, register_user):
    _, email, _ = register_user("candidate")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email.upper(), "password": "Password123", "full_name": "Upper"},
    )
    assert response.status_code == 409


def test_register_recruiter_requires_company_name(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": _email(), "password": "Password123", "full_name": "No Co", "role": "recruiter"},
    )
    assert response.status_code == 422


def test_cannot_self_register_as_admin(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": _email(), "password": "Password123", "full_name": "Sneaky", "role": "admin"},
    )
    assert response.status_code == 422


def test_register_does_not_create_a_session(client, app_session):
    from app.models.user import RefreshToken

    email = _email()
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "No Session"},
    )
    assert response.status_code == 201
    assert client.get("/api/v1/auth/me").status_code == 401
    assert app_session.query(RefreshToken).count() == 0


@pytest.mark.parametrize(
    "password",
    ["short1", "alllettersonly", "1234567890", ""],
    ids=["too-short", "no-digit", "no-letter", "empty"],
)
def test_register_rejects_weak_passwords(client, password):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": _email(), "password": password, "full_name": "Weak"},
    )
    assert response.status_code == 422, (password, response.text)


def test_register_rejects_overlong_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": _email(), "password": "a1" * 40, "full_name": "Long"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("email", ["not-an-email", "a@b", "@example.com", "user@"])
def test_register_rejects_malformed_email(client, email):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Bad Email"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_returns_access_token_and_http_only_cookie(client, register_user):
    _, email, password = register_user("candidate")
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0

    cookie_header = response.headers.get("set-cookie", "")
    assert "hireflow_refresh=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "Path=/api/v1/auth" in cookie_header


def test_login_is_case_insensitive_on_email(client, register_user):
    _, email, password = register_user("candidate")
    response = client.post("/api/v1/auth/login", json={"email": email.upper(), "password": password})
    assert response.status_code == 200


def test_login_wrong_password_and_unknown_email_are_indistinguishable(client, register_user):
    _, email, _ = register_user("candidate")
    wrong = client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPass123"})
    unknown = client.post("/api/v1/auth/login", json={"email": _email(), "password": "WrongPass123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_login_response_never_contains_secrets(client, register_user):
    _, email, password = register_user("candidate")
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    text = response.text.lower()
    for forbidden in ("hashed_password", "$2b$", "password\"", "secret", password.lower()):
        assert forbidden not in text


def test_suspended_account_cannot_log_in(client, app_session, register_user):
    from sqlalchemy import update

    from app.models.user import User

    user_id, email, password = register_user("candidate")
    app_session.execute(update(User).where(User.id == user_id).values(is_active=False))
    app_session.commit()

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json()["code"] == "account_suspended"


# ---------------------------------------------------------------------------
# Refresh / logout
# ---------------------------------------------------------------------------

def test_refresh_rotates_token_and_old_cookie_is_rejected(client, register_user):
    _, email, password = register_user("candidate")
    first = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    first_cookie = first.cookies.get("hireflow_refresh")
    assert first_cookie

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    new_cookie = refreshed.cookies.get("hireflow_refresh")
    assert new_cookie and new_cookie != first_cookie

    # Replaying the consumed token is treated as theft and kills the family.
    # The consumed token is therefore restored explicitly to the client cookie
    # jar, so the next request sends it as a replay. (Starlette deprecates
    # per-request `cookies=`, so the jar is the supported way to set it.)
    client.cookies.set("hireflow_refresh", first_cookie)
    replay = client.post("/api/v1/auth/refresh")
    assert replay.status_code == 401

    # The family is now revoked, so even the newest cookie is dead.
    after_theft = client.post("/api/v1/auth/refresh")
    assert after_theft.status_code == 401


def test_refresh_without_cookie_is_unauthorised(client):
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_refresh_with_forged_cookie_is_unauthorised(client):
    client.cookies.set("hireflow_refresh", "forged-token-value")
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


def test_logout_clears_cookie_and_revokes_session(client, register_user):
    _, email, password = register_user("candidate")
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    logout = client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 200
    assert "hireflow_refresh=" in logout.headers.get("set-cookie", "")

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_is_idempotent_and_works_without_session(client):
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 200


def test_refresh_rejects_cross_site_origin(client, register_user):
    """The cookie-backed endpoint refuses requests from foreign origins."""
    _, email, password = register_user("candidate")
    client.post("/api/v1/auth/login", json={"email": email, "password": password})

    response = client.post("/api/v1/auth/refresh", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403

    allowed = client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:3000"})
    assert allowed.status_code == 200


def test_logout_rejects_cross_site_origin(client, register_user):
    _, email, password = register_user("candidate")
    client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response = client.post("/api/v1/auth/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# /auth/me and password change
# ---------------------------------------------------------------------------

def test_me_reflects_database_role_not_token_claims(client, register_user, login):
    _, email, password = register_user("recruiter", company_name="Role Check Co")
    headers = login(email, password)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["role"] == "recruiter"
    assert me["company_name"] == "Role Check Co"
    assert me["company_id"]


def test_change_password_then_old_password_fails(client, register_user):
    _, email, password = register_user("candidate")
    headers = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': password}).json()['access_token']}"}

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": password,
            "new_password": "BrandNewPass123",
            "confirm_new_password": "BrandNewPass123",
        },
    )
    assert response.status_code == 200, response.text

    assert (
        client.post("/api/v1/auth/login", json={"email": email, "password": password}).status_code
        == 401
    )
    assert (
        client.post("/api/v1/auth/login", json={"email": email, "password": "BrandNewPass123"}).status_code
        == 200
    )


def test_change_password_requires_correct_current_password(client, register_user):
    _, email, password = register_user("candidate")
    headers = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': password}).json()['access_token']}"}

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": "NotMyPassword1",
            "new_password": "BrandNewPass123",
            "confirm_new_password": "BrandNewPass123",
        },
    )
    assert response.status_code == 422


def test_change_password_requires_matching_confirmation(client, register_user):
    _, email, password = register_user("candidate")
    headers = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': password}).json()['access_token']}"}
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": password,
            "new_password": "BrandNewPass123",
            "confirm_new_password": "DifferentPass123",
        },
    )
    assert response.status_code == 422


def test_change_password_revokes_existing_sessions(client, register_user):
    _, email, password = register_user("candidate")
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": password,
            "new_password": "BrandNewPass123",
            "confirm_new_password": "BrandNewPass123",
        },
    )
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def test_login_is_rate_limited(client):
    email = _email("rl")
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Rate Limited"},
    )
    statuses = [
        client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPass1"}).status_code
        for _ in range(14)
    ]
    assert 429 in statuses, statuses
    limited = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123"})
    assert limited.status_code == 429
    assert limited.headers.get("Retry-After")

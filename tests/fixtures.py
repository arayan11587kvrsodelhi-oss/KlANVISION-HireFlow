"""Reusable identity fixtures for the test-suite.

Kept out of ``conftest.py`` so both the security and workflow modules can import
them explicitly, and so their side effects (creating resumes, companies) are
visible at the import site.
"""

from __future__ import annotations

import pytest


@pytest.fixture()
def candidate_a(client, register_user, login, make_pdf):
    user_id, email, password = register_user("candidate")
    headers = login(email, password)
    client.post(
        "/api/v1/candidates/me/resume",
        headers=headers,
        files={"file": ("a.pdf", make_pdf, "application/pdf")},
    )
    return {"id": user_id, "email": email, "password": password, "headers": headers}


@pytest.fixture()
def candidate_b(client, register_user, login, make_pdf):
    user_id, email, password = register_user("candidate")
    headers = login(email, password)
    client.patch(
        "/api/v1/candidates/me/profile",
        headers=headers,
        json={"full_name": "Candidate B Private", "phone": "+1 555 0100"},
    )
    client.post(
        "/api/v1/candidates/me/resume",
        headers=headers,
        files={"file": ("b.pdf", make_pdf, "application/pdf")},
    )
    return {"id": user_id, "email": email, "password": password, "headers": headers}


@pytest.fixture()
def recruiter_a(client, register_user, login):
    user_id, email, password = register_user("recruiter", company_name="Alpha Corp")
    headers = login(email, password)
    company = client.get("/api/v1/companies/me", headers=headers).json()
    return {"id": user_id, "email": email, "password": password, "headers": headers, "company": company}


@pytest.fixture()
def recruiter_b(client, register_user, login):
    user_id, email, password = register_user("recruiter", company_name="Beta LLC")
    headers = login(email, password)
    company = client.get("/api/v1/companies/me", headers=headers).json()
    return {"id": user_id, "email": email, "password": password, "headers": headers, "company": company}


@pytest.fixture()
def admin_headers(client, app_session):
    """An administrator created the same way an operator would.

    Admins are never self-registered, so the fixture creates the row directly
    and then signs in through the API, exercising the real login path.
    """
    import uuid

    from app.models.user import User
    from app.services import auth as auth_service

    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    password = "AdminPassword123"
    user = User(
        email=email,
        hashed_password=auth_service.get_password_hash(password),
        role="admin",
        is_active=True,
        is_verified=True,
    )
    app_session.add(user)
    app_session.commit()

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

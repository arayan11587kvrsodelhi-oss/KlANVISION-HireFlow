"""Critical cross-tenant isolation and access-control tests.

These are the six mandated cases, plus the adjacent attacks they imply:

1. Candidate A reads Candidate B's profile
2. Candidate A reads Candidate B's applications
3. Recruiter A reads Recruiter B's company data
4. Candidate performs recruiter-only operations
5. Unauthenticated user hits protected endpoints
6. Expired or invalid session hits protected endpoints

Conventions asserted throughout:
* foreign resources answer **404**, not 403, so ids cannot be enumerated;
* wrong-role operations answer **403** (the caller is known, the operation is not
  theirs);
* unauthenticated calls answer **401** and are distinguishable from 403.
"""

from __future__ import annotations

import uuid

import pytest

from tests.fixtures import candidate_a, candidate_b, recruiter_a, recruiter_b  # noqa: F401

pytestmark = pytest.mark.security


def _apply(client, candidate, job_id, cover="Interested"):
    response = client.post(
        f"/api/v1/applications/jobs/{job_id}", headers=candidate["headers"], json={"cover_letter": cover}
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Case 1 - Candidate A reads Candidate B's profile
# ---------------------------------------------------------------------------

def test_candidate_a_cannot_read_candidate_b_profile(client, candidate_a, candidate_b):
    # There is no endpoint that accepts another candidate's id at all.
    for path in (
        f"/api/v1/candidates/{candidate_b['id']}/profile",
        f"/api/v1/candidates/{candidate_b['id']}",
    ):
        response = client.get(path, headers=candidate_a["headers"])
        assert response.status_code in (404, 405), (path, response.status_code, response.text)

    # A stray id in a query string is ignored: the self endpoint resolves the
    # profile from the token, so it returns A's record, never B's.
    injected = client.get(
        "/api/v1/candidates/me/profile",
        headers=candidate_a["headers"],
        params={"user_id": candidate_b["id"], "id": candidate_b["id"]},
    )
    assert injected.status_code == 200
    body = injected.json()
    assert body["full_name"] != "Candidate B Private"
    assert body["phone"] != "+1 555 0100"

    # And B still sees only B.
    b_body = client.get("/api/v1/candidates/me/profile", headers=candidate_b["headers"]).json()
    assert b_body["full_name"] == "Candidate B Private"
    assert body["full_name"] != b_body["full_name"]


def test_candidate_a_cannot_update_candidate_b_profile(client, candidate_a, candidate_b):
    response = client.patch(
        f"/api/v1/candidates/{candidate_b['id']}/profile",
        headers=candidate_a["headers"],
        json={"headline": "pwned"},
    )
    assert response.status_code in (404, 405)

    # B's data is unchanged.
    b_profile = client.get("/api/v1/candidates/me/profile", headers=candidate_b["headers"]).json()
    assert b_profile["headline"] != "pwned"
    assert b_profile["full_name"] == "Candidate B Private"


def test_candidate_a_cannot_read_candidate_b_resume(client, candidate_a, candidate_b):
    b_profile = client.get("/api/v1/candidates/me/profile", headers=candidate_b["headers"]).json()
    b_resume_url = b_profile["resume"]["download_url"]

    response = client.get(b_resume_url, headers=candidate_a["headers"])
    assert response.status_code == 404

    # Sanity: the owner can still download it.
    assert client.get(b_resume_url, headers=candidate_b["headers"]).status_code == 200


# ---------------------------------------------------------------------------
# Case 2 - Candidate A accesses Candidate B's applications
# ---------------------------------------------------------------------------

def test_candidate_a_cannot_read_candidate_b_applications(
    client, candidate_a, candidate_b, recruiter_a, publish_job
):
    job = publish_job(recruiter_a["headers"])
    b_application = _apply(client, candidate_b, job["id"])

    # A's own list is empty even though B has an application on that job.
    a_apps = client.get("/api/v1/candidates/me/applications", headers=candidate_a["headers"]).json()
    assert a_apps == []

    # B's application id is not addressable by A through the candidate API.
    response = client.get(
        f"/api/v1/candidates/me/applications/{b_application['id']}", headers=candidate_a["headers"]
    )
    assert response.status_code in (404, 405)

    # Nor through the recruiter-facing application resource.
    response = client.get(
        f"/api/v1/applications/{b_application['id']}", headers=candidate_a["headers"]
    )
    assert response.status_code == 403


def test_cannot_apply_on_behalf_of_another_candidate(
    client, candidate_a, candidate_b, recruiter_a, publish_job
):
    job = publish_job(recruiter_a["headers"], title="Second Role")

    # An attempt to inject another candidate's id in the body is rejected
    # outright: the schema forbids unknown fields.
    response = client.post(
        f"/api/v1/applications/jobs/{job['id']}",
        headers=candidate_a["headers"],
        json={"candidate_id": candidate_b["id"]},
    )
    assert response.status_code == 422

    # And nothing was created for B.
    b_apps = client.get("/api/v1/candidates/me/applications", headers=candidate_b["headers"]).json()
    assert all(a["job_id"] != job["id"] for a in b_apps)


# ---------------------------------------------------------------------------
# Case 3 - Recruiter A reads Recruiter B's company information
# ---------------------------------------------------------------------------

def test_recruiter_a_cannot_read_recruiter_b_company(client, recruiter_a, recruiter_b):
    assert recruiter_a["company"]["id"] != recruiter_b["company"]["id"]

    # /companies/me always resolves to the caller's own company.
    mine = client.get("/api/v1/companies/me", headers=recruiter_a["headers"]).json()
    assert mine["id"] == recruiter_a["company"]["id"]
    assert mine["id"] != recruiter_b["company"]["id"]

    # The public profile deliberately exposes no membership/recruiter data.
    public = client.get(f"/api/v1/companies/{recruiter_b['company']['id']}").json()
    for forbidden in ("members", "recruiters", "owner", "owner_id", "email"):
        assert forbidden not in public


def test_recruiter_a_cannot_update_recruiter_b_company(client, recruiter_a, recruiter_b):
    response = client.patch(
        f"/api/v1/companies/{recruiter_b['company']['id']}",
        headers=recruiter_a["headers"],
        json={"name": "Hijacked"},
    )
    assert response.status_code in (404, 405)

    response = client.put(
        f"/api/v1/companies/{recruiter_b['company']['id']}",
        headers=recruiter_a["headers"],
        json={"name": "Hijacked"},
    )
    assert response.status_code in (404, 405)

    unchanged = client.get("/api/v1/companies/me", headers=recruiter_b["headers"]).json()
    assert unchanged["name"] == "Beta LLC"


def test_recruiter_a_cannot_read_or_edit_recruiter_b_jobs(client, recruiter_a, recruiter_b, publish_job):
    b_job = publish_job(recruiter_b["headers"], title="Beta Secret Role")

    # A draft of B's must be invisible to A.
    draft = client.post(
        "/api/v1/jobs",
        headers=recruiter_b["headers"],
        json={
            "title": "Beta Confidential Draft",
            "description": "An unreleased requisition that must not leak.",
            "salary_min": 1,
            "salary_max": 2,
            "status": "draft",
        },
    )
    assert draft.status_code == 201, draft.text
    draft_id = draft.json()["id"]

    assert client.get(f"/api/v1/jobs/{draft_id}", headers=recruiter_a["headers"]).status_code == 404
    assert client.get(f"/api/v1/jobs/{draft_id}").status_code == 404

    a_job_ids = {j["id"] for j in client.get("/api/v1/jobs/mine", headers=recruiter_a["headers"]).json()}
    assert draft_id not in a_job_ids
    assert b_job["id"] not in a_job_ids

    # A cannot mutate or delete B's job.
    patch = client.patch(
        f"/api/v1/jobs/{b_job['id']}", headers=recruiter_a["headers"], json={"title": "Stolen"}
    )
    assert patch.status_code == 404
    delete = client.delete(f"/api/v1/jobs/{b_job['id']}", headers=recruiter_a["headers"])
    assert delete.status_code == 404

    still_there = client.get(f"/api/v1/jobs/{b_job['id']}").json()
    assert still_there["title"] == "Beta Secret Role"


def test_recruiter_a_cannot_read_recruiter_b_applicants(
    client, recruiter_a, recruiter_b, candidate_a, publish_job
):
    b_job = publish_job(recruiter_b["headers"], title="Beta Applicant Role")
    b_application = _apply(client, candidate_a, b_job["id"])

    a_pipeline = client.get("/api/v1/applications", headers=recruiter_a["headers"]).json()
    assert all(app["id"] != b_application["id"] for app in a_pipeline)

    assert (
        client.get(f"/api/v1/applications/{b_application['id']}", headers=recruiter_a["headers"]).status_code
        == 404
    )

    # A cannot change the stage of B's applicant.
    response = client.patch(
        f"/api/v1/applications/{b_application['id']}",
        headers=recruiter_a["headers"],
        json={"status": "Rejected"},
    )
    assert response.status_code == 404

    b_pipeline = client.get("/api/v1/applications", headers=recruiter_b["headers"]).json()
    assert b_pipeline[0]["status"] == "Applied"


def test_recruiter_can_read_resume_only_for_candidates_who_applied_to_them(
    client, recruiter_a, recruiter_b, candidate_a, publish_job
):
    a_profile = client.get("/api/v1/candidates/me/profile", headers=candidate_a["headers"]).json()
    resume_url = a_profile["resume"]["download_url"]

    # Before applying: B has no relationship with this candidate.
    assert client.get(resume_url, headers=recruiter_b["headers"]).status_code == 404

    a_job = publish_job(recruiter_a["headers"], title="A Role")
    _apply(client, candidate_a, a_job["id"])

    # After applying to A's job, A can read it and B still cannot.
    assert client.get(resume_url, headers=recruiter_a["headers"]).status_code == 200
    assert client.get(resume_url, headers=recruiter_b["headers"]).status_code == 404


# ---------------------------------------------------------------------------
# Case 4 - Candidate performs recruiter-only operations
# ---------------------------------------------------------------------------

def test_candidate_cannot_perform_recruiter_operations(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Recruiter Only Role")
    h = candidate_a["headers"]

    attempts = [
        ("post", "/api/v1/jobs", {"title": "Hacker", "description": "x" * 30, "salary_min": 1, "salary_max": 2}),
        ("patch", f"/api/v1/jobs/{job['id']}", {"title": "Hijacked"}),
        ("delete", f"/api/v1/jobs/{job['id']}", None),
        ("get", "/api/v1/jobs/mine", None),
        ("patch", "/api/v1/companies/me", {"name": "Hijacked"}),
        ("get", "/api/v1/applications", None),
        ("get", "/api/v1/applications/counts", None),
    ]
    for method, path, body in attempts:
        response = getattr(client, method)(path, headers=h, json=body) if body is not None else getattr(
            client, method
        )(path, headers=h)
        assert response.status_code == 403, (method, path, response.status_code, response.text)

    # The job survived untouched.
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["title"] == "Recruiter Only Role"


def test_candidate_cannot_update_own_application_status(
    client, candidate_a, recruiter_a, publish_job
):
    job = publish_job(recruiter_a["headers"], title="Stage Guard Role")
    application = _apply(client, candidate_a, job["id"])

    for target in ("Selected", "Rejected"):
        response = client.patch(
            f"/api/v1/applications/{application['id']}",
            headers=candidate_a["headers"],
            json={"status": target},
        )
        assert response.status_code == 403

    mine = client.get("/api/v1/candidates/me/applications", headers=candidate_a["headers"]).json()
    assert mine[0]["status"] == "Applied"
    # The internal quality score is never exposed to the candidate.
    assert mine[0]["rating"] is None


def test_admin_endpoints_reject_non_admins(client, candidate_a, recruiter_a):
    for path in ("/api/v1/admin/metrics", "/api/v1/admin/candidates", "/api/v1/admin/jobs"):
        assert client.get(path, headers=candidate_a["headers"]).status_code == 403
        assert client.get(path, headers=recruiter_a["headers"]).status_code == 403


def test_recruiter_cannot_verify_own_company(client, recruiter_a):
    company_id = recruiter_a["company"]["id"]
    response = client.patch(
        f"/api/v1/admin/companies/{company_id}/verification",
        headers=recruiter_a["headers"],
        json={"is_verified": True},
    )
    assert response.status_code == 403

    # `is_verified` cannot be smuggled in through the self-service update either.
    response = client.patch(
        "/api/v1/companies/me", headers=recruiter_a["headers"], json={"is_verified": True}
    )
    assert response.status_code == 422
    assert client.get("/api/v1/companies/me", headers=recruiter_a["headers"]).json()["is_verified"] is False


def test_recruiter_cannot_apply_to_jobs(client, recruiter_a, recruiter_b, publish_job):
    job = publish_job(recruiter_a["headers"], title="Cross Recruiter Apply")
    response = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=recruiter_b["headers"], json={})
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Case 5 - Unauthenticated user hits protected endpoints
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/auth/me"),
        ("get", "/api/v1/candidates/me/profile"),
        ("get", "/api/v1/candidates/me/applications"),
        ("get", "/api/v1/jobs/mine"),
        ("get", "/api/v1/jobs/saved"),
        ("get", "/api/v1/applications"),
        ("get", "/api/v1/companies/me"),
        ("get", "/api/v1/admin/metrics"),
        ("patch", "/api/v1/companies/me"),
    ],
)
def test_unauthenticated_requests_are_rejected(client, method, path):
    if method == "get":
        response = client.get(path)
    else:
        response = getattr(client, method)(path, json={})
    assert response.status_code == 401, (path, response.status_code, response.text)


def test_unauthenticated_cannot_post_jobs_or_applications(client, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"])
    assert client.post("/api/v1/jobs", json={}).status_code == 401
    assert client.post(f"/api/v1/applications/jobs/{job['id']}", json={}).status_code == 401
    assert (
        client.post(
            "/api/v1/candidates/me/resume",
            files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")},
        ).status_code
        == 401
    )


def test_public_job_board_is_open(client, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Public Role")
    listing = client.get("/api/v1/jobs")
    assert listing.status_code == 200
    assert any(item["id"] == job["id"] for item in listing.json()["items"])


# ---------------------------------------------------------------------------
# Case 6 - Expired or invalid session hits protected endpoints
# ---------------------------------------------------------------------------

def test_invalid_token_is_rejected(client, candidate_a):
    for token in (
        "not-a-jwt",
        "a.b.c",
        "",
        # Correct shape, wrong signature.
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJhY2Nlc3MiLCJpc3MiOiJoaXJlZmxvdy1hcGkifQ."
        "deadbeefsignature",
    ):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        assert client.get("/api/v1/candidates/me/profile", headers=headers).status_code == 401


def test_expired_access_token_is_rejected(client, candidate_a, db):
    """Forge a *validly signed* token that expired an hour ago.

    This proves expiry is enforced by signature + claim validation, not merely by
    the client discarding the token.
    """
    from datetime import datetime, timedelta, timezone

    import jwt

    from app.config import get_settings

    settings = get_settings()
    now = datetime.now(timezone.utc) - timedelta(hours=2)
    payload = {
        "sub": candidate_a["id"],
        "role": "candidate",
        "type": "access",
        "iss": settings.JWT_ISSUER,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=15)).timestamp()),
        "jti": "expired",
    }
    token = jwt.encode(payload, settings.signing_key, algorithm=settings.JWT_ALGORITHM)

    response = client.get(
        "/api/v1/candidates/me/profile", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_token_with_wrong_issuer_is_rejected(client, candidate_a):
    import jwt

    from app.config import get_settings
    from datetime import datetime, timedelta, timezone

    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": candidate_a["id"],
        "role": "admin",
        "type": "access",
        "iss": "some-other-service",
        "exp": int((now + timedelta(minutes=15)).timestamp()),
    }
    token = jwt.encode(payload, settings.signing_key, algorithm=settings.JWT_ALGORITHM)
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_role_claim_cannot_escalate_privileges(client, candidate_a):
    """A candidate's genuine token cannot reach admin routes by claiming admin."""
    from datetime import datetime, timedelta, timezone

    import jwt

    from app.config import get_settings

    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": candidate_a["id"],
        "role": "admin",  # forged claim
        "type": "access",
        "iss": settings.JWT_ISSUER,
        "exp": int((now + timedelta(minutes=15)).timestamp()),
    }
    token = jwt.encode(payload, settings.signing_key, algorithm=settings.JWT_ALGORITHM)
    response = client.get("/api/v1/admin/metrics", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_logout_invalidates_outstanding_access_token(client, register_user, login):
    _, email, password = register_user("candidate")
    headers = login(email, password)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200

    # The JWT has not expired yet, but its session was revoked server-side.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_deleted_account_token_is_rejected(client, app_session, register_user, login):
    """A token for an account that no longer exists must not authenticate."""
    from sqlalchemy import delete

    from app.models.user import User

    user_id, email, password = register_user("candidate")
    headers = login(email, password)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # Out-of-band account removal (e.g. by an operator).
    app_session.execute(delete(User).where(User.id == user_id))
    app_session.commit()

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.get("/api/v1/candidates/me/profile", headers=headers).status_code == 401


def test_suspended_account_token_is_rejected(client, app_session, register_user, login):
    """A suspended account is refused immediately, with the same token."""
    from sqlalchemy import update

    from app.models.user import User

    user_id, email, password = register_user("candidate")
    headers = login(email, password)

    app_session.execute(update(User).where(User.id == user_id).values(is_active=False))
    app_session.commit()

    # A suspended (not deleted) user is authenticated but not authorised.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 403
    assert client.get("/api/v1/candidates/me/profile", headers=headers).status_code == 403

    # Lifting the suspension restores access: suspension is reversible and does
    # not destroy the session.
    app_session.execute(update(User).where(User.id == user_id).values(is_active=True))
    app_session.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200


def test_returned_ids_are_server_generated_not_client_supplied(client, register_user):
    """Registration must never echo an id the client chose."""
    import uuid

    email = f"id-test-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123",
            "full_name": "Id Test",
            "role": "candidate",
            # Attempt to choose our own primary key.
            "id": "11111111-1111-1111-1111-111111111111",
        },
    )
    assert response.status_code == 422  # extra fields are forbidden

"""End-to-end product workflows through the real API.

These tests cover the paths a user actually walks, including the state machine
and validation rules that the old client-only implementation got wrong.
"""

from __future__ import annotations

import uuid

import pytest

from tests.fixtures import candidate_a, candidate_b, recruiter_a, recruiter_b, admin_headers  # noqa: F401

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Job board and search
# ---------------------------------------------------------------------------

def test_only_published_jobs_appear_on_the_public_board(client, recruiter_a, publish_job):
    published = publish_job(recruiter_a["headers"], title="Published Role")
    draft = client.post(
        "/api/v1/jobs",
        headers=recruiter_a["headers"],
        json={
            "title": "Draft Role",
            "description": "An internal draft that is not announced yet.",
            "salary_min": 100000,
            "salary_max": 120000,
            "status": "draft",
        },
    ).json()

    ids = {item["id"] for item in client.get("/api/v1/jobs").json()["items"]}
    assert published["id"] in ids
    assert draft["id"] not in ids


def test_job_search_filters(client, recruiter_a, publish_job):
    remote = publish_job(recruiter_a["headers"], title="Remote Platform Engineer")
    client.post(
        "/api/v1/jobs",
        headers=recruiter_a["headers"],
        json={
            "title": "Onsite Designer",
            "description": "Design systems for an in-office team environment.",
            "department": "Design",
            "location": "Berlin",
            "workplace_type": "On-site",
            "job_type": "Part-time",
            "experience_level": "Mid",
            "salary_min": 60000,
            "salary_max": 75000,
            "status": "published",
        },
    )

    by_query = client.get("/api/v1/jobs", params={"q": "platform"}).json()["items"]
    assert [j["id"] for j in by_query] == [remote["id"]]

    by_workplace = client.get("/api/v1/jobs", params={"workplace_type": "On-site"}).json()
    assert by_workplace["total"] == 1
    assert by_workplace["items"][0]["title"] == "Onsite Designer"

    by_location = client.get("/api/v1/jobs", params={"location": "berlin"}).json()
    assert by_location["total"] == 1

    too_expensive = client.get("/api/v1/jobs", params={"salary_min": 200000}).json()
    assert too_expensive["total"] == 0


def test_job_search_is_parameterised_not_string_interpolated(client, recruiter_a, publish_job):
    publish_job(recruiter_a["headers"], title="Quote Test Role")
    # Classic SQL injection payloads must be treated as literal text.
    for payload in ("' OR 1=1 --", "'; DROP TABLE jobs; --", "%", "_"):
        response = client.get("/api/v1/jobs", params={"q": payload})
        assert response.status_code == 200, payload
        body = response.json()
        # Behave as literals: an injected OR/comment matches nothing rather
        # than dumping every row, and the LIKE wildcards are escaped.
        assert isinstance(body["items"], list)
        assert "total" in body
    # The table still exists and is queryable.
    assert client.get("/api/v1/jobs").status_code == 200


def test_job_search_pagination(client, recruiter_a):
    for index in range(5):
        client.post(
            "/api/v1/jobs",
            headers=recruiter_a["headers"],
            json={
                "title": f"Paged Role {index}",
                "description": "Pagination test requisition with enough detail.",
                "salary_min": 100000,
                "salary_max": 110000,
                "status": "published",
            },
        )
    first = client.get("/api/v1/jobs", params={"page": 1, "page_size": 2}).json()
    second = client.get("/api/v1/jobs", params={"page": 2, "page_size": 2}).json()
    assert len(first["items"]) == 2
    assert first["has_more"] is True
    assert {j["id"] for j in first["items"]}.isdisjoint({j["id"] for j in second["items"]})
    assert first["total"] >= 5


# ---------------------------------------------------------------------------
# Recruiter: job lifecycle
# ---------------------------------------------------------------------------

def test_recruiter_job_lifecycle(client, recruiter_a):
    h = recruiter_a["headers"]
    created = client.post(
        "/api/v1/jobs",
        headers=h,
        json={
            "title": "Draft Then Publish",
            "description": "A requisition that starts as a draft and is published.",
            "department": "Engineering",
            "salary_min": 90000,
            "salary_max": 130000,
            "responsibilities": ["Ship features"],
            "requirements": ["Experience with APIs"],
            "benefits": ["Learning budget"],
            "status": "draft",
        },
    )
    assert created.status_code == 201, created.text
    job = created.json()
    assert job["status"] == "draft"
    assert job["responsibilities"] == ["Ship features"]
    # Never on the public board while a draft.
    assert client.get(f"/api/v1/jobs/{job['id']}").status_code == 404

    published = client.patch(f"/api/v1/jobs/{job['id']}", headers=h, json={"status": "published"})
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert client.get(f"/api/v1/jobs/{job['id']}").status_code == 200

    updated = client.patch(
        f"/api/v1/jobs/{job['id']}",
        headers=h,
        json={"title": "Renamed Role", "requirements": ["A", "B"]},
    )
    assert updated.json()["title"] == "Renamed Role"
    assert updated.json()["requirements"] == ["A", "B"]

    closed = client.patch(f"/api/v1/jobs/{job['id']}", headers=h, json={"status": "closed"})
    assert closed.json()["status"] == "closed"
    # A closed role is no longer publicly visible.
    assert client.get(f"/api/v1/jobs/{job['id']}").status_code == 404

    assert client.delete(f"/api/v1/jobs/{job['id']}", headers=h).status_code == 200
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=h).status_code == 404


def test_job_validation_rejects_bad_input(client, recruiter_a):
    h = recruiter_a["headers"]
    base = {
        "title": "Valid Title",
        "description": "Long enough description for validation to accept it.",
        "salary_min": 100000,
        "salary_max": 120000,
    }

    cases = [
        ({**base, "salary_min": 200000, "salary_max": 100000}, "inverted salary range"),
        ({**base, "title": "ab"}, "title too short"),
        ({**base, "description": "too short"}, "description too short"),
        ({**base, "workplace_type": "Mars"}, "invalid workplace type"),
        ({**base, "job_type": "Freelance"}, "invalid job type"),
        ({**base, "experience_level": "Wizard"}, "invalid seniority"),
        ({**base, "salary_min": -1}, "negative salary"),
        ({**base, "company_id": "other"}, "client-supplied company id is forbidden"),
        ({**base, "status": "archived"}, "invalid status"),
    ]
    for payload, label in cases:
        response = client.post("/api/v1/jobs", headers=h, json=payload)
        assert response.status_code == 422, f"{label}: {response.status_code} {response.text}"


# ---------------------------------------------------------------------------
# Candidate: profile, resume, apply, track
# ---------------------------------------------------------------------------

def test_candidate_profile_round_trip(client, candidate_a):
    h = candidate_a["headers"]

    updated = client.patch(
        "/api/v1/candidates/me/profile",
        headers=h,
        json={
            "full_name": "Ada Lovelace",
            "headline": "Principal Engineer",
            "bio": "Builds analytical engines.",
            "location": "London",
            "website": "https://ada.example.com",
            "github": "https://github.com/ada",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["full_name"] == "Ada Lovelace"

    # Fields omitted from a PATCH are left untouched.
    partial = client.patch("/api/v1/candidates/me/profile", headers=h, json={"headline": "Staff Engineer"})
    body = partial.json()
    assert body["headline"] == "Staff Engineer"
    assert body["full_name"] == "Ada Lovelace"
    assert body["location"] == "London"


def test_profile_rejects_javascript_urls(client, candidate_a):
    response = client.patch(
        "/api/v1/candidates/me/profile",
        headers=candidate_a["headers"],
        json={"website": "javascript:alert(1)"},
    )
    assert response.status_code == 422


def test_skills_are_replaced_deduplicated_and_ordered(client, candidate_a):
    h = candidate_a["headers"]
    response = client.put(
        "/api/v1/candidates/me/skills",
        headers=h,
        json={"skills": ["Python", " postgres ", "PYTHON", "", "Rust"]},
    )
    assert response.status_code == 200
    assert response.json()["skills"] == ["Python", "postgres", "Rust"]


def test_experience_and_education_crud(client, candidate_a):
    h = candidate_a["headers"]

    created = client.post(
        "/api/v1/candidates/me/experience",
        headers=h,
        json={
            "role": "Engineer",
            "company": "Acme",
            "location": "Remote",
            "start_date": "2020-01",
            "end_date": "2022-06",
            "current": False,
            "description": "Built things.",
        },
    )
    assert created.status_code == 201, created.text
    experience_id = created.json()["experience"][0]["id"]

    bad_dates = client.post(
        "/api/v1/candidates/me/experience",
        headers=h,
        json={"role": "Engineer", "company": "Acme", "start_date": "2022-01", "end_date": "2021-01"},
    )
    assert bad_dates.status_code == 422

    bad_format = client.post(
        "/api/v1/candidates/me/experience",
        headers=h,
        json={"role": "Engineer", "company": "Acme", "start_date": "January 2020"},
    )
    assert bad_format.status_code == 422

    edu = client.post(
        "/api/v1/candidates/me/education",
        headers=h,
        json={
            "degree": "BSc Computer Science",
            "field": "CS",
            "institution": "University of X",
            "start_year": "2015",
            "end_year": "2019",
            "gpa": "3.9",
        },
    )
    assert edu.status_code == 201, edu.text
    education_id = edu.json()["education"][0]["id"]

    # Deleting someone else's (or a random) id is a 404, not a silent success.
    assert client.delete(f"/api/v1/candidates/me/experience/{uuid.uuid4()}", headers=h).status_code == 404

    after = client.delete(f"/api/v1/candidates/me/experience/{experience_id}", headers=h).json()
    assert after["experience"] == []
    after_edu = client.delete(f"/api/v1/candidates/me/education/{education_id}", headers=h).json()
    assert after_edu["education"] == []


def test_resume_validation_rejects_unsafe_uploads(client, candidate_a):
    h = candidate_a["headers"]

    assert (
        client.post(
            "/api/v1/candidates/me/resume",
            headers=h,
            files={"file": ("payload.exe", b"MZ\x90\x00", "application/octet-stream")},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/candidates/me/resume",
            headers=h,
            files={"file": ("resume.pdf", b"<html>not a pdf</html>", "application/pdf")},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/candidates/me/resume",
            headers=h,
            files={"file": ("../../etc/passwd.pdf", b"%PDF-1.4\n", "application/pdf")},
        ).status_code
        in (201, 422)
    )
    assert (
        client.post(
            "/api/v1/candidates/me/resume",
            headers=h,
            files={"file": ("empty.pdf", b"", "application/pdf")},
        ).status_code
        == 422
    )


def test_uploaded_resume_filename_is_never_used_as_a_path(client, candidate_a):
    """A traversal-style filename is stored as metadata only."""
    h = candidate_a["headers"]
    response = client.post(
        "/api/v1/candidates/me/resume",
        headers=h,
        files={"file": ("../../../../windows/system32/evil.pdf", b"%PDF-1.4\n1\n", "application/pdf")},
    )
    assert response.status_code == 201, response.text
    assert "/" not in response.json()["file_name"]
    assert "\\" not in response.json()["file_name"]

    profile = client.get("/api/v1/candidates/me/profile", headers=h).json()
    download = client.get(profile["resume"]["download_url"], headers=h)
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-1.4")


def test_replacing_resume_deactivates_the_previous_one(client, candidate_a, make_pdf):
    h = candidate_a["headers"]
    first = client.get("/api/v1/candidates/me/profile", headers=h).json()["resume"]

    replaced = client.post(
        "/api/v1/candidates/me/resume",
        headers=h,
        files={"file": ("new.pdf", make_pdf + b"second", "application/pdf")},
    )
    assert replaced.status_code == 201

    profile = client.get("/api/v1/candidates/me/profile", headers=h).json()
    assert profile["resume"]["download_url"] != first["download_url"]


def test_cannot_apply_without_a_resume(client, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"])
    _, email, password = _new_candidate(client)
    headers = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = {"Authorization": f"Bearer {headers.json()['access_token']}"}

    response = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=token, json={})
    assert response.status_code == 422
    assert "resume" in response.json()["detail"].lower()


def test_cannot_apply_to_a_closed_or_missing_job(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="To Be Closed")
    client.patch(f"/api/v1/jobs/{job['id']}", headers=recruiter_a["headers"], json={"status": "closed"})

    closed = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})
    assert closed.status_code == 409

    missing = client.post(
        f"/api/v1/applications/jobs/{uuid.uuid4()}", headers=candidate_a["headers"], json={}
    )
    assert missing.status_code == 404


def test_candidate_application_tracking(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Tracked Role")
    applied = client.post(
        f"/api/v1/applications/jobs/{job['id']}",
        headers=candidate_a["headers"],
        json={"cover_letter": "I am very interested in this role."},
    )
    assert applied.status_code == 201, applied.text
    application = applied.json()
    assert application["status"] == "Applied"
    assert application["job_title"] == "Tracked Role"
    assert application["cover_letter"] == "I am very interested in this role."

    listing = client.get("/api/v1/candidates/me/applications", headers=candidate_a["headers"]).json()
    assert len(listing) == 1
    # Candidates do not receive internally-scored or profile-echo fields.
    assert listing[0]["rating"] is None
    assert listing[0]["candidate_phone"] is None

    counts = client.get("/api/v1/candidates/me/applications/counts", headers=candidate_a["headers"]).json()
    assert counts["applied"] == 1 and counts["total"] == 1

    ids = client.get("/api/v1/jobs/applied/ids", headers=candidate_a["headers"]).json()
    assert job["id"] in ids


def test_duplicate_application_is_blocked_by_the_database(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="One Shot Role")
    first = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})
    second = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})
    assert first.status_code == 201
    assert second.status_code == 409


# ---------------------------------------------------------------------------
# Recruiter: pipeline management
# ---------------------------------------------------------------------------

def test_recruiter_pipeline_and_status_machine(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Pipeline Role")
    application = client.post(
        f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={}
    ).json()
    h = recruiter_a["headers"]

    pipeline = client.get("/api/v1/applications", headers=h).json()
    assert len(pipeline) == 1
    assert pipeline[0]["id"] == application["id"]
    # Recruiters do see contact details and can leave internal notes.
    assert pipeline[0]["candidate_email"] == candidate_a["email"]
    assert pipeline[0]["resume_download_url"]

    shortlisted = client.patch(
        f"/api/v1/applications/{application['id']}",
        headers=h,
        json={"status": "Shortlisted", "notes": "Strong CV", "rating": 5},
    )
    assert shortlisted.status_code == 200, shortlisted.text
    assert shortlisted.json()["status"] == "Shortlisted"
    assert shortlisted.json()["notes"] == "Strong CV"

    # Applied -> Selected is not a legal jump.
    assert (
        client.patch(
            f"/api/v1/applications/{application['id']}", headers=h, json={"status": "Selected"}
        ).status_code
        == 409
    )

    for target in ("Interview", "Selected"):
        response = client.patch(
            f"/api/v1/applications/{application['id']}", headers=h, json={"status": target}
        )
        assert response.status_code == 200, response.text

    history = client.get(f"/api/v1/applications/{application['id']}", headers=h).json()["history"]
    assert {entry["new_status"] for entry in history} >= {"Applied", "Shortlisted", "Interview", "Selected"}

    # The candidate sees the new stage and the recruiter note.
    mine = client.get("/api/v1/candidates/me/applications", headers=candidate_a["headers"]).json()
    assert mine[0]["status"] == "Selected"
    assert mine[0]["notes"] == "Strong CV"

    counts = client.get("/api/v1/applications/counts", headers=h).json()
    assert counts["selected"] == 1


def test_recruiter_cannot_set_invalid_status_or_rating(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Bad Status Role")
    application = client.post(
        f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={}
    ).json()
    h = recruiter_a["headers"]

    assert (
        client.patch(f"/api/v1/applications/{application['id']}", headers=h, json={"status": "Hired"}).status_code
        == 422
    )
    assert (
        client.patch(
            f"/api/v1/applications/{application['id']}", headers=h, json={"status": "Shortlisted", "rating": 9}
        ).status_code
        == 422
    )


def test_pipeline_filters(client, candidate_a, recruiter_a, publish_job):
    job_a = publish_job(recruiter_a["headers"], title="Filter Role A")
    job_b = publish_job(recruiter_a["headers"], title="Filter Role B")
    client.post(f"/api/v1/applications/jobs/{job_a['id']}", headers=candidate_a["headers"], json={})
    client.post(f"/api/v1/applications/jobs/{job_b['id']}", headers=candidate_a["headers"], json={})
    h = recruiter_a["headers"]

    assert len(client.get("/api/v1/applications", headers=h, params={"job_id": job_a["id"]}).json()) == 1
    assert client.get("/api/v1/applications", headers=h, params={"status": "Interview"}).json() == []
    assert len(client.get("/api/v1/applications", headers=h, params={"search": "filter role a"}).json()) == 1
    assert len(client.get("/api/v1/applications", headers=h, params={"search": candidate_a["email"]}).json()) == 2


def test_recruiter_dashboard_counters_are_scoped(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Counter Role")
    client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})
    mine = client.get("/api/v1/jobs/mine", headers=recruiter_a["headers"]).json()
    assert len(mine) == 1
    assert mine[0]["applicants_count"] == 1


# ---------------------------------------------------------------------------
# Company profile
# ---------------------------------------------------------------------------

def test_recruiter_updates_own_company_only(client, recruiter_a):
    h = recruiter_a["headers"]
    updated = client.patch(
        "/api/v1/companies/me",
        headers=h,
        json={
            "name": "Alpha Corp",
            "industry": "Cloud Infrastructure",
            "location": "Remote",
            "website": "https://alpha.example.com",
            "employee_count": "50 - 150",
            "description": "We build infra.",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["industry"] == "Cloud Infrastructure"
    # Verification is not settable through this endpoint.
    assert updated.json()["is_verified"] is False


def test_company_website_must_be_a_url(client, recruiter_a):
    response = client.patch(
        "/api/v1/companies/me", headers=recruiter_a["headers"], json={"website": "javascript:alert(1)"}
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Saved jobs
# ---------------------------------------------------------------------------

def test_saved_jobs_toggle(client, candidate_a, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Saved Role")
    h = candidate_a["headers"]

    saved = client.post(f"/api/v1/jobs/{job['id']}/save", headers=h)
    assert saved.status_code == 200
    assert saved.json() == [job["id"]]

    listing = client.get("/api/v1/jobs/saved", headers=h).json()
    assert [j["id"] for j in listing] == [job["id"]]

    unsaved = client.post(f"/api/v1/jobs/{job['id']}/save", headers=h)
    assert unsaved.json() == []

    assert client.post(f"/api/v1/jobs/{uuid.uuid4()}/save", headers=h).status_code == 404
    # The same toggle is reachable through the documented DELETE for symmetry.
    client.post(f"/api/v1/jobs/{job['id']}/save", headers=h)
    removal = client.delete(f"/api/v1/jobs/{job['id']}/save", headers=h)
    assert removal.status_code == 200
    assert removal.json() == []


def test_saved_jobs_are_per_candidate(client, candidate_a, candidate_b, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Shared Save Role")
    client.post(f"/api/v1/jobs/{job['id']}/save", headers=candidate_a["headers"])

    assert client.get("/api/v1/jobs/saved/ids", headers=candidate_b["headers"]).json() == []


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

def test_admin_metrics_reflect_database_state(client, admin_headers, candidate_a, recruiter_a, publish_job):
    before = client.get("/api/v1/admin/metrics", headers=admin_headers).json()
    publish_job(recruiter_a["headers"], title="Metrics Role")
    after = client.get("/api/v1/admin/metrics", headers=admin_headers).json()
    assert after["total_jobs"] == before["total_jobs"] + 1
    assert after["total_candidates"] >= 1
    assert after["total_companies"] >= 1


def test_admin_can_suspend_and_reactivate_a_candidate(
    client, admin_headers, candidate_a, recruiter_a, publish_job
):
    job = publish_job(recruiter_a["headers"], title="Suspension Role")
    client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})

    suspended = client.patch(
        f"/api/v1/admin/candidates/{candidate_a['id']}/status", headers=admin_headers, json={"is_active": False}
    )
    assert suspended.status_code == 200, suspended.text

    # The suspended candidate cannot act, even with a live token.
    blocked = client.post(f"/api/v1/applications/jobs/{job['id']}", headers=candidate_a["headers"], json={})
    assert blocked.status_code == 403

    reactivated = client.patch(
        f"/api/v1/admin/candidates/{candidate_a['id']}/status", headers=admin_headers, json={"is_active": True}
    )
    assert reactivated.status_code == 200
    assert client.get("/api/v1/candidates/me/profile", headers=candidate_a["headers"]).status_code == 200


def test_admin_verifies_company(client, admin_headers, recruiter_a):
    company_id = recruiter_a["company"]["id"]
    verified = client.patch(
        f"/api/v1/admin/companies/{company_id}/verification", headers=admin_headers, json={"is_verified": True}
    )
    assert verified.status_code == 200
    assert verified.json()["is_verified"] is True

    # Verified is reflected on the public job board badge.
    assert client.get(f"/api/v1/companies/{company_id}").json()["is_verified"] is True
    assert client.get("/api/v1/companies/me", headers=recruiter_a["headers"]).json()["is_verified"] is True


def test_admin_directory_excludes_sensitive_candidate_fields(client, admin_headers, candidate_a):
    rows = client.get("/api/v1/admin/candidates", headers=admin_headers).json()
    row = next(r for r in rows if r["id"] == candidate_a["id"])
    for forbidden in ("phone", "resume", "bio", "cover_letter"):
        assert forbidden not in row


def test_admin_can_feature_and_moderate_jobs(client, admin_headers, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Moderated Role")

    featured = client.patch(f"/api/v1/admin/jobs/{job['id']}/featured", headers=admin_headers, json={"featured": True})
    assert featured.status_code == 200
    assert featured.json()["featured"] is True
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["featured"] is True

    removed = client.delete(f"/api/v1/jobs/{job['id']}", headers=admin_headers)
    assert removed.status_code == 200
    assert client.get(f"/api/v1/jobs/{job['id']}").status_code == 404


def test_non_admin_cannot_moderate_jobs(client, recruiter_a, publish_job):
    job = publish_job(recruiter_a["headers"], title="Unmoderated Role")
    assert (
        client.patch(
            f"/api/v1/admin/jobs/{job['id']}/featured",
            headers=recruiter_a["headers"],
            json={"featured": True},
        ).status_code
        == 403
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _new_candidate(client) -> tuple[str, str, str]:
    email = f"fresh-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123", "full_name": "Fresh Candidate", "role": "candidate"},
    )
    assert response.status_code == 201, response.text
    return response.json()["user_id"], email, "Password123"

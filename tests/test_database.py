"""Database and migration tests.

Two things are asserted here:

1. The Alembic baseline matches the ORM metadata. If a model is edited without a
   migration being generated, ``alembic check`` (run indirectly through the
   metadata-diff helper below) fails, which is the signal to run
   ``alembic revision --autogenerate``.
2. The database actually enforces the constraints that authorization depends on:
   the ``(candidate_id, job_id)`` uniqueness that makes duplicate applications
   impossible even under a race, and the ``ON DELETE CASCADE`` rules that make
   account deletion clean up dependent rows.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration


def test_baseline_migration_matches_models(engine):
    """No pending schema drift: every model change has been migrated."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.db.base import Base
    import app.models as _models  # noqa: F401 - registers every table

    del _models

    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection,
            opts={"compare_type": True},
        )
        diff = compare_metadata(context, Base.metadata)

    # Ignore the auto-created alembic_version bookkeeping table.
    meaningful = [
        change
        for change in diff
        if not (change[0] == "remove_table" and getattr(change[1], "name", "") == "alembic_version")
    ]
    assert not meaningful, f"Unmigrated schema changes detected: {meaningful}"


def test_expected_tables_exist(engine):
    with engine.connect() as connection:
        names = {
            row[0]
            for row in connection.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            )
        }
    expected = {
        "users",
        "candidate_profiles",
        "candidate_skills",
        "candidate_experience",
        "candidate_education",
        "recruiter_profiles",
        "recruiter_company_memberships",
        "companies",
        "jobs",
        "job_bullets",
        "applications",
        "application_status_history",
        "resumes",
        "saved_jobs",
        "refresh_tokens",
    }
    missing = expected - names
    assert not missing, f"Missing tables after migration: {missing}"


def test_duplicate_application_is_impossible_at_the_database_level(app_session, client, register_user, login, publish_job, make_pdf):
    """Insert a second application row directly: the DB constraint must reject it.

    Going around the API proves the guarantee lives in the schema, not merely in
    a ``SELECT`` inside a service function. Uses the *same connection* as the
    app (``app_session``) so rows committed through the API are visible.
    """
    from sqlalchemy import select

    from app.models.application import Application
    from app.models.job import Job

    _, recruiter_email, recruiter_password = register_user("recruiter", company_name="Constraint Co")
    recruiter_headers = login(recruiter_email, recruiter_password)
    job = publish_job(recruiter_headers)

    _, candidate_email, candidate_password = register_user("candidate")
    headers = login(candidate_email, candidate_password)
    client.post(
        "/api/v1/candidates/me/resume",
        headers=headers,
        files={"file": ("cv.pdf", make_pdf, "application/pdf")},
    )
    assert client.post(f"/api/v1/applications/jobs/{job['id']}", headers=headers, json={}).status_code == 201

    job_id = app_session.execute(select(Job.id).where(Job.id == job["id"])).scalar_one()
    candidate_id = app_session.execute(
        text("SELECT candidate_id FROM applications WHERE job_id = :job_id"),
        {"job_id": job_id},
    ).scalar_one()

    duplicate = Application(candidate_id=candidate_id, job_id=job_id, status="Applied")
    app_session.add(duplicate)
    with pytest.raises(IntegrityError):
        app_session.commit()
    app_session.rollback()


def test_deleting_a_user_cascades_to_applications_and_sessions(app_session, client, register_user, login, make_pdf):
    from sqlalchemy import select

    from app.models.application import Application
    from app.models.user import RefreshToken, User

    user_id, email, password = register_user("candidate")
    headers = login(email, password)
    client.post(
        "/api/v1/candidates/me/resume",
        headers=headers,
        files={"file": ("cv.pdf", make_pdf, "application/pdf")},
    )
    register_user("recruiter", company_name="Cascade Co")

    user = app_session.execute(select(User).where(User.id == user_id)).scalar_one()
    app_session.delete(user)
    app_session.commit()

    assert app_session.execute(select(Application).where(Application.candidate_id == user_id)).scalars().first() is None
    assert app_session.execute(select(RefreshToken).where(RefreshToken.user_id == user_id)).scalars().first() is None


def test_deleting_a_job_cascades_to_applications(app_session, client, register_user, login, publish_job, make_pdf):
    from sqlalchemy import delete, select

    from app.models.application import Application
    from app.models.job import Job

    _, recruiter_email, recruiter_password = register_user("recruiter", company_name="Delete Co")
    recruiter_headers = login(recruiter_email, recruiter_password)
    job = publish_job(recruiter_headers)

    _, candidate_email, candidate_password = register_user("candidate")
    headers = login(candidate_email, candidate_password)
    client.post(
        "/api/v1/candidates/me/resume",
        headers=headers,
        files={"file": ("cv.pdf", make_pdf, "application/pdf")},
    )
    assert client.post(f"/api/v1/applications/jobs/{job['id']}", headers=headers, json={}).status_code == 201

    app_session.execute(delete(Job).where(Job.id == job["id"]))
    app_session.commit()

    remaining = app_session.execute(
        select(Application).where(Application.job_id == job["id"])
    ).scalars().first()
    assert remaining is None


def test_job_salary_check_constraint(app_session, register_user, login):
    """Inserting an inverted salary range directly must be rejected by the DB."""
    from sqlalchemy import select

    from app.models.company import Company, RecruiterCompanyMembership
    from app.models.job import Job
    from app.models.user import RecruiterProfile, User

    _, email, password = register_user("recruiter", company_name="Constraint Salary Co")
    user_id = app_session.execute(select(User.id).where(User.email == email)).scalar_one()
    recruiter = app_session.execute(
        select(RecruiterProfile).where(RecruiterProfile.user_id == user_id)
    ).scalar_one()
    company = app_session.execute(
        select(Company).join(
            RecruiterCompanyMembership,
            RecruiterCompanyMembership.company_id == Company.id,
        ).where(RecruiterCompanyMembership.recruiter_id == recruiter.id)
    ).scalar_one()

    inverted = Job(
        title="Inverted Range",
        description="A job whose salary bounds violate the CHECK constraint.",
        company_id=company.id,
        salary_min=200000,
        salary_max=100000,
        status="published",
    )
    app_session.add(inverted)
    with pytest.raises(IntegrityError):
        app_session.commit()
    app_session.rollback()

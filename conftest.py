"""Pytest fixtures for HireFlow.

The suite runs against a **real PostgreSQL** database, not SQLite. That matters
for an authorization suite: SQLite does not enforce ``ON DELETE CASCADE`` by
default, has no real ``CHECK`` semantics for some constraints, and would let a
broken foreign key pass silently. The test database is created from the Alembic
migrations (so the migrations themselves are exercised), and every test runs in
a transaction that is rolled back afterwards.

Environment
-----------
``TEST_DATABASE_URL`` must point at a database that is safe to **drop and
recreate**. It defaults to ``hireflow_test`` on localhost. The fixture refuses to
run if the configured database name does not end in ``_test``, so a mistyped
variable cannot wipe a development or production database.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Settings are read at import time by app.config; make sure the test DSN is set
# before anything imports it.
DEFAULT_TEST_DSN = "postgresql+psycopg://postgres:postgres@localhost:5432/hireflow_test"


def _dotenv_value(key: str) -> str | None:
    """Read a single key from .env without adding a dotenv dependency here."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return None
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, _, value = stripped.partition("=")
        if name.strip() == key:
            return value.strip().strip('"').strip("'")
    return None


TEST_DATABASE_URL = (
    os.getenv("TEST_DATABASE_URL")
    or os.getenv("TEST_DSN")
    or _dotenv_value("TEST_DATABASE_URL")
    or DEFAULT_TEST_DSN
)

if not TEST_DATABASE_URL.rstrip("/").split("/")[-1].split("?")[0].endswith("_test"):
    raise RuntimeError(
        "Refusing to run tests: TEST_DATABASE_URL must point at a database whose "
        f"name ends in '_test' (got {TEST_DATABASE_URL!r}). The suite drops and "
        "recreates its schema."
    )

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-use-0123456789")
os.environ.setdefault("BCRYPT_COST", "8")  # lowest allowed cost: fastest hashing in tests

# Isolate resume files: tests must never write into the real storage directory,
# and files written by a test are removed after it (the DB rolls back, the disk
# does not).
_TEST_STORAGE_DIR = ROOT / "tmp" / "test-resumes"
os.environ["RESUME_STORAGE_DIR"] = str(_TEST_STORAGE_DIR)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

# Point the application's settings cache at the test database. This must happen
# after the environment above is set but before any app module is imported.
from app.config import get_settings  # noqa: E402

get_settings.cache_clear()
_settings = get_settings()
_settings.NEON_DSN = TEST_DATABASE_URL  # type: ignore[assignment]

# The engine created at import time of app.db.session is not the one used by
# the tests (they bind their own engine), but it must still be pointed at the
# test database so an accidental real connection cannot touch dev data.
import app.db.session as _session_module  # noqa: E402

_session_module.engine.dispose()
_session_module.engine = _session_module.create_db_engine(TEST_DATABASE_URL)
_session_module.SessionLocal.configure(bind=_session_module.engine)


# Holds the connection the `client` fixture is bound to, so `app_session` can
# write through the same transaction the API reads from.
_CLIENT_CONNECTION: list = [None]


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Create the test schema once per session from the Alembic migrations."""
    from alembic import command
    from alembic.config import Config

    test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True, future=True)

    with test_engine.connect() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()

    alembic_cfg = Config(str(ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(ROOT / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    os.environ["ALEMBIC_DATABASE_URL"] = TEST_DATABASE_URL
    command.upgrade(alembic_cfg, "head")

    yield test_engine
    test_engine.dispose()


@pytest.fixture()
def db(engine: Engine) -> Iterator[Session]:
    """A session bound to a connection whose transaction is rolled back.

    Application code calls ``commit()``; that only releases the outer
    transaction's savepoint-equivalent state, so the data disappears when the
    outer transaction is rolled back at the end of the test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False, autoflush=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _clean_resume_storage() -> Iterator[None]:
    """Remove files written to the test resume directory after each test."""
    yield
    if _TEST_STORAGE_DIR.is_dir():
        for path in _TEST_STORAGE_DIR.iterdir():
            if path.is_file():
                path.unlink(missing_ok=True)


@pytest.fixture()
def app_session(client: TestClient, engine: Engine) -> Iterator[Session]:
    """A session on the *same connection* the app is using.

    Lets a test mutate data out of band (delete a user, suspend an account) and
    have the API observe it, while everything still rolls back afterwards.
    """
    if _CLIENT_CONNECTION[0] is None:
        raise RuntimeError("app_session must be requested together with the client fixture")
    session = Session(bind=_CLIENT_CONNECTION[0], expire_on_commit=False, autoflush=False)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine: Engine) -> Iterator[TestClient]:
    """FastAPI test client bound to the shared, rolled-back transaction.

    Each request gets a **fresh** ``Session`` (as in production), all bound to
    one connection whose transaction is rolled back after the test. Sharing a
    single session across requests would let the identity map serve stale
    relationship data and hide real bugs.
    """
    from app.db.session import get_db_session
    from app.main import app

    connection = engine.connect()
    transaction = connection.begin()
    _CLIENT_CONNECTION[0] = connection
    factory = sessionmaker(bind=connection, expire_on_commit=False, autoflush=False)

    def _override() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = _override
    # The rate limiter is process-global; reset it so tests do not interact.
    from app.security.rate_limit import limiter

    limiter.reset()
    _TEST_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        limiter.reset()
        transaction.rollback()
        connection.close()


# ---------------------------------------------------------------------------
# Identity helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def register_user(client: TestClient):
    """Register an account and return (user_id, email, password)."""

    def _register(role: str = "candidate", password: str = "Password123", company_name: str | None = None):
        import uuid

        email = f"{role}-{uuid.uuid4().hex[:10]}@example.com"
        body = {
            "email": email,
            "password": password,
            "full_name": f"Test {role.title()}",
            "role": role,
        }
        if role == "recruiter":
            body["company_name"] = company_name or f"Test Co {uuid.uuid4().hex[:6]}"
        response = client.post("/api/v1/auth/register", json=body)
        assert response.status_code == 201, response.text
        return response.json()["user_id"], email, password

    return _register


@pytest.fixture()
def login(client: TestClient):
    """Log in and return an Authorization header dict."""

    def _login(email: str, password: str) -> dict[str, str]:
        response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _login


@pytest.fixture()
def make_pdf() -> bytes:
    """Minimal bytes that pass the server's PDF magic-number check."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n"


@pytest.fixture()
def publish_job(client: TestClient):
    """Create and publish a job as the given recruiter. Returns the job dict."""

    def _publish(recruiter_headers: dict[str, str], title: str = "Backend Engineer") -> dict:
        response = client.post(
            "/api/v1/jobs",
            headers=recruiter_headers,
            json={
                "title": title,
                "description": "Design and build reliable backend services at scale.",
                "department": "Engineering",
                "location": "Remote",
                "workplace_type": "Remote",
                "job_type": "Full-time",
                "experience_level": "Senior",
                "salary_min": 120000,
                "salary_max": 160000,
                "responsibilities": ["Build services"],
                "requirements": ["5+ years"],
                "benefits": ["Equity"],
                "status": "published",
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    return _publish

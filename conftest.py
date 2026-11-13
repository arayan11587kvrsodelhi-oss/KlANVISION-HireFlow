"""Pytest conftest for HireFlow.

Provides database session fixture for testing.

NOTE: For Neon PostgreSQL integration, configure the TEST_DSN environment
variable with a valid Neon connection string. For development without
Neon, an in-memory SQLite database is used.
"""

import pytest

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base


# Use an in-memory SQLite database for testing by default
# Override with TEST_DSN environment variable for Neon PostgreSQL testing
TEST_DATABASE_URL = os.getenv(
    "TEST_DSN", "sqlite:///./test.db"
)

# Create engine for testing
if "sqlite" in TEST_DATABASE_URL:
    test_engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=None,
    )
else:
    test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True, echo=False)

# Create session local for testing
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Pytest fixture that provides a database session for tests.

    Creates a new database session for each test function and ensures
    a clean state after the test completes by rolling back any
    transactions.

    Yields:
        Session: A SQLAlchemy session instance connected to the test database.

    Usage:
        - For SQLite (default): No special setup required.
        - For Neon PostgreSQL: Set TEST_DSN env var to a valid Neon connection string.
    """
    # Create a new session
    db = TestSessionLocal()

    try:
        yield db
    finally:
        # Ensure session is closed and any changes are discarded
        db.close()
        # For SQLite, nothing special needed
        # For Neon PostgreSQL, consider using transaction rollback
        # SessionLocal.remove() if using scoped sessions
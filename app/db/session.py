"""Database session management.

Handles SQLAlchemy engine creation, session local, and session dependency
for FastAPI endpoints. Uses environment variables for database connection.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .base import Base

import os

# Database URL from environment variable
# Format: postgresql://user:password@host:port/dbname
DATABASE_URL = os.getenv("NEON_DSN", "postgresql://postgres:postgres@localhost:5432/hrflow")

# Create engine with appropriate settings
# Neon supports scale-to-zero, so we don't set pool_timeout excessively
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=os.getenv("SQL_ECHO", "0") == "1",
)

# Create session local class
# autocommit=False means we need to explicitly commit
# autoflush=False means we need to explicitly flush; this prevents
# unexpected queries from firing
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session() -> Session:
    """Dependency that provides a database session.

    Yields a SQLAlchemy Session that is automatically closed after the
    request completes. Uses try/finally to ensure cleanup even on errors.

    Yields:
        Session: A SQLAlchemy session instance.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
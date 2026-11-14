"""Database engine and session management.

Reads the connection string from :mod:`app.config` (never from raw
``os.getenv``), so ``.env`` values and validation are applied consistently.
"""

from __future__ import annotations

from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def create_db_engine(dsn: str | None = None, *, echo: bool | None = None) -> Engine:
    """Create a pooled SQLAlchemy engine for PostgreSQL.

    Args:
        dsn: Optional override for the configured DSN (used by tests/tools).
        echo: Optional echo override.

    Returns:
        A configured :class:`~sqlalchemy.engine.Engine`.
    """
    settings = get_settings()
    url = dsn or settings.NEON_DSN
    return create_engine(
        url,
        pool_pre_ping=True,  # transparently recover from dropped connections
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
        echo=settings.DB_ECHO if echo is None else echo,
        future=True,
    )


engine: Engine = create_db_engine()

# SQLAlchemy 2.x: ``autocommit`` was removed; sessions begin implicitly and are
# committed explicitly by the service layer.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


@event.listens_for(Engine, "connect")
def _set_utc_timezone(dbapi_connection, connection_record) -> None:
    """Force every PostgreSQL connection into UTC.

    Keeps ``now()`` server defaults and application timestamps consistent.
    """
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("SET TIME ZONE 'UTC'")
        cursor.close()
    except Exception:  # pragma: no cover - non-PostgreSQL drivers
        pass


def get_db_session() -> Iterator[Session]:
    """FastAPI dependency yielding a database session.

    The session is rolled back on error and always closed.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

"""Reusable column types shared by all models."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


def new_uuid() -> str:
    """Generate a new UUID primary key value."""
    return str(uuid.uuid4())


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetime column.

    Always stores UTC and always returns timezone-aware values, so comparisons
    against ``datetime.now(timezone.utc)`` cannot raise "can't compare offset-naive
    and offset-aware datetimes" (a real hazard when a DB returns naive values).
    """

    impl = DateTime(timezone=True)
    cache_ok = True
    # Render as ``sa.DateTime(...)`` in Alembic autogenerate output.
    __module__ = "sqlalchemy.sql.sqltypes"

    # Render as the underlying ``sa.DateTime(timezone=True)`` in Alembic
    # autogenerate output. Without this the generated migration references
    # ``app.db.types.UTCDateTime`` without importing ``app``.
    def __repr__(self) -> str:
        return "DateTime(timezone=True)"

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def utcnow() -> datetime:
    """Current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

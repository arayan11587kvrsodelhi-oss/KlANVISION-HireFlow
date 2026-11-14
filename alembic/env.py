"""Alembic environment configuration for HireFlow.

The database URL is read from :mod:`app.config` (``NEON_DSN``) so no
credentials are stored in ``alembic.ini``. All models are imported through
``app.models`` so that ``Base.metadata`` is complete and autogenerate can see
the full schema.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the project root importable when alembic is run from anywhere.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (registers every table on Base.metadata)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# PostgreSQL stores a ``now()`` column default as ``CURRENT_TIMESTAMP``. Without
# this comparator every ``alembic check`` would report a spurious
# "modify_default" for every timestamp column.
_NOW_DEFAULTS = {"now()", "current_timestamp", "current_timestamp()"}


def _compare_server_default(context, inspected_column, metadata_column, inspected_default, metadata_default, rendered_metadata_default):
    # NOTE: the signature must match exactly - a misspelled parameter name makes
    # Alembic silently fall back to the default comparator.
    if inspected_default is None or metadata_default is None:
        return None  # let Alembic apply its default logic

    def _normalise(value) -> str:
        text = str(value).strip().strip("'").strip('"').lower()
        return text.replace("::timestamp with time zone", "").replace("::timestamp", "").strip()

    if _normalise(inspected_default) in _NOW_DEFAULTS and _normalise(metadata_default) in _NOW_DEFAULTS:
        return False  # equivalent
    return None


def _database_url() -> str:
    """Resolve the migration URL.

    ``ALEMBIC_DATABASE_URL`` takes precedence so CI can migrate a test database
    without touching application settings.
    """
    import os

    return os.getenv("ALEMBIC_DATABASE_URL") or get_settings().NEON_DSN


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without connecting)."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=_compare_server_default,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

"""Alembic environment configuration for HireFlow.

Reads the NEON_DSN from the .env file and sets up the SQLAlchemy URL
for migrations. This ensures we use the correct database connection
without hardcoding credentials.
"""

import os

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add project app to path so we can import settings
import sys
import pathlib

# Add the project root to sys.path
project_root = pathlib.Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root))

# Import settings from our config module
from app.config import settings

# Set the SQLAlchemy URL from settings
# This overrides the url in alembic.ini
config.set_main_option("sqlalchemy.url", settings.NEON_DSN)

# Add my model's MetaData object(s) for 'autogenerate' support
# from run.py we import Base and register all model metadata
from app.db.base import Base

target_metadata = Base.metadata

# If target_metadata is None, it will be auto-detected from
# the env.py file. Otherwise, it will use this metadata.

# other values from the config, defined by the needs of env.py,
# can be acquired:
# config.get_main_option("some_key")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and gives off-line though the URL to his Database.

    By skipping DDL emit this mode allows the DBA to do
    revisions even though a database is not available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this mode we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_section_),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
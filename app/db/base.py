"""SQLAlchemy declarative base and shared column conventions.

Every model inherits from :class:`Base`. Constraint naming conventions are set
so Alembic produces stable, reviewable constraint names (and so
``alembic/env.py`` can diff autogenerate output reliably).
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base for all HireFlow ORM models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

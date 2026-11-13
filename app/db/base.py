"""SQLAlchemy declarative base.

 Creates the Base class that all SQLAlchemy models will inherit from.
 This is the foundation for the ORM layer.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Convention for naming constraints to avoid automatic naming
# prefix issues. This helps Alembic generate consistent constraint names.
# From: https://docs.sqlalchemy.org/en/10/orm/mapping_config.html#configure-constraint-naming
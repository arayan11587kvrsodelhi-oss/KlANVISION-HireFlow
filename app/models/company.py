"""SQLAlchemy models for company-related entities.

Defines the ``companies`` and ``recruiter_company_memberships`` tables.
Companies represent employer organizations. Recruiters belong to companies
through membership records that enforce company-level RBAC.
"""

from sqlalchemy import (
    Column,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    DateTime,
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class Company(Base):
    """Company / employer organization.

    Represents an employer organization that recruits candidates.
    Each company has an owner (recruiter) and multiple members.
    """

    __tablename__ = "companies"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    name = Column(String(200), nullable=False)

    description = Column(Text, nullable=True)

    website = Column(String(200), nullable=True)

    created_at = Column(
        DateTime, server_default="now()", nullable=False
    )

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    # Relationships
    owner = relationship(
        "RecruiterProfile",
        back_populates="company_owner",
        foreign_keys="[recruiter_company_memberships.recruiter_id]",
    )

    members = relationship(
        "RecruiterCompanyMembership",
        back_populates="company",
        cascade="all, delete-orphan",
    )

    @property
    def owner_recruiter(self):
        """Convenience: get the owning recruiter profile."""
        membership = self.members.filter(
            "RecruiterCompanyMembership.role == \"owner\""
        ).first()
        return membership.recruiter if membership else None


class RecruiterCompanyMembership(Base):
    """Membership link between a recruiter and a company.

    Enforces company-level RBAC. A recruiter can have one of:
    - owner: full control of the company
    - admin: administrative privileges
    - member: read/write access within company scope

    The combination of (recruiter_id, company_id) is unique.
    """

    __tablename__ = "recruiter_company_memberships"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    recruiter_id = Column(
        String(36),
        ForeignKey("recruiter_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    company_id = Column(
        String(36),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
        default="member",
    )  # owner, admin, member

    joined_at = Column(
        DateTime, server_default="now()", nullable=False
    )

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    # Unique constraint: one recruiter per company
    __table_args__ = (
        UniqueConstraint("recruiter_id", "company_id", name="uq_recruiter_company"),
    )

    # Relationships
    recruiter = relationship(
        "RecruiterProfile",
        back_populates="company_memberships",
    )

    company = relationship(
        "Company",
        back_populates="members",
    )

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_member(self) -> bool:
        return self.role == "member"
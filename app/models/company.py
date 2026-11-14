"""SQLAlchemy models for company-related entities.

A company is an employer organisation. Recruiters belong to a company through a
membership row, which is what every company-scoped authorization check resolves
against. Company ids are never accepted from the client: they are derived from
the authenticated recruiter's membership.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, new_uuid, utcnow


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (Index("ix_companies_name", "name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(200))
    industry: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(200))
    employee_count: Mapped[str | None] = mapped_column(String(40))
    logo: Mapped[str | None] = mapped_column(String(500))
    # Only admins may change this. Defaults to False (pending accreditation).
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[object] = mapped_column(
        UTCDateTime,
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
    )

    memberships: Mapped[list["RecruiterCompanyMembership"]] = relationship(
        "RecruiterCompanyMembership",
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    jobs: Mapped[list["Job"]] = relationship(
        "Job", back_populates="company", passive_deletes=True
    )


class RecruiterCompanyMembership(Base):
    """Membership link between a recruiter and a company.

    (recruiter_id, company_id) is unique. ``role`` is one of owner/admin/member
    and is enforced by a CHECK constraint.
    """

    __tablename__ = "recruiter_company_memberships"
    __table_args__ = (
        UniqueConstraint("recruiter_id", "company_id", name="uq_recruiter_company"),
        CheckConstraint("role IN ('owner','admin','member')", name="role_allowed"),
        Index("ix_rcm_company_role", "company_id", "role"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recruiter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("recruiter_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="owner")
    joined_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[object] = mapped_column(
        UTCDateTime,
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
    )

    recruiter: Mapped["RecruiterProfile"] = relationship(
        "RecruiterProfile", back_populates="memberships"
    )
    company: Mapped["Company"] = relationship("Company", back_populates="memberships")

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_member(self) -> bool:
        return self.role == "member"
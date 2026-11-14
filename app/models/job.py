"""SQLAlchemy model for the ``jobs`` table.

A job belongs to a company (``company_id`` is always derived server-side from
the authenticated recruiter's membership). ``status`` moves draft -> published
-> closed and is constrained in the database.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, new_uuid, utcnow

JOB_STATUSES = ("draft", "published", "closed")
WORKPLACE_TYPES = ("Remote", "Hybrid", "On-site")
JOB_TYPES = ("Full-time", "Part-time", "Contract", "Internship")
EXPERIENCE_LEVELS = ("Entry", "Mid", "Senior", "Lead", "Executive")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published','closed')", name="status_allowed"),
        CheckConstraint(
            "workplace_type IN ('Remote','Hybrid','On-site')",
            name="workplace_type_allowed",
        ),
        CheckConstraint(
            "job_type IN ('Full-time','Part-time','Contract','Internship')",
            name="job_type_allowed",
        ),
        CheckConstraint(
            "experience_level IN ('Entry','Mid','Senior','Lead','Executive')",
            name="experience_level_allowed",
        ),
        CheckConstraint("salary_min >= 0 AND salary_max >= salary_min", name="salary_range"),
        # Public board query: published jobs newest first.
        Index("ix_jobs_status_created_at", "status", "created_at"),
        Index("ix_jobs_company_status", "company_id", "status"),
        Index("ix_jobs_salary_max", "salary_max"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    department: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(200))
    workplace_type: Mapped[str] = mapped_column(String(20), nullable=False, default="Remote")
    job_type: Mapped[str] = mapped_column(String(20), nullable=False, default="Full-time")
    experience_level: Mapped[str] = mapped_column(String(20), nullable=False, default="Mid")
    salary_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    salary_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    salary_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    company_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("recruiter_profiles.id", ondelete="SET NULL")
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
    published_at: Mapped[object | None] = mapped_column(UTCDateTime)

    company: Mapped["Company"] = relationship("Company", back_populates="jobs")
    creator: Mapped["RecruiterProfile | None"] = relationship(
        "RecruiterProfile", back_populates="jobs_created", foreign_keys=[created_by]
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="job", passive_deletes=True
    )
    saved_by: Mapped[list["SavedJob"]] = relationship(
        "SavedJob", back_populates="job", passive_deletes=True
    )
    responsibilities: Mapped[list["JobBullet"]] = relationship(
        "JobBullet",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobBullet.position",
        passive_deletes=True,
        primaryjoin="and_(JobBullet.job_id==Job.id, JobBullet.kind=='responsibility')",
        overlaps="benefits,requirements",
    )
    requirements: Mapped[list["JobBullet"]] = relationship(
        "JobBullet",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobBullet.position",
        passive_deletes=True,
        primaryjoin="and_(JobBullet.job_id==Job.id, JobBullet.kind=='requirement')",
        overlaps="benefits,responsibilities",
    )
    benefits: Mapped[list["JobBullet"]] = relationship(
        "JobBullet",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobBullet.position",
        passive_deletes=True,
        primaryjoin="and_(JobBullet.job_id==Job.id, JobBullet.kind=='benefit')",
        overlaps="requirements,responsibilities",
    )

    @property
    def is_published(self) -> bool:
        return self.status == "published"

    @property
    def is_closed(self) -> bool:
        return self.status == "closed"

    @property
    def is_draft(self) -> bool:
        return self.status == "draft"


class JobBullet(Base):
    """Ordered list item attached to a job (responsibility/requirement/benefit).

    A single table keeps bullet ordering and replacement transactional: an
    update deletes the rows of one kind and re-inserts them in order.
    """

    __tablename__ = "job_bullets"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('responsibility','requirement','benefit')", name="kind_allowed"
        ),
        Index("ix_job_bullets_job_kind_position", "job_id", "kind", "position"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    job: Mapped["Job"] = relationship(
        "Job", overlaps="benefits,requirements,responsibilities"
    )
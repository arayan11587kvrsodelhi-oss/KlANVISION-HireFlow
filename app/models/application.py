"""SQLAlchemy models for application-related entities.

``applications`` has a unique constraint on ``(candidate_id, job_id)`` so a
candidate cannot apply twice to the same job even under concurrent requests.
``application_status_history`` records every stage transition for audit.
"""

from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, new_uuid, utcnow

APPLICATION_STATUSES = ("Applied", "Shortlisted", "Interview", "Selected", "Rejected")

_STATUS_SQL = ",".join(f"'{status}'" for status in APPLICATION_STATUSES)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job"),
        CheckConstraint(f"status IN ({_STATUS_SQL})", name="status_allowed"),
        CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 5)", name="rating_range"),
        # Candidate "my applications" listing.
        Index("ix_applications_candidate_applied", "candidate_id", "applied_at"),
        # Recruiter pipeline filtering by job + stage.
        Index("ix_applications_job_status", "job_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Applied")
    cover_letter: Mapped[str | None] = mapped_column(Text)
    resume_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("resumes.id", ondelete="SET NULL")
    )
    # Snapshot of the resume filename at submit time, so a later resume
    # replacement does not rewrite application history.
    resume_filename: Mapped[str | None] = mapped_column(String(255))
    recruiter_notes: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer)

    applied_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )
    status_updated_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

    candidate: Mapped["User"] = relationship(
        "User", back_populates="applications", foreign_keys=[candidate_id]
    )
    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    resume: Mapped["Resume | None"] = relationship("Resume", back_populates="applications")
    status_history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        "ApplicationStatusHistory",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationStatusHistory.changed_at.desc()",
        passive_deletes=True,
    )


class ApplicationStatusHistory(Base):
    """Immutable audit trail of one application status change."""

    __tablename__ = "application_status_history"
    __table_args__ = (Index("ix_application_status_history_app", "application_id", "changed_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    previous_status: Mapped[str] = mapped_column(String(20), nullable=False)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    changed_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    application: Mapped["Application"] = relationship(
        "Application", back_populates="status_history"
    )
    changed_by_user: Mapped["User | None"] = relationship(
        "User", back_populates="status_changes", foreign_keys=[changed_by]
    )

    @property
    def transition_desc(self) -> str:
        return f"{self.previous_status} -> {self.new_status}"
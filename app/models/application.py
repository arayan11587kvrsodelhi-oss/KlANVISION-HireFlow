"""SQLAlchemy models for application-related entities.

Defines the ``applications`` and ``application_status_history`` tables.

``applications`` has a unique constraint on ``(candidate_id, job_id)`` to
prevent duplicate applications from the same candidate to the same job.

``application_status_history`` tracks every status change with audit trail.
"""

from sqlalchemy import (
    Column,
    DateTime,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class Application(Base):
    """Job application submitted by a candidate.

    Each candidate can apply to a job only once (enforced by a unique
    constraint on ``(candidate_id, job_id)`` at the database level).

    The ``status`` tracks the progress through the hiring pipeline.
    """

    __tablename__ = "applications"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    candidate_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    job_id = Column(
        String(36),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="Applied",
    )

    cover_letter = Column(Text, nullable=True)

    resume_id = Column(
        String(36),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
    )

    applied_at = Column(
        DateTime, server_default="now()", nullable=False
    )

    # Relationships
    candidate = relationship("User", back_populates="applications", foreign_keys=[candidate_id])

    job = relationship("Job", back_populates="applications", foreign_keys=[job_id])

    resume = relationship("Resume", back_populates="application")

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job"),
    )


class ApplicationStatusHistory(Base):
    """Audit trail of application status changes.

    Every time an application status changes, a new record is created here
    with the old status, new status, and who made the change. This provides
    a complete audit trail for compliance and tracking.
    """

    __tablename__ = "application_status_history"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    application_id = Column(
        String(36),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )

    previous_status = Column(String(20), nullable=False)

    new_status = Column(String(20), nullable=False)

    changed_by = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    changed_at = Column(
        DateTime, server_default="now()", nullable=False
    )

    # Relationships
    application = relationship("Application", back_populates="status_history")

    changed_by_user = relationship("User", foreign_keys=[changed_by])

    @property
    def transition_desc(self) -> str:
        """Human-readable description of the status transition."""
        return f"{self.previous_status} → {self.new_status}"
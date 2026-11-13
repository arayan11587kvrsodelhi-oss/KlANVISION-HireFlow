"""SQLAlchemy model for the ``jobs`` table.

Job postings created by recruiters. Jobs belong to a company and have
status tracking. Applications are linked to jobs via a unique constraint
on (candidate_id, job_id) to prevent duplicate applications.
"""

from sqlalchemy import (
    Column,
    String,
    Text,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship

from ..db.base import Base


class Job(Base):
    """Job posting created by a recruiter.

    Each job belongs to a company and is managed by a recruiter from that
    company. The ``(candidate_id, job_id)`` unique constraint in the
    ``applications`` table prevents duplicate applications from the same
    candidate.
    """

    __tablename__ = "jobs"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    title = Column(String(200), nullable=False)

    description = Column(Text, nullable=False)

    requirements = Column(Text, nullable=True)

    location = Column(String(200), nullable=True)  # e.g., "Remote", "NYC"

    status = Column(
        String(20),
        nullable=False,
        default="draft",
    )  # draft, published, closed

    company_id = Column(
        String(36),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_by = Column(
        String(36),
        ForeignKey("recruiter_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime, server_default="now()", nullable=False
    )

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    # Relationships
    company = relationship("Company", back_populates="jobs")

    creator = relationship(
        "RecruiterProfile",
        foreign_keys=[created_by],
    )

    applications = relationship(
        "Application",
        back_populates="job",
        cascade="delete",
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
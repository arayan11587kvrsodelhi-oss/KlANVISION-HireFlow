"""SQLAlchemy models for user-related entities.

Defines the ``users``, ``candidate_profiles``, and ``recruiter_profiles``
tables with UUID primary keys and explicit relationships.
"""

from sqlalchemy import Boolean, Column, DateTime, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from ..db.base import Base


def _uuid():
    import uuid
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=_uuid,
        unique=True,
        index=True,
        nullable=False,
    )

    email = Column(String(254), unique=True, index=True, nullable=False)

    hashed_password = Column(String(255), nullable=False)

    role = Column(String(20), nullable=False, default="candidate")

    is_active = Column(Boolean, default=True, nullable=False)

    is_verified = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, server_default="now()", nullable=False)

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    candidate_profile = relationship(
        "CandidateProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    recruiter_profile = relationship(
        "RecruiterProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    applications = relationship("Application", back_populates="candidate", cascade="delete")

    application_status_history = relationship(
        "ApplicationStatusHistory", back_populates="user", cascade="delete"
    )

    resumes = relationship("Resume", back_populates="owner", cascade="delete")

    audit_logs = relationship("AuditLog", back_populates="user", cascade="delete")

    @property
    def is_recruiter(self) -> bool:
        return self.role == "recruiter"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_candidate(self) -> bool:
        return self.role == "candidate"


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    full_name = Column(String(100), nullable=True)

    headline = Column(String(200), nullable=True)

    bio = Column(Text, nullable=True)

    phone = Column(String(30), nullable=True)

    website = Column(String(200), nullable=True)

    created_at = Column(DateTime, server_default="now()", nullable=False)

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    user = relationship("User", back_populates="candidate_profile")


class RecruiterProfile(Base):
    __tablename__ = "recruiter_profiles"

    id = Column(
        String(36),
        primary_key=True,
        unique=True,
        index=True,
        nullable=False,
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    full_name = Column(String(100), nullable=True)

    title = Column(String(100), nullable=True)

    company_name = Column(String(100), nullable=True)

    bio = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default="now()", nullable=False)

    updated_at = Column(
        DateTime, server_default="now()", onupdate="now()", nullable=False
    )

    user = relationship("User", back_populates="recruiter_profile")
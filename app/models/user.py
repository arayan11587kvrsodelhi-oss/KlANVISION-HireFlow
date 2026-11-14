"""SQLAlchemy models for user-related entities.

``users`` is the single identity table for every role. Candidate and recruiter
specific data lives in one-to-one profile tables. Experience and education rows
belong to a candidate profile.
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

ROLES = ("candidate", "recruiter", "admin")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('candidate','recruiter','admin')", name="role_allowed"),
        Index("ix_users_role_created_at", "role", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="candidate")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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

    candidate_profile: Mapped["CandidateProfile | None"] = relationship(
        "CandidateProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    recruiter_profile: Mapped["RecruiterProfile | None"] = relationship(
        "RecruiterProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="candidate",
        foreign_keys="Application.candidate_id",
        passive_deletes=True,
    )
    resumes: Mapped[list["Resume"]] = relationship(
        "Resume", back_populates="owner", passive_deletes=True
    )
    saved_jobs: Mapped[list["SavedJob"]] = relationship(
        "SavedJob", back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    status_changes: Mapped[list["ApplicationStatusHistory"]] = relationship(
        "ApplicationStatusHistory",
        back_populates="changed_by_user",
        foreign_keys="ApplicationStatusHistory.changed_by",
        passive_deletes=True,
    )

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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(200))
    headline: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(200))
    github: Mapped[str | None] = mapped_column(String(200))
    linkedin: Mapped[str | None] = mapped_column(String(200))
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

    user: Mapped["User"] = relationship("User", back_populates="candidate_profile")
    skills: Mapped[list["CandidateSkill"]] = relationship(
        "CandidateSkill",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="CandidateSkill.position",
        passive_deletes=True,
    )
    experience: Mapped[list["CandidateExperience"]] = relationship(
        "CandidateExperience",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="CandidateExperience.start_date.desc()",
        passive_deletes=True,
    )
    education: Mapped[list["CandidateEducation"]] = relationship(
        "CandidateEducation",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="CandidateEducation.created_at.desc()",
        passive_deletes=True,
    )


class RecruiterProfile(Base):
    __tablename__ = "recruiter_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
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

    user: Mapped["User"] = relationship("User", back_populates="recruiter_profile")
    memberships: Mapped[list["RecruiterCompanyMembership"]] = relationship(
        "RecruiterCompanyMembership",
        back_populates="recruiter",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    jobs_created: Mapped[list["Job"]] = relationship(
        "Job", back_populates="creator", foreign_keys="Job.created_by"
    )

    @property
    def primary_membership(self) -> "RecruiterCompanyMembership | None":
        """Owner membership first, otherwise the first membership."""
        if not self.memberships:
            return None
        for membership in self.memberships:
            if membership.role == "owner":
                return membership
        return self.memberships[0]

    @property
    def company_id(self) -> str | None:
        membership = self.primary_membership
        return membership.company_id if membership else None


class CandidateSkill(Base):
    """A single skill tag on a candidate profile."""

    __tablename__ = "candidate_skills"
    __table_args__ = (
        # A candidate cannot list the same skill twice (case handling is done
        # in the service layer, which normalises before insert).
        Index("ix_candidate_skills_profile_name", "profile_id", "name", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # Explicit ordering: without it PostgreSQL returns rows in arbitrary order
    # and the profile's skill list would appear to shuffle on every refresh.
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="skills"
    )


class CandidateExperience(Base):
    """One work-experience entry on a candidate profile."""

    __tablename__ = "candidate_experience"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    # Stored as "YYYY-MM" strings to match the month inputs in the UI.
    start_date: Mapped[str] = mapped_column(String(7), nullable=False)
    end_date: Mapped[str | None] = mapped_column(String(7))
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="experience"
    )


class CandidateEducation(Base):
    """One education entry on a candidate profile."""

    __tablename__ = "candidate_education"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    field: Mapped[str | None] = mapped_column(String(200))
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    start_year: Mapped[str | None] = mapped_column(String(10))
    end_year: Mapped[str | None] = mapped_column(String(10))
    gpa: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="education"
    )


class SavedJob(Base):
    """A job bookmarked by a candidate."""

    __tablename__ = "saved_jobs"
    __table_args__ = (
        Index("uq_saved_jobs_user_job", "user_id", "job_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="saved_jobs")
    job: Mapped["Job"] = relationship("Job", back_populates="saved_by")


class RefreshToken(Base):
    """Server-side session record backing the refresh cookie.

    Only a SHA-256 digest of the token is stored. Rotation marks the old row
    consumed and links it to its replacement so replay can be detected.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("ix_refresh_tokens_family", "family_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False)
    previous_token_id: Mapped[str | None] = mapped_column(String(36))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )
    expires_at: Mapped[object] = mapped_column(UTCDateTime, nullable=False)
    revoked_at: Mapped[object | None] = mapped_column(UTCDateTime)
    # Set when the row is rotated; a second use is a replay.
    consumed_at: Mapped[object | None] = mapped_column(UTCDateTime)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    @property
    def is_active(self) -> bool:
        return (
            self.revoked_at is None
            and self.consumed_at is None
            and self.expires_at > utcnow()
        )
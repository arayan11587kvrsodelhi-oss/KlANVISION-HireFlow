"""SQLAlchemy model for the ``resumes`` table.

Only metadata lives in the database. File bytes are stored on disk under the
configured ``RESUME_STORAGE_DIR`` using an opaque generated key, never the
client-supplied filename, and are only ever served by an authenticated endpoint
that checks ownership.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, new_uuid, utcnow


class Resume(Base):
    __tablename__ = "resumes"
    __table_args__ = (Index("ix_resumes_owner_uploaded", "owner_id", "uploaded_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # Opaque storage key (UUID + validated extension). Never derived from input.
    storage_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    mimetype: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    uploaded_at: Mapped[object] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, server_default=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="resumes")
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="resume"
    )
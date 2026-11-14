"""Resume file storage with server-side validation.

Threat model
------------
An uploaded resume is untrusted bytes supplied by a candidate. The previous
implementation validated only in the browser and stored a blob in memory. Here:

* **Type**: the extension must be on an allow-list *and* the first bytes must
  match a known magic number. A ``.exe`` renamed to ``.pdf`` is rejected.
* **Size**: enforced while reading the stream, so a client cannot claim a small
  size and stream gigabytes.
* **Path**: the file is written under an opaque generated name inside the
  configured directory. The client's filename is stored as *metadata only* and
  is never used to build a path, which removes path traversal entirely.
* **Access**: downloads require the owner (candidate) or a recruiter whose
  company owns a job the candidate applied to, or an admin. Anonymous access is
  impossible; there is no static mount of the storage directory.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import BinaryIO, Optional

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.application import Application
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.resume import ALLOWED_RESUME_EXTENSIONS, MAGIC_PREFIXES
from app.security.deps import CurrentUser
from app.security.errors import ForbiddenError, NotFoundError, ValidationError

settings = get_settings()

_CHUNK = 64 * 1024


def storage_root() -> Path:
    root = Path(settings.RESUME_STORAGE_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _extension_for(filename: str) -> str:
    # Path(...).suffix handles both / and \; only the basename is considered.
    return Path(filename.replace("\\", "/")).suffix.lower()


def _validate_header(extension: str, header: bytes) -> None:
    prefixes = MAGIC_PREFIXES.get(extension)
    if not prefixes:
        raise ValidationError("Unsupported file type")
    if not any(header.startswith(prefix) for prefix in prefixes):
        raise ValidationError(
            "File content does not match its extension. Upload a real PDF or DOCX file."
        )


def _safe_display_name(filename: str) -> str:
    """Reduce an uploaded filename to a safe display value.

    The value is stored as metadata only (never used to build a path), but it is
    echoed back in ``Content-Disposition`` and in the UI, so directory components
    and characters that can break a header or a path are removed.
    """
    normalised = (filename or "").replace("\\", "/")
    base = normalised.rsplit("/", 1)[-1].strip()  # drop any directory prefix
    cleaned = "".join(ch for ch in base if ch.isprintable() and ch not in '/\\:*?"<>|')
    # Guard against names that are only dots ('.', '..')
    cleaned = cleaned.strip(". ")
    return (cleaned or "resume")[:255]


def save_upload(db: Session, current: CurrentUser, upload: UploadFile) -> Resume:
    """Validate and persist an uploaded resume, replacing the active one."""
    original = upload.filename or ""
    extension = _extension_for(original)
    if extension not in ALLOWED_RESUME_EXTENSIONS:
        raise ValidationError(
            "Unsupported file type. Allowed types: " + ", ".join(sorted(ALLOWED_RESUME_EXTENSIONS))
        )

    storage_key = f"{uuid.uuid4().hex}{extension}"
    target = storage_root() / storage_key
    size = 0
    header = b""

    try:
        with target.open("wb") as output:
            first = True
            while True:
                chunk = upload.file.read(_CHUNK)
                if not chunk:
                    break
                if first:
                    header = chunk[:16]
                    _validate_header(extension, header)
                    first = False
                size += len(chunk)
                if size > settings.RESUME_MAX_BYTES:
                    raise ValidationError(
                        f"File exceeds the {settings.RESUME_MAX_BYTES // (1024 * 1024)} MB limit"
                    )
                output.write(chunk)
        if size == 0:
            raise ValidationError("The uploaded file is empty")
    except Exception:
        target.unlink(missing_ok=True)
        raise

    # Deactivate previous resumes (kept for applications already submitted).
    previous = db.execute(
        select(Resume).where(Resume.owner_id == current.id, Resume.status == "active")
    ).scalars().all()
    for row in previous:
        row.status = "replaced"

    resume = Resume(
        owner_id=current.id,
        filename=_safe_display_name(original) or f"resume{extension}",
        storage_key=storage_key,
        mimetype=ALLOWED_RESUME_EXTENSIONS[extension],
        size_bytes=size,
        status="active",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def delete_active_resume(db: Session, current: CurrentUser) -> None:
    rows = db.execute(
        select(Resume).where(Resume.owner_id == current.id, Resume.status == "active")
    ).scalars().all()
    for row in rows:
        row.status = "deleted"
        (storage_root() / row.storage_key).unlink(missing_ok=True)
    db.commit()


def _may_read(db: Session, current: CurrentUser, resume: Resume) -> bool:
    if current.role == "admin":
        return True
    if resume.owner_id == current.id:
        return True
    if current.role == "recruiter" and current.company_id:
        # A recruiter may read a resume only when the candidate actually applied
        # to a job owned by the recruiter's company, and used this resume.
        found = db.execute(
            select(Application.id)
            .join(Job, Application.job_id == Job.id)
            .where(
                Application.candidate_id == resume.owner_id,
                Application.resume_id == resume.id,
                Job.company_id == current.company_id,
            )
            .limit(1)
        ).first()
        return found is not None
    return False


def open_for_download(
    db: Session, current: CurrentUser, resume_id: str
) -> tuple[Resume, BinaryIO]:
    resume = db.execute(select(Resume).where(Resume.id == resume_id)).scalar_one_or_none()
    if resume is None:
        raise NotFoundError("Resume not found")
    if not _may_read(db, current, resume):
        raise NotFoundError("Resume not found")
    path = storage_root() / resume.storage_key
    if not path.is_file():
        raise NotFoundError("Resume file is no longer available")
    return resume, path.open("rb")


def get_resume_for_owner(db: Session, current: CurrentUser, resume_id: Optional[str] = None) -> Optional[Resume]:
    stmt = select(Resume).where(Resume.owner_id == current.id, Resume.status == "active")
    if resume_id:
        stmt = stmt.where(Resume.id == resume_id)
    return db.execute(stmt.order_by(Resume.uploaded_at.desc()).limit(1)).scalar_one_or_none()

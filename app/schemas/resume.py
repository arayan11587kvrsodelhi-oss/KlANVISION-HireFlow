"""Resume upload/download schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

# Server-side allow-list. The ``.doc`` binary format is deliberately excluded:
# it cannot be validated by content sniffing and is a common malware container.
ALLOWED_RESUME_EXTENSIONS = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}

# magic-byte prefixes checked server-side, independent of the client's header
MAGIC_PREFIXES = {
    ".pdf": (b"%PDF-",),
    ".docx": (b"PK\x03\x04",),  # docx is a zip container
}


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    file_size: str
    mimetype: Optional[str] = None
    uploaded_at: datetime
    download_url: str

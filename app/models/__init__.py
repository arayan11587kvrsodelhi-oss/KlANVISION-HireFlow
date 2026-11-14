"""SQLAlchemy models for HireFlow.

All models are imported here so that ``Base.metadata`` is fully populated for
Alembic autogenerate and so relationship string references always resolve.
"""

from app.models.user import (  # noqa: F401
    CandidateEducation,
    CandidateExperience,
    CandidateProfile,
    CandidateSkill,
    RecruiterProfile,
    RefreshToken,
    SavedJob,
    User,
)
from app.models.company import Company, RecruiterCompanyMembership  # noqa: F401
from app.models.job import Job, JobBullet  # noqa: F401
from app.models.application import (  # noqa: F401
    APPLICATION_STATUSES,
    Application,
    ApplicationStatusHistory,
)
from app.models.resume import Resume  # noqa: F401

__all__ = [
    "User",
    "CandidateProfile",
    "CandidateSkill",
    "CandidateExperience",
    "CandidateEducation",
    "RecruiterProfile",
    "RefreshToken",
    "SavedJob",
    "Company",
    "RecruiterCompanyMembership",
    "Job",
    "JobBullet",
    "Application",
    "ApplicationStatusHistory",
    "Resume",
    "APPLICATION_STATUSES",
]

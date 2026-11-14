"""Candidate profile logic.

Every function operates on ``current.id`` only. There is no profile-id parameter
anywhere in this module, which is what makes "candidate A reads candidate B's
profile" unrepresentable rather than merely disallowed.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.user import (
    CandidateEducation,
    CandidateExperience,
    CandidateProfile,
    CandidateSkill,
    User,
)
from app.schemas.candidate import (
    CandidateProfileUpdate,
    EducationIn,
    SkillsUpdate,
    WorkExperienceIn,
)
from app.security.deps import CurrentUser
from app.security.errors import NotFoundError


def get_profile_for_update(db: Session, current: CurrentUser) -> CandidateProfile:
    """Load the caller's candidate profile with all related rows."""
    profile = db.execute(
        select(CandidateProfile)
        .options(
            selectinload(CandidateProfile.skills),
            selectinload(CandidateProfile.experience),
            selectinload(CandidateProfile.education),
            # The serializer needs the owner's resumes to pick the active one.
            joinedload(CandidateProfile.user).selectinload(User.resumes),
        )
        .where(CandidateProfile.user_id == current.id)
    ).unique().scalar_one_or_none()
    if profile is None:
        # Every candidate account is created with a profile; a missing row means
        # the account is not a candidate, which the dependency already excludes.
        raise NotFoundError("Candidate profile not found")
    return profile


def update_profile(
    db: Session, current: CurrentUser, payload: CandidateProfileUpdate
) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def replace_skills(db: Session, current: CurrentUser, payload: SkillsUpdate) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    profile.skills.clear()
    db.flush()
    for position, name in enumerate(payload.skills):
        profile.skills.append(CandidateSkill(name=name, position=position))
    db.commit()
    db.refresh(profile)
    return profile


def add_experience(
    db: Session, current: CurrentUser, payload: WorkExperienceIn
) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    profile.experience.append(
        CandidateExperience(
            role=payload.role.strip(),
            company=payload.company.strip(),
            location=(payload.location or None),
            start_date=payload.start_date,
            end_date=payload.end_date,
            is_current=payload.current,
            description=payload.description,
        )
    )
    db.commit()
    db.refresh(profile)
    return profile


def delete_experience(db: Session, current: CurrentUser, experience_id: str) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    item = db.execute(
        select(CandidateExperience).where(
            CandidateExperience.id == experience_id,
            # Ownership is part of the WHERE clause, not a follow-up check.
            CandidateExperience.profile_id == profile.id,
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("Experience entry not found")
    db.delete(item)
    db.commit()
    db.refresh(profile)
    return profile


def add_education(db: Session, current: CurrentUser, payload: EducationIn) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    profile.education.append(
        CandidateEducation(
            degree=payload.degree.strip(),
            field=(payload.field or None),
            institution=payload.institution.strip(),
            start_year=payload.start_year,
            end_year=payload.end_year,
            gpa=payload.gpa,
        )
    )
    db.commit()
    db.refresh(profile)
    return profile


def delete_education(db: Session, current: CurrentUser, education_id: str) -> CandidateProfile:
    profile = get_profile_for_update(db, current)
    item = db.execute(
        select(CandidateEducation).where(
            CandidateEducation.id == education_id,
            CandidateEducation.profile_id == profile.id,
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("Education entry not found")
    db.delete(item)
    db.commit()
    db.refresh(profile)
    return profile

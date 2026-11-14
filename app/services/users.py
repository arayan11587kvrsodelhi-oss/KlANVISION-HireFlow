"""Account lifecycle: registration, credential verification, password changes."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.company import Company, RecruiterCompanyMembership
from app.models.user import CandidateProfile, RecruiterProfile, User
from app.schemas.user import RegisterRequest
from app.security.errors import ConflictError, ValidationError
from app.services import auth as auth_service


def normalize_email(email: str) -> str:
    """Lower-case and trim; email uniqueness is case-insensitive."""
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.execute(
        select(User).where(User.email == normalize_email(email))
    ).scalar_one_or_none()


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    role: str,
    full_name: str,
    company_name: Optional[str] = None,
    is_verified: bool = False,
) -> User:
    """Create a user plus the matching profile (and company for recruiters).

    Everything happens in one transaction: a recruiter without a company would
    be able to sign in but could not do anything, which is a broken state we
    refuse to persist.
    """
    if role not in {"candidate", "recruiter"}:
        raise ValidationError("Only candidate and recruiter accounts can be self-registered")

    normalized = normalize_email(email)
    existing = get_user_by_email(db, normalized)
    if existing is not None:
        # Generic message: do not disclose that the address is registered to a
        # different role, and keep the response shape identical to success.
        raise ConflictError("An account with this email address already exists")

    user = User(
        email=normalized,
        hashed_password=auth_service.get_password_hash(password),
        role=role,
        is_active=True,
        is_verified=is_verified,
    )
    db.add(user)

    try:
        db.flush()  # assigns user.id via the column default
        if role == "candidate":
            db.add(CandidateProfile(user_id=user.id, full_name=full_name.strip()))
        else:
            profile = RecruiterProfile(user_id=user.id, full_name=full_name.strip())
            db.add(profile)
            db.flush()
            company = Company(
                name=(company_name or "").strip(),
                is_verified=False,
            )
            db.add(company)
            db.flush()
            db.add(
                RecruiterCompanyMembership(
                    recruiter_id=profile.id, company_id=company.id, role="owner"
                )
            )
        db.commit()
    except IntegrityError:
        # Race between the existence check and the insert.
        db.rollback()
        raise ConflictError("An account with this email address already exists")

    db.refresh(user)
    return user


def register(db: Session, payload: RegisterRequest) -> User:
    return create_user(
        db,
        email=str(payload.email),
        password=payload.password,
        role=payload.role,
        full_name=payload.full_name,
        company_name=payload.company_name,
    )


def authenticate(db: Session, email: str, password: str) -> Optional[User]:
    """Verify credentials.

    Returns the user on success. Returns ``None`` for an unknown email *and* for
    a wrong password, and always spends a comparable amount of time so the
    response cannot be used to enumerate accounts.
    """
    user = get_user_by_email(db, email)
    if user is None:
        auth_service.verify_dummy_password(password)
        return None
    if not auth_service.verify_password(password, user.hashed_password):
        return None
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not auth_service.verify_password(current_password, user.hashed_password):
        raise ValidationError("Current password is incorrect")
    user.hashed_password = auth_service.get_password_hash(new_password)
    db.commit()

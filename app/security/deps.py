"""Authentication and authorization dependencies.

Every protected router depends on one of :func:`get_current_user`,
:func:`require_candidate`, :func:`require_recruiter` or :func:`require_admin`.

The current user is **always** loaded from the database on each request:

* the JWT signature proves the token was issued by this API;
* the DB row proves the account still exists, is still active, and tells us the
  *current* role. A token minted when the user was a candidate cannot be used to
  call recruiter endpoints after a (non-existent today, but future) role change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db_session
from app.models.company import Company, RecruiterCompanyMembership
from app.models.user import CandidateProfile, RecruiterProfile, RefreshToken, User
from app.security.errors import AuthError, ForbiddenError
from app.services import auth as auth_service
from app.services import session as session_service

DbSession = Annotated[Session, Depends(get_db_session)]


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated principal plus its loaded relations."""

    user: User
    candidate_profile: CandidateProfile | None
    recruiter_profile: RecruiterProfile | None
    membership: RecruiterCompanyMembership | None

    @property
    def id(self) -> str:
        return self.user.id

    @property
    def role(self) -> str:
        return self.user.role

    @property
    def company(self) -> Company | None:
        return self.membership.company if self.membership else None

    @property
    def company_id(self) -> str | None:
        """Company id derived from the DB membership - never from the client."""
        return self.membership.company_id if self.membership else None

    @property
    def company_name(self) -> str | None:
        return self.membership.company.name if self.membership else None

    @property
    def full_name(self) -> str | None:
        if self.candidate_profile and self.candidate_profile.full_name:
            return self.candidate_profile.full_name
        if self.recruiter_profile and self.recruiter_profile.full_name:
            return self.recruiter_profile.full_name
        return None


def _extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization")
    if not header:
        return None
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        return None
    return credentials.strip()


def load_current_user(db: Session, token: str) -> CurrentUser:
    """Resolve a bearer token to a fully-checked :class:`CurrentUser`."""
    payload = auth_service.decode_access_token(token)
    if payload is None:
        raise AuthError("Invalid or expired session")

    user_id = payload["sub"]

    # The refresh-token row is the server-side record of the session. Resolve it
    # first, because the user join below would otherwise resurrect a *deleted*
    # user from the session's identity map and the token would keep working.
    session_id = payload.get("sid")
    if session_id:
        session_row = db.execute(
            select(RefreshToken).where(RefreshToken.family_id == session_id).limit(1)
        ).scalar_one_or_none()
        if session_row is None:
            # No session record: logged out, account deleted, or a token from a
            # session that never existed. All the same answer.
            raise AuthError("Session has expired")
        if session_row.user_id != user_id:
            # Token subject does not match the session it claims to belong to.
            raise AuthError("Invalid session")
        if session_service.is_session_revoked(db, session_id):
            raise AuthError("Session has been signed out")

    user = db.execute(
        select(User)
        .options(
            joinedload(User.candidate_profile),
            joinedload(User.recruiter_profile)
            .joinedload(RecruiterProfile.memberships)
            .joinedload(RecruiterCompanyMembership.company),
        )
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
    ).unique().scalar_one_or_none()

    if user is None:
        # Token subject no longer exists (account deleted).
        raise AuthError("Invalid or expired session")
    if not user.is_active:
        # Suspended accounts keep their token signature but are refused here.
        raise ForbiddenError("This account has been suspended")

    membership = None
    if user.recruiter_profile is not None:
        memberships = list(user.recruiter_profile.memberships)
        membership = next((m for m in memberships if m.role == "owner"), None)
        if membership is None and memberships:
            membership = memberships[0]

    return CurrentUser(
        user=user,
        candidate_profile=user.candidate_profile,
        recruiter_profile=user.recruiter_profile,
        membership=membership,
    )


def get_current_user(request: Request, db: DbSession) -> CurrentUser:
    """Require a valid access token. Raises 401 otherwise."""
    token = _extract_bearer_token(request)
    if not token:
        raise AuthError("Not authenticated")
    return load_current_user(db, token)


def get_optional_user(request: Request, db: DbSession) -> CurrentUser | None:
    """Resolve the caller if a valid token is present, otherwise ``None``.

    Used by public endpoints that personalise their response (e.g. the job board
    shows drafts to the owning recruiter).
    """
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        return load_current_user(db, token)
    except Exception:
        return None


def require_candidate(current: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    if current.role != "candidate":
        raise ForbiddenError("This operation is only available to candidates")
    return current


def require_recruiter(current: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    if current.role != "recruiter":
        raise ForbiddenError("This operation is only available to recruiters")
    if current.company_id is None:
        raise ForbiddenError("Your recruiter account is not linked to a company")
    return current


def require_admin(current: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    if current.role != "admin":
        raise ForbiddenError("This operation is only available to administrators")
    return current


def require_staff(current: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    """Recruiter **or** admin.

    Used for operations that belong to the hiring organisation: a recruiter may
    perform them on their own company's resources and an administrator may
    perform them on any. :func:`app.services.jobs.get_owned_job` applies the
    company scoping, so a recruiter still cannot touch another company's job.
    """
    if current.role not in {"recruiter", "admin"}:
        raise ForbiddenError("Only recruiters and administrators can perform this operation")
    return current


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
OptionalUserDep = Annotated[CurrentUser | None, Depends(get_optional_user)]
CandidateDep = Annotated[CurrentUser, Depends(require_candidate)]
RecruiterDep = Annotated[CurrentUser, Depends(require_recruiter)]
AdminDep = Annotated[CurrentUser, Depends(require_admin)]
StaffDep = Annotated[CurrentUser, Depends(require_staff)]

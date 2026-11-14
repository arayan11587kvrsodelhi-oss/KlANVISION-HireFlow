"""Candidate-only endpoints.

There is no ``/candidates/{candidate_id}`` variant on purpose: every route here
resolves the profile from the access token, so one candidate has no way to name
another candidate.
"""

from __future__ import annotations

from fastapi import APIRouter, File, Response, UploadFile, status

from app.schemas.application import ApplicationCounts, ApplicationOut
from app.schemas.candidate import (
    CandidateProfileOut,
    CandidateProfileUpdate,
    EducationIn,
    SkillsUpdate,
    WorkExperienceIn,
)
from app.schemas.common import MessageResponse
from app.schemas.resume import ResumeOut
from app.security.deps import CandidateDep, CurrentUserDep, DbSession
from app.services import applications as application_service
from app.services import candidates as candidate_service
from app.services import resumes as resume_service
from app.services.serializers import (
    serialize_application,
    serialize_candidate_profile,
    serialize_resume,
)

router = APIRouter(prefix="/candidates", tags=["candidates"])


def _profile_response(db, current) -> CandidateProfileOut:
    profile = candidate_service.get_profile_for_update(db, current)
    return serialize_candidate_profile(profile)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@router.get("/me/profile", response_model=CandidateProfileOut, summary="My profile")
def get_my_profile(current: CandidateDep, db: DbSession) -> CandidateProfileOut:
    return _profile_response(db, current)


@router.patch("/me/profile", response_model=CandidateProfileOut, summary="Update my profile")
def update_my_profile(
    payload: CandidateProfileUpdate, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.update_profile(db, current, payload)
    return _profile_response(db, current)


@router.put("/me/skills", response_model=CandidateProfileOut, summary="Replace my skills")
def replace_my_skills(
    payload: SkillsUpdate, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.replace_skills(db, current, payload)
    return _profile_response(db, current)


@router.post(
    "/me/experience",
    response_model=CandidateProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a work-experience entry",
)
def add_experience(
    payload: WorkExperienceIn, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.add_experience(db, current, payload)
    return _profile_response(db, current)


@router.delete(
    "/me/experience/{experience_id}",
    response_model=CandidateProfileOut,
    summary="Delete a work-experience entry",
)
def delete_experience(
    experience_id: str, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.delete_experience(db, current, experience_id)
    return _profile_response(db, current)


@router.post(
    "/me/education",
    response_model=CandidateProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an education entry",
)
def add_education(
    payload: EducationIn, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.add_education(db, current, payload)
    return _profile_response(db, current)


@router.delete(
    "/me/education/{education_id}",
    response_model=CandidateProfileOut,
    summary="Delete an education entry",
)
def delete_education(
    education_id: str, current: CandidateDep, db: DbSession
) -> CandidateProfileOut:
    candidate_service.delete_education(db, current, education_id)
    return _profile_response(db, current)


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------

@router.post(
    "/me/resume",
    response_model=ResumeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload/replace my resume",
)
def upload_resume(
    current: CandidateDep,
    db: DbSession,
    file: UploadFile = File(..., description="PDF or DOCX, max 10 MB"),
) -> ResumeOut:
    resume = resume_service.save_upload(db, current, file)
    return serialize_resume(resume)


@router.get("/me/resume", response_model=ResumeOut | None, summary="My active resume")
def get_my_resume(current: CandidateDep, db: DbSession) -> ResumeOut | None:
    resume = resume_service.get_resume_for_owner(db, current)
    return serialize_resume(resume) if resume else None


@router.get(
    "/me/resume/{resume_id}",
    summary="Download a resume (owner, or recruiter whose company received the application)",
    response_class=Response,
)
def download_resume(
    resume_id: str, current: CurrentUserDep, db: DbSession
) -> Response:
    # Uses the generic authenticated dependency (not candidate-only) so the same
    # ownership-checked helper can serve recruiters and admins.
    resume, handle = resume_service.open_for_download(db, current, resume_id)
    safe_name = resume.filename.replace('"', "")
    with handle:
        payload = handle.read()
    return Response(
        content=payload,
        media_type=resume.mimetype or "application/octet-stream",
        headers={
            # ``attachment`` forces download and, with nosniff, stops the browser
            # from rendering attacker-supplied content inline.
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/me/resume", response_model=MessageResponse, summary="Delete my resume")
def delete_resume(current: CandidateDep, db: DbSession) -> MessageResponse:
    resume_service.delete_active_resume(db, current)
    return MessageResponse(message="Resume deleted")


# ---------------------------------------------------------------------------
# Applications (candidate view)
# ---------------------------------------------------------------------------

@router.get("/me/applications", response_model=list[ApplicationOut], summary="My applications")
def my_applications(current: CandidateDep, db: DbSession) -> list[ApplicationOut]:
    rows = application_service.list_candidate_applications(db, current)
    return [
        serialize_application(row, include_recruiter_fields=False, include_history=True)
        for row in rows
    ]


# NOTE: this static route must be declared before "/me/resume/{resume_id}",
# otherwise the dynamic resume path matches first and the request 404s.
@router.get(
    "/me/applications/counts",
    response_model=ApplicationCounts,
    summary="My application counts by stage",
)
def my_application_counts(current: CandidateDep, db: DbSession) -> ApplicationCounts:
    return ApplicationCounts(**application_service.candidate_application_counts(db, current))

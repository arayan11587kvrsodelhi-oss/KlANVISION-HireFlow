"""Domain exceptions that map to specific HTTP responses.

Two rules encoded here:

1. **404, not 403, for objects the caller does not own.** Returning 403 on a
   foreign id confirms that the id exists, which is an enumeration oracle. A
   caller who is not allowed to see a resource is told it does not exist.
2. **401 only for "no/!valid credentials".** A missing or expired session is
   never reported as 403, so the SPA can tell "sign in again" from "denied".
"""

from __future__ import annotations

from fastapi import HTTPException, status


class AuthError(HTTPException):
    """401 - credentials missing, invalid, or expired."""

    def __init__(self, detail: str = "Not authenticated", code: str = "not_authenticated"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
        self.code = code


class ForbiddenError(HTTPException):
    """403 - authenticated but not allowed to perform this operation."""

    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        self.code = "forbidden"


class NotFoundError(HTTPException):
    """404 - resource missing *or* not visible to this caller."""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        self.code = "not_found"


class ConflictError(HTTPException):
    """409 - duplicate resource or invalid state transition."""

    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)
        self.code = "conflict"


class ValidationError(HTTPException):
    """422 - request understood but semantically invalid."""

    def __init__(self, detail: str = "Invalid request"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
        self.code = "validation_error"


class RateLimitError(HTTPException):
    """429 - too many requests."""

    def __init__(self, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please retry later.",
            headers={"Retry-After": str(retry_after)},
        )
        self.code = "rate_limited"

"""Shared schema building blocks."""

from __future__ import annotations

from typing import Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for response models read from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """A single page of results plus the metadata needed to page further."""

    items: List[T]
    total: int = Field(..., ge=0, description="Total rows matching the filter")
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    has_more: bool

    @classmethod
    def build(cls, items: list, total: int, page: int, page_size: int) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=page * page_size < total,
        )


class ErrorResponse(BaseModel):
    """Uniform error envelope returned by every failing endpoint."""

    detail: str
    code: str = Field(default="error", description="Machine-readable error code")
    errors: list[dict] | None = Field(
        default=None, description="Field-level validation details when applicable"
    )


class MessageResponse(BaseModel):
    message: str

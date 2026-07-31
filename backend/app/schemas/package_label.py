from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import PackageLabelStatus
from app.schemas.base import ReadSchema


class PackageLabelCreate(BaseModel):
    status: PackageLabelStatus = PackageLabelStatus.DRAFT
    display_name: str
    description: str | None = None
    ingredients_summary: str | None = None
    preparation_summary: str | None = None
    rehydration_instructions: str | None = None
    serving_notes: str | None = None
    net_weight_display: str | None = None
    fresh_equivalent_display: str | None = None


class PackageLabelUpdate(BaseModel):
    status: PackageLabelStatus | None = None
    display_name: str | None = None
    description: str | None = None
    ingredients_summary: str | None = None
    preparation_summary: str | None = None
    rehydration_instructions: str | None = None
    serving_notes: str | None = None
    net_weight_display: str | None = None
    fresh_equivalent_display: str | None = None


class PackageLabelRead(PackageLabelCreate, ReadSchema):
    id: UUID
    package_id: UUID
    created_at: datetime
    updated_at: datetime

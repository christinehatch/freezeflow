from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.enums import ProductionBatchStatus
from app.schemas.base import ReadSchema


class ProductionBatchCreate(BaseModel):
    freeze_dryer_id: UUID
    batch_number: str
    notes: str | None = None

    @field_validator("batch_number")
    @classmethod
    def batch_number_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Batch Number must not be blank.")
        return stripped


class ProductionBatchUpdate(BaseModel):
    freeze_dryer_id: UUID | None = None
    notes: str | None = None


class ProductionBatchStart(BaseModel):
    started_at: datetime | None = None


class ProductionBatchNotesCorrection(BaseModel):
    notes: str
    reason: str | None = None


class ProductionBatchRead(ReadSchema):
    id: UUID
    freeze_dryer_id: UUID
    batch_number: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    status: ProductionBatchStatus

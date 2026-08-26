from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ProductionBatchStatus
from app.schemas.base import ReadSchema


class ProductionBatchCreate(BaseModel):
    freeze_dryer_id: UUID
    batch_number: str
    notes: str | None = None


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

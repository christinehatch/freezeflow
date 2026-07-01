from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ProductionBatchStatus
from app.schemas.base import ReadSchema


class ProductionBatchCreate(BaseModel):
    freeze_dryer_id: UUID
    batch_number: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    status: ProductionBatchStatus = ProductionBatchStatus.DRAFT


class ProductionBatchUpdate(BaseModel):
    freeze_dryer_id: UUID | None = None
    batch_number: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    status: ProductionBatchStatus | None = None


class ProductionBatchRead(ProductionBatchCreate, ReadSchema):
    id: UUID

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PackagingOperationCreate(BaseModel):
    packaged_at: datetime
    total_source_weight_grams: Decimal
    notes: str | None = None


class PackagingOperationUpdate(BaseModel):
    packaged_at: datetime | None = None
    total_source_weight_grams: Decimal | None = None
    notes: str | None = None


class PackagingOperationRead(PackagingOperationCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PackagingOperationTrayCreate(BaseModel):
    packaging_operation_id: UUID
    tray_id: UUID


class PackagingOperationTrayUpdate(BaseModel):
    packaging_operation_id: UUID | None = None
    tray_id: UUID | None = None


class PackagingOperationTrayRead(PackagingOperationTrayCreate, ReadSchema):
    id: UUID

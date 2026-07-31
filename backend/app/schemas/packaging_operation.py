from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import PackagingOperationStatus
from app.schemas.base import ReadSchema


class PackagingOperationCreate(BaseModel):
    production_batch_id: UUID
    status: PackagingOperationStatus = PackagingOperationStatus.OPEN
    started_at: datetime
    completed_at: datetime | None = None
    notes: str | None = None


class PackagingOperationUpdate(BaseModel):
    status: PackagingOperationStatus | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class PackagingOperationRead(PackagingOperationCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PackagingAllocationCreate(BaseModel):
    packaging_operation_id: UUID
    notes: str | None = None


class PackagingAllocationUpdate(BaseModel):
    notes: str | None = None


class PackagingAllocationRead(PackagingAllocationCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PackagingAllocationSourceTrayCreate(BaseModel):
    packaging_allocation_id: UUID
    tray_id: UUID


class PackagingAllocationSourceTrayRead(
    PackagingAllocationSourceTrayCreate, ReadSchema
):
    id: UUID

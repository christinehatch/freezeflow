from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PackagingOperationCreate(BaseModel):
    packaged_at: datetime
    notes: str | None = None


class PackagingOperationUpdate(BaseModel):
    packaged_at: datetime | None = None
    notes: str | None = None


class PackagingOperationRead(PackagingOperationCreate, ReadSchema):
    id: UUID


class PackagingOperationTrayCreate(BaseModel):
    packaging_operation_id: UUID
    tray_id: UUID


class PackagingOperationTrayUpdate(BaseModel):
    packaging_operation_id: UUID | None = None
    tray_id: UUID | None = None


class PackagingOperationTrayRead(PackagingOperationTrayCreate, ReadSchema):
    id: UUID

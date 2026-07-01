from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class StorageLocationCreate(BaseModel):
    name: str
    description: str | None = None
    archived_at: datetime | None = None


class StorageLocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    archived_at: datetime | None = None


class StorageLocationRead(StorageLocationCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class StorageLocationHistoryCreate(BaseModel):
    package_id: UUID
    previous_storage_location_id: UUID | None = None
    new_storage_location_id: UUID
    moved_at: datetime
    notes: str | None = None


class StorageLocationHistoryUpdate(BaseModel):
    package_id: UUID | None = None
    previous_storage_location_id: UUID | None = None
    new_storage_location_id: UUID | None = None
    moved_at: datetime | None = None
    notes: str | None = None


class StorageLocationHistoryRead(StorageLocationHistoryCreate, ReadSchema):
    id: UUID

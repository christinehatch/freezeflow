from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class FreezeDryerCreate(BaseModel):
    name: str
    manufacturer: str
    model: str
    serial_number: str | None = None
    tray_count: int
    notes: str | None = None


class FreezeDryerUpdate(BaseModel):
    name: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    tray_count: int | None = None
    notes: str | None = None


class FreezeDryerRead(FreezeDryerCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime

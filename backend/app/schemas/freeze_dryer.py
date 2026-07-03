from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema


class FreezeDryerCreate(BaseModel):
    name: str
    notes: str | None = None
    archived: bool = False
    tray_slot_count: int = Field(default=4, ge=1)


class FreezeDryerUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    archived: bool | None = None
    tray_slot_count: int | None = Field(default=None, ge=1)


class FreezeDryerRead(FreezeDryerCreate, ReadSchema):
    id: UUID

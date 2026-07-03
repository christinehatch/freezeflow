from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema


class TraySlotCreate(BaseModel):
    freeze_dryer_id: UUID
    slot_number: int = Field(ge=1)
    label: str | None = None
    archived: bool = False


class TraySlotUpdate(BaseModel):
    slot_number: int | None = Field(default=None, ge=1)
    label: str | None = None
    archived: bool | None = None


class TraySlotRead(ReadSchema):
    id: UUID
    freeze_dryer_id: UUID
    slot_number: int
    label: str | None = None
    archived: bool

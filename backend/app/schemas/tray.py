from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TrayStatus
from app.schemas.base import ReadSchema


class TrayCreate(BaseModel):
    tray_number: int
    recipe_id: UUID | None = None
    product_name: str | None = None
    preparation: str | None = None
    notes: str | None = None


class TrayUpdate(BaseModel):
    tray_number: int | None = None
    product_name: str | None = None
    preparation: str | None = None
    notes: str | None = None


class TrayRead(ReadSchema):
    id: UUID
    production_batch_id: UUID
    tray_number: int
    recipe_id: UUID | None = None
    product_name: str
    preparation: str
    notes: str | None = None
    status: TrayStatus

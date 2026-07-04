from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TrayStatus
from app.schemas.base import ReadSchema


class TrayCreate(BaseModel):
    tray_slot_id: UUID
    physical_tray_id: UUID
    recipe_id: UUID | None = None
    product_name: str | None = None
    preparation: str | None = None
    starting_weight_grams: Decimal | None = None
    notes: str | None = None


class TrayUpdate(BaseModel):
    tray_slot_id: UUID | None = None
    physical_tray_id: UUID | None = None
    product_name: str | None = None
    preparation: str | None = None
    starting_weight_grams: Decimal | None = None
    notes: str | None = None


class TrayStartingWeightUpdate(BaseModel):
    starting_weight_grams: Decimal


class TrayComplete(BaseModel):
    final_dry_weight_grams: Decimal


class TrayRead(ReadSchema):
    id: UUID
    production_batch_id: UUID
    tray_slot_id: UUID
    physical_tray_id: UUID
    recipe_id: UUID | None = None
    product_name: str
    preparation: str
    starting_weight_grams: Decimal | None = None
    final_dry_weight_grams: Decimal | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    status: TrayStatus

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TrayStatus
from app.schemas.base import ReadSchema


class TrayCreate(BaseModel):
    tray_slot_id: UUID
    physical_tray_id: UUID
    preparation_preset_id: UUID | None = None
    product_name: str | None = None
    ingredients: list[str] | None = None
    preparation_methods: list[str] | None = None
    starting_weight_grams: Decimal | None = None
    notes: str | None = None


class TrayUpdate(BaseModel):
    tray_slot_id: UUID | None = None
    physical_tray_id: UUID | None = None
    product_name: str | None = None
    ingredients: list[str] | None = None
    preparation_methods: list[str] | None = None
    starting_weight_grams: Decimal | None = None
    notes: str | None = None


class TrayStartingWeightUpdate(BaseModel):
    starting_weight_grams: Decimal


class TrayComplete(BaseModel):
    final_dry_weight_grams: Decimal


class TrayNotesCorrection(BaseModel):
    notes: str
    reason: str | None = None


class TrayPreparationCorrection(BaseModel):
    product_name: str | None = None
    ingredients: list[str] | None = None
    preparation_methods: list[str] | None = None
    reason: str | None = None


class TrayStartingWeightCorrection(BaseModel):
    starting_weight_grams: Decimal
    reason: str | None = None


class TrayFinalDryWeightCorrection(BaseModel):
    final_dry_weight_grams: Decimal
    reason: str | None = None


class TrayRead(ReadSchema):
    id: UUID
    production_batch_id: UUID
    tray_slot_id: UUID
    physical_tray_id: UUID
    preparation_preset_id: UUID | None = None
    preparation_preset_name_at_use: str | None = None
    product_name: str
    ingredients: list[str] | None = None
    preparation_methods: list[str] | None = None
    # Legacy freeform fallback, only populated on pre-Milestone-6 Trays.
    preparation: str | None = None
    starting_weight_grams: Decimal | None = None
    final_dry_weight_grams: Decimal | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    status: TrayStatus

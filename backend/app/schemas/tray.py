from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TrayStatus
from app.schemas.base import ReadSchema


class TrayCreate(BaseModel):
    production_batch_id: UUID
    recipe_id: UUID | None = None
    tray_number: int
    product_name: str
    preparation: str
    starting_weight_grams: Decimal
    final_dry_weight_grams: Decimal | None = None
    status: TrayStatus = TrayStatus.DRAFT
    notes: str | None = None


class TrayUpdate(BaseModel):
    production_batch_id: UUID | None = None
    recipe_id: UUID | None = None
    tray_number: int | None = None
    product_name: str | None = None
    preparation: str | None = None
    starting_weight_grams: Decimal | None = None
    final_dry_weight_grams: Decimal | None = None
    status: TrayStatus | None = None
    notes: str | None = None


class TrayRead(TrayCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime

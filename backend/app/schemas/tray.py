from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TrayStatus
from app.schemas.base import ReadSchema


class TrayCreate(BaseModel):
    production_batch_id: UUID
    tray_number: int
    recipe_id: UUID | None = None
    product_name: str
    preparation: str
    notes: str | None = None
    final_dry_weight_grams: Decimal | None = None
    starting_weight_grams: Decimal | None = None
    completed_at: datetime | None = None
    status: TrayStatus = TrayStatus.DRAFT


class TrayUpdate(BaseModel):
    production_batch_id: UUID | None = None
    recipe_id: UUID | None = None
    tray_number: int | None = None
    product_name: str | None = None
    preparation: str | None = None
    notes: str | None = None
    starting_weight_grams: Decimal | None = None
    final_dry_weight_grams: Decimal | None = None
    completed_at: datetime | None = None
    status: TrayStatus | None = None


class TrayRead(TrayCreate, ReadSchema):
    id: UUID

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class WeightCheckCreate(BaseModel):
    drying_run_id: UUID
    weight_grams: Decimal
    observed_at: datetime
    notes: str | None = None


class WeightCheckCorrection(BaseModel):
    weight_grams: Decimal
    reason: str | None = None


class WeightCheckUpdate(BaseModel):
    drying_run_id: UUID | None = None
    weight_grams: Decimal | None = None
    observed_at: datetime | None = None
    recorded_at: datetime | None = None
    notes: str | None = None


class WeightCheckRead(ReadSchema):
    id: UUID
    tray_id: UUID
    drying_run_id: UUID
    weight_grams: Decimal
    observed_at: datetime
    recorded_at: datetime
    notes: str | None = None

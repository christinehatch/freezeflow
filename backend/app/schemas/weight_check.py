from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class WeightCheckCreate(BaseModel):
    tray_id: UUID
    observed_at: datetime
    recorded_at: datetime | None = None
    elapsed_hours: Decimal
    weight_grams: Decimal
    notes: str | None = None


class WeightCheckUpdate(BaseModel):
    tray_id: UUID | None = None
    observed_at: datetime | None = None
    recorded_at: datetime | None = None
    elapsed_hours: Decimal | None = None
    weight_grams: Decimal | None = None
    notes: str | None = None


class WeightCheckRead(WeightCheckCreate, ReadSchema):
    id: UUID
    recorded_at: datetime

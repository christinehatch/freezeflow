from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import InventoryStatus
from app.schemas.base import ReadSchema


class PackageStatusHistoryCreate(BaseModel):
    package_id: UUID
    previous_status: InventoryStatus | None = None
    current_status: InventoryStatus
    effective_at: datetime
    notes: str | None = None


class PackageStatusHistoryRead(PackageStatusHistoryCreate, ReadSchema):
    id: UUID
    recorded_at: datetime

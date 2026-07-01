from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import InventoryStatus
from app.schemas.base import ReadSchema


class PackageCreate(BaseModel):
    packaging_operation_id: UUID
    package_date: datetime
    package_weight_grams: Decimal
    oxygen_absorber: str
    storage_location_id: UUID
    inventory_status: InventoryStatus = InventoryStatus.IN_STORAGE
    notes: str | None = None


class PackageUpdate(BaseModel):
    packaging_operation_id: UUID | None = None
    package_date: datetime | None = None
    package_weight_grams: Decimal | None = None
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    inventory_status: InventoryStatus | None = None
    notes: str | None = None


class PackageRead(PackageCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime

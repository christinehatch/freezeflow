from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import InventoryStatus
from app.schemas.base import ReadSchema


class PackageCreate(BaseModel):
    packaging_operation_id: UUID
    package_type_id: UUID
    package_identifier: str
    storage_location_id: UUID
    package_weight_grams: Decimal
    oxygen_absorber: str | None = None
    notes: str | None = None
    status: InventoryStatus = InventoryStatus.IN_STORAGE


class PackageUpdate(BaseModel):
    packaging_operation_id: UUID | None = None
    package_type_id: UUID | None = None
    package_identifier: str | None = None
    storage_location_id: UUID | None = None
    package_weight_grams: Decimal | None = None
    oxygen_absorber: str | None = None
    notes: str | None = None
    status: InventoryStatus | None = None


class PackageRead(PackageCreate, ReadSchema):
    id: UUID

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import InventoryStatus
from app.schemas.base import ReadSchema
from app.schemas.package_label import PackageLabelCreate


class PackageCreate(BaseModel):
    packaging_allocation_id: UUID
    package_type_id: UUID
    package_identifier: str
    packaged_at: datetime
    storage_location_id: UUID | None = None
    package_weight_grams: Decimal = Field(gt=0)
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    oxygen_absorber: str | None = None
    notes: str | None = None
    label: PackageLabelCreate | None = None


class PackageUpdate(BaseModel):
    package_type_id: UUID | None = None
    package_identifier: str | None = None
    packaged_at: datetime | None = None
    storage_location_id: UUID | None = None
    package_weight_grams: Decimal | None = Field(default=None, gt=0)
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    oxygen_absorber: str | None = None
    notes: str | None = None


class PackageRead(ReadSchema):
    id: UUID
    packaging_allocation_id: UUID
    package_type_id: UUID
    package_identifier: str
    packaged_at: datetime
    storage_location_id: UUID
    package_weight_grams: Decimal
    finished_product_weight_grams: Decimal | None
    oxygen_absorber: str | None
    notes: str | None
    status: InventoryStatus

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PackageLineCreate(BaseModel):
    package_type_id: UUID
    finished_product_weight_grams: Decimal
    package_weight_grams: Decimal
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    notes: str | None = None


class PackageSelectedTrays(BaseModel):
    tray_ids: list[UUID] = Field(min_length=1)
    packages: list[PackageLineCreate] = Field(min_length=1)
    packaged_at: datetime | None = None
    notes: str | None = None


class PackageLabelRequest(BaseModel):
    package_ids: list[UUID] = Field(min_length=1)

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import PackageLabelStatus
from app.schemas.base import ReadSchema


class PlannedPackageRowCreate(BaseModel):
    packaging_allocation_id: UUID
    package_type_id: UUID | None = None
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    finished_product_weight_unit: str | None = None
    sealed_package_weight_grams: Decimal | None = Field(default=None, gt=0)
    sealed_package_weight_unit: str | None = None
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    notes: str | None = None
    label_status: PackageLabelStatus = PackageLabelStatus.DRAFT
    label_display_name: str | None = None
    label_description: str | None = None
    label_ingredients_summary: str | None = None
    label_preparation_summary: str | None = None
    label_rehydration_instructions: str | None = None
    label_serving_notes: str | None = None
    label_net_weight_display: str | None = None
    label_fresh_equivalent_display: str | None = None


class PlannedPackageRowUpdate(BaseModel):
    package_type_id: UUID | None = None
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    finished_product_weight_unit: str | None = None
    sealed_package_weight_grams: Decimal | None = Field(default=None, gt=0)
    sealed_package_weight_unit: str | None = None
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    notes: str | None = None
    label_status: PackageLabelStatus | None = None
    label_display_name: str | None = None
    label_description: str | None = None
    label_ingredients_summary: str | None = None
    label_preparation_summary: str | None = None
    label_rehydration_instructions: str | None = None
    label_serving_notes: str | None = None
    label_net_weight_display: str | None = None
    label_fresh_equivalent_display: str | None = None


class PlannedPackageRowRead(PlannedPackageRowCreate, ReadSchema):
    id: UUID
    recorded_package_id: UUID | None
    created_at: datetime
    updated_at: datetime

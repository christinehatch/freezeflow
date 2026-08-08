from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import PackagingLossReason


class PackagingOperationStart(BaseModel):
    started_at: datetime | None = None
    notes: str | None = None


class PackagingOperationComplete(BaseModel):
    completed_at: datetime | None = None


class PackagingAllocationCreateRequest(BaseModel):
    tray_ids: list[UUID] = Field(min_length=1)
    notes: str | None = None


class PlannedPackageInput(BaseModel):
    id: UUID | None = None
    package_type_id: UUID | None = None
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    finished_product_weight_unit: str | None = None
    sealed_package_weight_grams: Decimal | None = Field(default=None, gt=0)
    sealed_package_weight_unit: str | None = None
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    notes: str | None = None
    label_display_name: str | None = None
    label_description: str | None = None
    label_ingredients_summary: str | None = None
    label_preparation_summary: str | None = None
    label_rehydration_instructions: str | None = None
    label_serving_notes: str | None = None
    label_net_weight_display: str | None = None
    label_fresh_equivalent_display: str | None = None


class PackagingAllocationUpdateRequest(BaseModel):
    tray_ids: list[UUID] | None = Field(default=None, min_length=1)
    notes: str | None = None
    planned_packages: list[PlannedPackageInput] | None = None


class PackageLabelValues(BaseModel):
    display_name: str | None = None
    description: str | None = None
    ingredients_summary: str | None = None
    preparation_summary: str | None = None
    rehydration_instructions: str | None = None
    serving_notes: str | None = None
    net_weight_display: str | None = None
    fresh_equivalent_display: str | None = None


class PackageLineCreate(BaseModel):
    planned_package_row_id: UUID | None = None
    package_type_id: UUID | None = None
    finished_product_weight_grams: Decimal | None = Field(default=None, gt=0)
    sealed_package_weight_grams: Decimal | None = Field(default=None, gt=0)
    oxygen_absorber: str | None = None
    storage_location_id: UUID | None = None
    packaged_at: datetime | None = None
    notes: str | None = None
    label: PackageLabelValues | None = None


class RecordAllocationPackages(BaseModel):
    packages: list[PackageLineCreate] = Field(min_length=1)


class RecordPackagingLoss(BaseModel):
    weight_grams: Decimal = Field(gt=0)
    reason: PackagingLossReason
    reason_detail: str | None = None


class PackageLabelSelection(BaseModel):
    package_label_ids: list[UUID] = Field(min_length=1)
    template: str = "Avery 5163"
    printed_at: datetime | None = None
    notes: str | None = None

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportFilters(BaseModel):
    """A generic, reusable bag of report query parameters.

    Deliberately carries no per-report validation or report-aware
    branching - each report function reads whichever fields apply to it
    and ignores the rest. See ADR-0019 and docs/implementation/07-milestone-7.md.
    """

    date_from: date | None = None
    date_to: date | None = None
    freeze_dryer_id: UUID | None = None
    product_name: str | None = None
    preparation_preset_id: UUID | None = None
    production_batch_id: UUID | None = None


class FreezeDryerPerformanceRow(BaseModel):
    freeze_dryer_id: UUID
    freeze_dryer_name: str
    completed_production_batch_count: int
    average_dry_time_seconds: float | None
    average_weight_loss_percent: Decimal | None
    average_time_to_completion_seconds: float | None


class ProductHistoryRow(BaseModel):
    product_name: str
    times_produced: int
    average_drying_time_seconds: float | None
    average_yield_percent: Decimal | None
    last_batch_completed_at: datetime | None


class PreparationHistoryRow(BaseModel):
    preparation_preset_name: str
    used_preset: bool
    times_used: int
    average_drying_time_seconds: float | None
    average_yield_percent: Decimal | None
    last_used_completed_at: datetime | None


class DryingTimeRow(BaseModel):
    production_batch_id: UUID
    batch_number: str
    freeze_dryer_name: str
    completed_at: datetime
    total_drying_time_seconds: float
    drying_run_count: int
    voided_drying_run_count: int


class ProductionHistoryRow(BaseModel):
    production_batch_id: UUID
    batch_number: str
    freeze_dryer_name: str
    completed_at: datetime
    tray_count: int
    products: list[str]
    total_drying_time_seconds: float


class MostCommonProduct(BaseModel):
    product_name: str
    package_count: int


class InventorySummary(BaseModel):
    packages_in_storage: int
    packages_given_away: int
    packages_depleted: int
    total_packaged_weight_grams: Decimal
    total_dried_weight_grams: Decimal
    most_common_products: list[MostCommonProduct]

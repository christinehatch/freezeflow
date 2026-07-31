from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import PackageLabelStatus, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.package import Package
    from app.models.package_type import PackageType
    from app.models.packaging_operation import PackagingAllocation
    from app.models.storage_location import StorageLocation


class PlannedPackageRow(IdMixin, Base):
    __tablename__ = "planned_package_rows"
    __table_args__ = (
        CheckConstraint(
            "finished_product_weight_grams is null or "
            "finished_product_weight_grams > 0",
            name="ck_planned_package_rows_finished_weight_positive",
        ),
        CheckConstraint(
            "sealed_package_weight_grams is null or sealed_package_weight_grams > 0",
            name="ck_planned_package_rows_sealed_weight_positive",
        ),
    )

    packaging_allocation_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("packaging_allocations.id"), nullable=False
    )
    package_type_id: Mapped[UUID | None] = mapped_column(
        GUID(), ForeignKey("package_types.id")
    )
    finished_product_weight_grams: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3)
    )
    finished_product_weight_unit: Mapped[str | None] = mapped_column(String(16))
    sealed_package_weight_grams: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    sealed_package_weight_unit: Mapped[str | None] = mapped_column(String(16))
    oxygen_absorber: Mapped[str | None] = mapped_column(String(255))
    storage_location_id: Mapped[UUID | None] = mapped_column(
        GUID(), ForeignKey("storage_locations.id")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    label_status: Mapped[PackageLabelStatus] = mapped_column(
        Enum(
            PackageLabelStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_planned_package_rows_label_status",
        ),
        default=PackageLabelStatus.DRAFT,
        nullable=False,
    )
    label_display_name: Mapped[str | None] = mapped_column(String(255))
    label_description: Mapped[str | None] = mapped_column(Text)
    label_ingredients_summary: Mapped[str | None] = mapped_column(Text)
    label_preparation_summary: Mapped[str | None] = mapped_column(Text)
    label_rehydration_instructions: Mapped[str | None] = mapped_column(Text)
    label_serving_notes: Mapped[str | None] = mapped_column(Text)
    label_net_weight_display: Mapped[str | None] = mapped_column(String(255))
    label_fresh_equivalent_display: Mapped[str | None] = mapped_column(String(255))
    recorded_package_id: Mapped[UUID | None] = mapped_column(
        GUID(), ForeignKey("packages.id"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    packaging_allocation: Mapped[PackagingAllocation] = relationship(
        back_populates="planned_package_rows"
    )
    package_type: Mapped[PackageType | None] = relationship(
        back_populates="planned_package_rows"
    )
    storage_location: Mapped[StorageLocation | None] = relationship(
        back_populates="planned_package_rows"
    )
    recorded_package: Mapped[Package | None] = relationship(
        back_populates="planned_package_row"
    )

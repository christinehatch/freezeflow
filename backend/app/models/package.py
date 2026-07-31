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
from app.models.enums import InventoryStatus, enum_values
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.package_label import PackageLabel
    from app.models.package_status_history import PackageStatusHistory
    from app.models.package_type import PackageType
    from app.models.packaging_operation import PackagingAllocation
    from app.models.planned_package_row import PlannedPackageRow
    from app.models.storage_location import StorageLocation, StorageLocationHistory


class Package(IdMixin, Base):
    __tablename__ = "packages"
    __table_args__ = (
        CheckConstraint(
            "package_weight_grams > 0",
            name="ck_packages_package_weight_positive",
        ),
        CheckConstraint(
            "finished_product_weight_grams is null or "
            "finished_product_weight_grams > 0",
            name="ck_packages_finished_product_weight_positive",
        ),
    )

    packaging_allocation_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packaging_allocations.id"),
        nullable=False,
    )
    package_type_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("package_types.id"),
        nullable=False,
    )
    package_identifier: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )
    packaged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    package_weight_grams: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False
    )
    finished_product_weight_grams: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3), nullable=True
    )
    oxygen_absorber: Mapped[str | None] = mapped_column(String(255))
    storage_location_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("storage_locations.id"),
        nullable=False,
    )
    status: Mapped[InventoryStatus] = mapped_column(
        Enum(
            InventoryStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_packages_status",
        ),
        default=InventoryStatus.IN_STORAGE,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    packaging_allocation: Mapped[PackagingAllocation] = relationship(
        back_populates="packages"
    )
    package_type: Mapped[PackageType] = relationship(back_populates="packages")
    storage_location: Mapped[StorageLocation] = relationship(back_populates="packages")
    storage_location_history: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="package"
    )
    status_history: Mapped[list[PackageStatusHistory]] = relationship(
        back_populates="package"
    )
    label: Mapped[PackageLabel] = relationship(back_populates="package", uselist=False)
    planned_package_row: Mapped[PlannedPackageRow | None] = relationship(
        back_populates="recorded_package", uselist=False
    )

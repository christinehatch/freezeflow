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
    Index,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import PackagingOperationStatus, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.package import Package
    from app.models.packaging_loss import PackagingLoss
    from app.models.planned_package_row import PlannedPackageRow
    from app.models.production_batch import ProductionBatch
    from app.models.tray import Tray


class PackagingOperation(IdMixin, Base):
    __tablename__ = "packaging_operations"
    __table_args__ = (
        CheckConstraint(
            "(status = 'Open' and completed_at is null) or "
            "(status = 'Completed' and completed_at is not null)",
            name="ck_packaging_operations_completion",
        ),
        Index(
            "uq_packaging_operations_open_batch",
            "production_batch_id",
            unique=True,
            sqlite_where=text("status = 'Open'"),
            postgresql_where=text("status = 'Open'"),
        ),
    )

    production_batch_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("production_batches.id"), nullable=False
    )
    status: Mapped[PackagingOperationStatus] = mapped_column(
        Enum(
            PackagingOperationStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_packaging_operations_status",
        ),
        default=PackagingOperationStatus.OPEN,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    production_batch: Mapped[ProductionBatch] = relationship(
        back_populates="packaging_operations"
    )
    allocations: Mapped[list[PackagingAllocation]] = relationship(
        back_populates="packaging_operation", cascade="all, delete-orphan"
    )
    # Phase 1 compatibility for existing read paths. New writes must use allocations.
    packages: Mapped[list[Package]] = relationship(
        "Package",
        secondary="packaging_allocations",
        primaryjoin=(
            "PackagingOperation.id == " "PackagingAllocation.packaging_operation_id"
        ),
        secondaryjoin="PackagingAllocation.id == Package.packaging_allocation_id",
        viewonly=True,
    )


class PackagingAllocation(IdMixin, Base):
    __tablename__ = "packaging_allocations"

    packaging_operation_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("packaging_operations.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    packaging_operation: Mapped[PackagingOperation] = relationship(
        back_populates="allocations"
    )
    source_tray_links: Mapped[list[PackagingAllocationSourceTray]] = relationship(
        back_populates="packaging_allocation", cascade="all, delete-orphan"
    )
    planned_package_rows: Mapped[list[PlannedPackageRow]] = relationship(
        back_populates="packaging_allocation", cascade="all, delete-orphan"
    )
    packages: Mapped[list[Package]] = relationship(
        back_populates="packaging_allocation"
    )
    packaging_losses: Mapped[list[PackagingLoss]] = relationship(
        back_populates="packaging_allocation", cascade="all, delete-orphan"
    )

    @property
    def selected_weight_grams(self) -> Decimal:
        return sum(
            (
                link.tray.final_dry_weight_grams or Decimal("0")
                for link in self.source_tray_links
            ),
            start=Decimal("0"),
        )

    @property
    def allocated_weight_grams(self) -> Decimal:
        recorded_weight = sum(
            (
                package.finished_product_weight_grams or Decimal("0")
                for package in self.packages
            ),
            start=Decimal("0"),
        )
        planned_weight = sum(
            (
                row.finished_product_weight_grams or Decimal("0")
                for row in self.planned_package_rows
                if row.recorded_package_id is None
            ),
            start=Decimal("0"),
        )
        return recorded_weight + planned_weight

    @property
    def total_recorded_loss_weight_grams(self) -> Decimal:
        return sum(
            (loss.weight_grams for loss in self.packaging_losses),
            start=Decimal("0"),
        )

    @property
    def remaining_weight_grams(self) -> Decimal:
        return (
            self.selected_weight_grams
            - self.allocated_weight_grams
            - self.total_recorded_loss_weight_grams
        )


class PackagingAllocationSourceTray(IdMixin, Base):
    __tablename__ = "packaging_allocation_source_trays"
    __table_args__ = (
        UniqueConstraint(
            "packaging_allocation_id",
            "tray_id",
            name="uq_packaging_allocation_source_tray",
        ),
        UniqueConstraint("tray_id", name="uq_packaging_allocation_source_tray_id"),
    )

    packaging_allocation_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packaging_allocations.id"),
        nullable=False,
    )
    tray_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("trays.id"),
        nullable=False,
    )

    packaging_allocation: Mapped[PackagingAllocation] = relationship(
        back_populates="source_tray_links"
    )
    tray: Mapped[Tray] = relationship(back_populates="packaging_allocation_links")
    # Phase 1 compatibility for existing tray-detail eager loading.
    packaging_operation: Mapped[PackagingOperation] = relationship(
        "PackagingOperation",
        secondary="packaging_allocations",
        primaryjoin=(
            "PackagingAllocationSourceTray.packaging_allocation_id == "
            "PackagingAllocation.id"
        ),
        secondaryjoin=(
            "PackagingAllocation.packaging_operation_id == PackagingOperation.id"
        ),
        viewonly=True,
        uselist=False,
    )

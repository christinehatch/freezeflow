from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import InventoryStatus, enum_values
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.packaging_operation import PackagingOperation
    from app.models.storage_location import StorageLocation, StorageLocationHistory


class Package(IdMixin, TimestampMixin, Base):
    __tablename__ = "packages"

    packaging_operation_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packaging_operations.id"),
        nullable=False,
    )
    package_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    package_weight_grams: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False
    )
    oxygen_absorber: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_location_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("storage_locations.id"),
        nullable=False,
    )
    inventory_status: Mapped[InventoryStatus] = mapped_column(
        Enum(InventoryStatus, native_enum=False, values_callable=enum_values),
        default=InventoryStatus.IN_STORAGE,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    packaging_operation: Mapped[PackagingOperation] = relationship(
        back_populates="packages"
    )
    storage_location: Mapped[StorageLocation] = relationship(back_populates="packages")
    storage_location_history: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="package"
    )

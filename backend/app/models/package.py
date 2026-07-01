from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import InventoryStatus, enum_values
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.packaging_operation import PackagingOperation
    from app.models.storage_location import StorageLocation, StorageLocationHistory


class Package(IdMixin, Base):
    __tablename__ = "packages"

    packaging_operation_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packaging_operations.id"),
        nullable=False,
    )
    package_weight_grams: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False
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

    packaging_operation: Mapped[PackagingOperation] = relationship(
        back_populates="packages"
    )
    storage_location: Mapped[StorageLocation] = relationship(back_populates="packages")
    storage_location_history: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="package"
    )

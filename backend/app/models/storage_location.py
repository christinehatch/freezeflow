from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.package import Package
    from app.models.planned_package_row import PlannedPackageRow


class StorageLocation(IdMixin, Base):
    __tablename__ = "storage_locations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    packages: Mapped[list[Package]] = relationship(back_populates="storage_location")
    planned_package_rows: Mapped[list[PlannedPackageRow]] = relationship(
        back_populates="storage_location"
    )
    previous_location_histories: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="previous_storage_location",
        foreign_keys="StorageLocationHistory.previous_storage_location_id",
    )
    current_location_histories: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="current_storage_location",
        foreign_keys="StorageLocationHistory.current_storage_location_id",
    )


class StorageLocationHistory(IdMixin, Base):
    __tablename__ = "storage_location_histories"

    package_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packages.id"),
        nullable=False,
    )
    previous_storage_location_id: Mapped[UUID | None] = mapped_column(
        GUID(),
        ForeignKey("storage_locations.id"),
    )
    current_storage_location_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("storage_locations.id"),
        nullable=False,
    )
    moved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    package: Mapped[Package] = relationship(back_populates="storage_location_history")
    previous_storage_location: Mapped[StorageLocation | None] = relationship(
        back_populates="previous_location_histories",
        foreign_keys=[previous_storage_location_id],
    )
    current_storage_location: Mapped[StorageLocation] = relationship(
        back_populates="current_location_histories",
        foreign_keys=[current_storage_location_id],
    )

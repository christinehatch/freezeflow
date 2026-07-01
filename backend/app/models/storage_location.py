from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.package import Package


class StorageLocation(IdMixin, TimestampMixin, Base):
    __tablename__ = "storage_locations"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    packages: Mapped[list[Package]] = relationship(back_populates="storage_location")
    previous_location_histories: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="previous_storage_location",
        foreign_keys="StorageLocationHistory.previous_storage_location_id",
    )
    new_location_histories: Mapped[list[StorageLocationHistory]] = relationship(
        back_populates="new_storage_location",
        foreign_keys="StorageLocationHistory.new_storage_location_id",
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
    new_storage_location_id: Mapped[UUID] = mapped_column(
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
    new_storage_location: Mapped[StorageLocation] = relationship(
        back_populates="new_location_histories",
        foreign_keys=[new_storage_location_id],
    )

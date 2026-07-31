from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import InventoryStatus, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.package import Package


class PackageStatusHistory(IdMixin, Base):
    __tablename__ = "package_status_histories"

    package_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("packages.id"), nullable=False
    )
    previous_status: Mapped[InventoryStatus | None] = mapped_column(
        Enum(
            InventoryStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_package_status_histories_previous_status",
        )
    )
    current_status: Mapped[InventoryStatus] = mapped_column(
        Enum(
            InventoryStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_package_status_histories_current_status",
        ),
        nullable=False,
    )
    effective_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    package: Mapped[Package] = relationship(back_populates="status_history")

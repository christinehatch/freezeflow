from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.package import Package
    from app.models.tray import Tray


class PackagingOperation(IdMixin, TimestampMixin, Base):
    __tablename__ = "packaging_operations"

    packaged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    total_source_weight_grams: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    tray_links: Mapped[list[PackagingOperationTray]] = relationship(
        back_populates="packaging_operation"
    )
    packages: Mapped[list[Package]] = relationship(back_populates="packaging_operation")


class PackagingOperationTray(IdMixin, Base):
    __tablename__ = "packaging_operation_trays"
    __table_args__ = (
        UniqueConstraint("tray_id", name="uq_packaging_operation_trays_tray_id"),
    )

    packaging_operation_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("packaging_operations.id"),
        nullable=False,
    )
    tray_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("trays.id"),
        nullable=False,
    )

    packaging_operation: Mapped[PackagingOperation] = relationship(
        back_populates="tray_links"
    )
    tray: Mapped[Tray] = relationship(back_populates="packaging_operation_link")

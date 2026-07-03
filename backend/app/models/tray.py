from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import TrayStatus, enum_values
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.packaging_operation import PackagingOperationTray
    from app.models.physical_tray import PhysicalTray
    from app.models.production_batch import ProductionBatch
    from app.models.recipe import Recipe
    from app.models.tray_slot import TraySlot
    from app.models.weight_check import WeightCheck


class Tray(IdMixin, Base):
    __tablename__ = "trays"
    __table_args__ = (
        UniqueConstraint(
            "production_batch_id",
            "tray_number",
            name="uq_trays_production_batch_tray_number",
        ),
        UniqueConstraint(
            "production_batch_id",
            "tray_slot_id",
            name="uq_trays_production_batch_tray_slot",
        ),
        UniqueConstraint(
            "production_batch_id",
            "physical_tray_id",
            name="uq_trays_production_batch_physical_tray",
        ),
    )

    production_batch_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("production_batches.id"),
        nullable=False,
    )
    tray_slot_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("tray_slots.id"),
        nullable=False,
    )
    physical_tray_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("physical_trays.id"),
        nullable=False,
    )
    recipe_id: Mapped[UUID | None] = mapped_column(GUID(), ForeignKey("recipes.id"))
    tray_number: Mapped[int | None] = mapped_column()
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    preparation: Mapped[str] = mapped_column(Text, nullable=False)
    starting_weight_grams: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
    )
    final_dry_weight_grams: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    status: Mapped[TrayStatus] = mapped_column(
        Enum(
            TrayStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_trays_status",
        ),
        default=TrayStatus.DRAFT,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    production_batch: Mapped[ProductionBatch] = relationship(back_populates="trays")
    tray_slot: Mapped[TraySlot] = relationship(back_populates="trays")
    physical_tray: Mapped[PhysicalTray] = relationship(back_populates="trays")
    recipe: Mapped[Recipe | None] = relationship(back_populates="trays")
    weight_checks: Mapped[list[WeightCheck]] = relationship(back_populates="tray")
    packaging_operation_link: Mapped[PackagingOperationTray | None] = relationship(
        back_populates="tray"
    )

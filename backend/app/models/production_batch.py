from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import ProductionBatchStatus, enum_values
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.freeze_dryer import FreezeDryer
    from app.models.tray import Tray


class ProductionBatch(IdMixin, TimestampMixin, Base):
    __tablename__ = "production_batches"

    freeze_dryer_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("freeze_dryers.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProductionBatchStatus] = mapped_column(
        Enum(ProductionBatchStatus, native_enum=False, values_callable=enum_values),
        default=ProductionBatchStatus.DRAFT,
        nullable=False,
    )

    freeze_dryer: Mapped[FreezeDryer] = relationship(
        back_populates="production_batches"
    )
    trays: Mapped[list[Tray]] = relationship(back_populates="production_batch")

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.production_batch import ProductionBatch


class FreezeDryer(IdMixin, TimestampMixin, Base):
    __tablename__ = "freeze_dryers"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    manufacturer: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(255), unique=True)
    tray_count: Mapped[int] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    production_batches: Mapped[list[ProductionBatch]] = relationship(
        back_populates="freeze_dryer"
    )

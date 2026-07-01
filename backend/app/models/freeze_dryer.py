from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.production_batch import ProductionBatch


class FreezeDryer(IdMixin, Base):
    __tablename__ = "freeze_dryers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    production_batches: Mapped[list[ProductionBatch]] = relationship(
        back_populates="freeze_dryer"
    )

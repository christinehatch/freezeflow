from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.tray import Tray


class WeightCheck(IdMixin, Base):
    __tablename__ = "weight_checks"

    tray_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("trays.id"),
        nullable=False,
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    weight_grams: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    tray: Mapped[Tray] = relationship(back_populates="weight_checks")

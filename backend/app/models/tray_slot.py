from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.freeze_dryer import FreezeDryer
    from app.models.tray import Tray


class TraySlot(IdMixin, Base):
    __tablename__ = "tray_slots"
    __table_args__ = (
        UniqueConstraint(
            "freeze_dryer_id",
            "slot_number",
            name="uq_tray_slots_freeze_dryer_slot_number",
        ),
    )

    freeze_dryer_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("freeze_dryers.id"),
        nullable=False,
    )
    slot_number: Mapped[int] = mapped_column(nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    freeze_dryer: Mapped[FreezeDryer] = relationship(back_populates="tray_slots")
    trays: Mapped[list[Tray]] = relationship(back_populates="tray_slot")

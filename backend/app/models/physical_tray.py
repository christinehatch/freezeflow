from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.tray import Tray


class PhysicalTray(IdMixin, Base):
    __tablename__ = "physical_trays"

    label: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    trays: Mapped[list[Tray]] = relationship(back_populates="physical_tray")

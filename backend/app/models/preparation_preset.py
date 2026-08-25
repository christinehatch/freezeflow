from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import IdMixin

if TYPE_CHECKING:
    from app.models.tray import Tray


class PreparationPreset(IdMixin, Base):
    __tablename__ = "preparation_presets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ingredients: Mapped[list[str] | None] = mapped_column(JSON)
    preparation_methods: Mapped[list[str] | None] = mapped_column(JSON)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Legacy freeform fallback from the pre-Milestone-6 Recipe model. Never
    # written by new code; kept only so pre-migration rows retain their
    # original text. See docs/persistence/04-preparation-preset.md.
    preparation: Mapped[str | None] = mapped_column(Text)

    trays: Mapped[list[Tray]] = relationship(back_populates="preparation_preset")

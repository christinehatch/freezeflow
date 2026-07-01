from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import RecipeStatus, enum_values
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.tray import Tray


class Recipe(IdMixin, TimestampMixin, Base):
    __tablename__ = "recipes"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product: Mapped[str] = mapped_column(String(255), nullable=False)
    preparation: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[RecipeStatus] = mapped_column(
        Enum(RecipeStatus, native_enum=False, values_callable=enum_values),
        default=RecipeStatus.ACTIVE,
        nullable=False,
    )

    trays: Mapped[list[Tray]] = relationship(back_populates="recipe")

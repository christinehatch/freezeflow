from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import PackageLabelStatus, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.package import Package
    from app.models.print_event import PrintEvent


class PackageLabel(IdMixin, Base):
    __tablename__ = "package_labels"

    package_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("packages.id"), nullable=False, unique=True
    )
    status: Mapped[PackageLabelStatus] = mapped_column(
        Enum(
            PackageLabelStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_package_labels_status",
        ),
        default=PackageLabelStatus.DRAFT,
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    ingredients_summary: Mapped[str | None] = mapped_column(Text)
    preparation_summary: Mapped[str | None] = mapped_column(Text)
    rehydration_instructions: Mapped[str | None] = mapped_column(Text)
    serving_notes: Mapped[str | None] = mapped_column(Text)
    net_weight_display: Mapped[str | None] = mapped_column(String(255))
    fresh_equivalent_display: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    package: Mapped[Package] = relationship(back_populates="label")
    print_events: Mapped[list[PrintEvent]] = relationship(
        back_populates="package_label"
    )

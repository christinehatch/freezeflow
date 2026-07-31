from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.package_label import PackageLabel


class PrintEvent(IdMixin, Base):
    __tablename__ = "print_events"

    package_label_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("package_labels.id"), nullable=False
    )
    printed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    template: Mapped[str] = mapped_column(String(255), nullable=False)
    print_job_id: Mapped[UUID] = mapped_column(GUID(), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    package_label: Mapped[PackageLabel] = relationship(back_populates="print_events")

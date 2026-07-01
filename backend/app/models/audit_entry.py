from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.types import GUID
from app.models.mixins import IdMixin


class AuditEntry(IdMixin, Base):
    __tablename__ = "audit_entries"

    entity_type: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(GUID(), nullable=False)
    field_changed: Mapped[str] = mapped_column(String(255), nullable=False)
    previous_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    observation_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    correction_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

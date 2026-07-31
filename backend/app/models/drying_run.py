from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import DryingRunStatus, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.production_batch import ProductionBatch
    from app.models.weight_check import WeightCheck


class DryingRun(IdMixin, Base):
    __tablename__ = "drying_runs"

    production_batch_id: Mapped[UUID] = mapped_column(
        GUID(),
        ForeignKey("production_batches.id"),
        nullable=False,
    )
    status: Mapped[DryingRunStatus] = mapped_column(
        Enum(
            DryingRunStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_drying_runs_status",
        ),
        default=DryingRunStatus.ACTIVE,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    production_batch: Mapped[ProductionBatch] = relationship(
        back_populates="drying_runs"
    )
    weight_checks: Mapped[list[WeightCheck]] = relationship(back_populates="drying_run")

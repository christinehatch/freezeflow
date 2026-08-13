from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.types import GUID
from app.models.enums import PackagingLossReason, enum_values
from app.models.mixins import IdMixin, utc_now

if TYPE_CHECKING:
    from app.models.packaging_operation import PackagingAllocation


class PackagingLoss(IdMixin, Base):
    __tablename__ = "packaging_losses"
    __table_args__ = (
        CheckConstraint(
            "weight_grams > 0",
            name="ck_packaging_losses_weight_positive",
        ),
        CheckConstraint(
            "reason = 'Other' or reason_detail is null",
            name="ck_packaging_losses_reason_detail_requires_other",
        ),
    )

    packaging_allocation_id: Mapped[UUID] = mapped_column(
        GUID(), ForeignKey("packaging_allocations.id"), nullable=False
    )
    weight_grams: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[PackagingLossReason] = mapped_column(
        Enum(
            PackagingLossReason,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_packaging_losses_reason",
        ),
        nullable=False,
    )
    reason_detail: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    packaging_allocation: Mapped[PackagingAllocation] = relationship(
        back_populates="packaging_losses"
    )

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.enums import FeedbackCategory, FeedbackStatus, enum_values
from app.models.mixins import IdMixin, utc_now


class Feedback(IdMixin, Base):
    """An operator-submitted report, deliberately unlinked from every other
    entity - `page`/`context_json` capture what mattered at submission time
    rather than a live foreign key. See docs/persistence/20-feedback.md and
    ADR-0020.
    """

    __tablename__ = "feedback"

    category: Mapped[FeedbackCategory] = mapped_column(
        Enum(
            FeedbackCategory,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_feedback_category",
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[str | None] = mapped_column(Text)
    context_json: Mapped[dict | None] = mapped_column(JSON)
    attachments: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(
            FeedbackStatus,
            native_enum=False,
            values_callable=enum_values,
            create_constraint=True,
            name="ck_feedback_status",
        ),
        default=FeedbackStatus.NEW,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

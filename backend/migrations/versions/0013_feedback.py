"""add feedback

Revision ID: 0013_feedback
Revises: 0012_preparation_presets
Create Date: 2026-08-25 00:00:00.000000

Adds the feedback table (ADR-0020, docs/persistence/20-feedback.md).
Feedback is deliberately unlinked from every other entity - no foreign
keys - since page/context_json capture whatever mattered at submission
time instead of a live reference to a Production Batch, Tray, Package, or
Freeze Dryer that might later change or be deleted.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_feedback"
down_revision: str | Sequence[str] | None = "0012_preparation_presets"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("page", sa.Text(), nullable=True),
        sa.Column("context_json", sa.JSON(), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "category in ('Bug', 'Confusing', 'Improvement', "
            "'Feature Request', 'Question')",
            name="ck_feedback_category",
        ),
        sa.CheckConstraint(
            "status in ('New', 'Reviewed', 'Fixed', 'Closed')",
            name="ck_feedback_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("feedback")

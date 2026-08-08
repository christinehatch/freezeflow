"""add packaging loss

Revision ID: 0010_packaging_loss
Revises: 0009_refined_packaging_persistence
Create Date: 2026-08-07 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_packaging_loss"
down_revision: str | Sequence[str] | None = "0009_refined_packaging_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "packaging_losses",
        sa.Column("packaging_allocation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("weight_grams", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("reason", sa.String(length=7), nullable=False),
        sa.Column("reason_detail", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "weight_grams > 0",
            name="ck_packaging_losses_weight_positive",
        ),
        sa.CheckConstraint(
            "reason in ('Sampled', 'Spilled', 'Crumbs', 'Other')",
            name="ck_packaging_losses_reason",
        ),
        sa.CheckConstraint(
            "reason = 'Other' or reason_detail is null",
            name="ck_packaging_losses_reason_detail_requires_other",
        ),
        sa.ForeignKeyConstraint(
            ["packaging_allocation_id"],
            ["packaging_allocations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("packaging_losses")

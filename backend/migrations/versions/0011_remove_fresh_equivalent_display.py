"""remove persisted fresh equivalent display

Revision ID: 0011_remove_fresh_equivalent_display
Revises: 0010_packaging_loss
Create Date: 2026-08-12 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_remove_fresh_equivalent_display"
down_revision: str | Sequence[str] | None = "0010_packaging_loss"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("package_labels") as batch_op:
        batch_op.drop_column("fresh_equivalent_display")
    with op.batch_alter_table("planned_package_rows") as batch_op:
        batch_op.drop_column("label_fresh_equivalent_display")


def downgrade() -> None:
    with op.batch_alter_table("planned_package_rows") as batch_op:
        batch_op.add_column(
            sa.Column("label_fresh_equivalent_display", sa.String(length=255))
        )
    with op.batch_alter_table("package_labels") as batch_op:
        batch_op.add_column(
            sa.Column("fresh_equivalent_display", sa.String(length=255))
        )

"""align tray relationship nullability

Revision ID: 0008_align_tray_nullability
Revises: 0007_package_finished_product_weight
Create Date: 2026-07-16 23:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_align_tray_nullability"
down_revision: str | Sequence[str] | None = "0007_package_finished_product_weight"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("trays") as batch_op:
        batch_op.alter_column(
            "tray_slot_id",
            existing_type=sa.CHAR(length=36),
            nullable=False,
        )
        batch_op.alter_column(
            "physical_tray_id",
            existing_type=sa.CHAR(length=36),
            nullable=False,
        )
        batch_op.alter_column(
            "tray_number",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("""
            update trays
            set tray_number = (
                select tray_slots.slot_number
                from tray_slots
                where tray_slots.id = trays.tray_slot_id
            )
            where tray_number is null
            """))

    with op.batch_alter_table("trays") as batch_op:
        batch_op.alter_column(
            "tray_number",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column(
            "physical_tray_id",
            existing_type=sa.CHAR(length=36),
            nullable=True,
        )
        batch_op.alter_column(
            "tray_slot_id",
            existing_type=sa.CHAR(length=36),
            nullable=True,
        )

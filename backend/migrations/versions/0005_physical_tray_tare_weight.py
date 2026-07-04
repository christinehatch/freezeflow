"""physical tray tare weight

Revision ID: 0005_physical_tray_tare_weight
Revises: 0004_drying_runs_and_weight_tracking
Create Date: 2026-07-03 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_physical_tray_tare_weight"
down_revision: str | Sequence[str] | None = "0004_drying_runs_and_weight_tracking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("physical_trays") as batch_op:
        batch_op.add_column(sa.Column("tare_weight_grams", sa.Numeric(12, 3)))


def downgrade() -> None:
    with op.batch_alter_table("physical_trays") as batch_op:
        batch_op.drop_column("tare_weight_grams")

"""separate finished product and sealed package weights

Revision ID: 0007_package_finished_product_weight
Revises: 0006_packaging_workflow
Create Date: 2026-07-12 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_package_finished_product_weight"
down_revision: str | Sequence[str] | None = "0006_packaging_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("packages") as batch_op:
        batch_op.add_column(
            sa.Column(
                "finished_product_weight_grams",
                sa.Numeric(precision=12, scale=3),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("packages") as batch_op:
        batch_op.drop_column("finished_product_weight_grams")

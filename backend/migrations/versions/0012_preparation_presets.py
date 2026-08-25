"""rename Recipe to Preparation Preset, split preparation into structured fields

Revision ID: 0012_preparation_presets
Revises: 0011_remove_fresh_equivalent_display
Create Date: 2026-08-24 00:00:00.000000

Renames the recipes table to preparation_presets and the trays.recipe_id
foreign key to trays.preparation_preset_id (ADR-0013). Adds new nullable
ingredients/preparation_methods JSON columns to both tables and adds
trays.preparation_preset_name_at_use, an immutable snapshot of the Preset's
name at Tray-creation time.

This migration is purely additive/renaming and performs no data backfill:
existing preparation_presets.preparation and trays.preparation rows keep
their original freeform text untouched (both columns become nullable legacy
fallbacks). New rows going forward populate the structured fields instead.
Auto-splitting existing freeform text into ingredients/preparation_methods
would fabricate structure that was never actually recorded, so it is never
done - see docs/persistence/04-preparation-preset.md.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_preparation_presets"
down_revision: str | Sequence[str] | None = "0011_remove_fresh_equivalent_display"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table("recipes", "preparation_presets")
    with op.batch_alter_table("preparation_presets") as batch_op:
        batch_op.add_column(sa.Column("ingredients", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("preparation_methods", sa.JSON(), nullable=True))
        batch_op.alter_column("preparation", existing_type=sa.Text(), nullable=True)

    with op.batch_alter_table("trays") as batch_op:
        batch_op.alter_column(
            "recipe_id",
            new_column_name="preparation_preset_id",
            existing_type=sa.CHAR(length=36),
        )
        batch_op.add_column(
            sa.Column("preparation_preset_name_at_use", sa.String(length=255))
        )
        batch_op.add_column(sa.Column("ingredients", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("preparation_methods", sa.JSON(), nullable=True))
        batch_op.alter_column("preparation", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    # Only safe if no post-upgrade data has been written to the new columns -
    # NOT NULL restore on `preparation` will fail otherwise, and the new
    # structured columns are simply dropped, losing any data written there.
    with op.batch_alter_table("trays") as batch_op:
        batch_op.alter_column("preparation", existing_type=sa.Text(), nullable=False)
        batch_op.drop_column("preparation_methods")
        batch_op.drop_column("ingredients")
        batch_op.drop_column("preparation_preset_name_at_use")
        batch_op.alter_column(
            "preparation_preset_id",
            new_column_name="recipe_id",
            existing_type=sa.CHAR(length=36),
        )

    with op.batch_alter_table("preparation_presets") as batch_op:
        batch_op.alter_column("preparation", existing_type=sa.Text(), nullable=False)
        batch_op.drop_column("preparation_methods")
        batch_op.drop_column("ingredients")
    op.rename_table("preparation_presets", "recipes")

"""initial persistence schema

Revision ID: 0002_initial_persistence_schema
Revises: 0001_empty_milestone_0
Create Date: 2026-06-29 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_initial_persistence_schema"
down_revision: str | Sequence[str] | None = "0001_empty_milestone_0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_entries",
        sa.Column("entity_type", sa.String(length=255), nullable=False),
        sa.Column("entity_id", sa.CHAR(length=36), nullable=False),
        sa.Column("field_changed", sa.String(length=255), nullable=False),
        sa.Column("previous_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("observation_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("correction_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_entries_entity",
        "audit_entries",
        ["entity_type", "entity_id"],
    )

    op.create_table(
        "freeze_dryers",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("manufacturer", sa.String(length=255), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("serial_number", sa.String(length=255), nullable=True),
        sa.Column("tray_count", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("serial_number"),
    )

    op.create_table(
        "recipes",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("product", sa.String(length=255), nullable=False),
        sa.Column("preparation", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('active', 'archived')",
            name="ck_recipes_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "storage_locations",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "production_batches",
        sa.Column("freeze_dryer_id", sa.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=9), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('draft', 'running', 'completed', 'cancelled')",
            name="ck_production_batches_status",
        ),
        sa.ForeignKeyConstraint(["freeze_dryer_id"], ["freeze_dryers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "packaging_operations",
        sa.Column("packaged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "total_source_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "trays",
        sa.Column("production_batch_id", sa.CHAR(length=36), nullable=False),
        sa.Column("recipe_id", sa.CHAR(length=36), nullable=True),
        sa.Column("tray_number", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column("preparation", sa.Text(), nullable=False),
        sa.Column(
            "starting_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=False,
        ),
        sa.Column(
            "final_dry_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=9), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status in ('draft', 'running', 'completed', 'packaged', 'cancelled')",
            name="ck_trays_status",
        ),
        sa.ForeignKeyConstraint(["production_batch_id"], ["production_batches.id"]),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_batch_id",
            "tray_number",
            name="uq_trays_production_batch_tray_number",
        ),
    )

    op.create_table(
        "packages",
        sa.Column("packaging_operation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("package_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "package_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=False,
        ),
        sa.Column("oxygen_absorber", sa.String(length=255), nullable=False),
        sa.Column("storage_location_id", sa.CHAR(length=36), nullable=False),
        sa.Column("inventory_status", sa.String(length=10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "inventory_status in ('in_storage', 'depleted')",
            name="ck_packages_inventory_status",
        ),
        sa.ForeignKeyConstraint(
            ["packaging_operation_id"],
            ["packaging_operations.id"],
        ),
        sa.ForeignKeyConstraint(["storage_location_id"], ["storage_locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "packaging_operation_trays",
        sa.Column("packaging_operation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("tray_id", sa.CHAR(length=36), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["packaging_operation_id"],
            ["packaging_operations.id"],
        ),
        sa.ForeignKeyConstraint(["tray_id"], ["trays.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tray_id",
            name="uq_packaging_operation_trays_tray_id",
        ),
    )

    op.create_table(
        "storage_location_histories",
        sa.Column("package_id", sa.CHAR(length=36), nullable=False),
        sa.Column("previous_storage_location_id", sa.CHAR(length=36), nullable=True),
        sa.Column("new_storage_location_id", sa.CHAR(length=36), nullable=False),
        sa.Column("moved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["new_storage_location_id"],
            ["storage_locations.id"],
        ),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.ForeignKeyConstraint(
            ["previous_storage_location_id"],
            ["storage_locations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "weight_checks",
        sa.Column("tray_id", sa.CHAR(length=36), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("elapsed_hours", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(["tray_id"], ["trays.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("weight_checks")
    op.drop_table("storage_location_histories")
    op.drop_table("packaging_operation_trays")
    op.drop_table("packages")
    op.drop_table("trays")
    op.drop_table("packaging_operations")
    op.drop_table("production_batches")
    op.drop_table("storage_locations")
    op.drop_table("recipes")
    op.drop_table("freeze_dryers")
    op.drop_index("ix_audit_entries_entity", table_name="audit_entries")
    op.drop_table("audit_entries")

"""refine packaging persistence around resumable operations

Revision ID: 0009_refined_packaging_persistence
Revises: 0008_align_tray_nullability
Create Date: 2026-07-18 12:00:00.000000
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op

revision: str = "0009_refined_packaging_persistence"
down_revision: str | Sequence[str] | None = "0008_align_tray_nullability"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_MIGRATION_NAMESPACE = UUID("28751318-8a43-4e10-8484-08a60fcbd56a")


def _stable_id(kind: str, source_id: object) -> str:
    return str(uuid5(_MIGRATION_NAMESPACE, f"{kind}:{source_id}"))


def upgrade() -> None:
    _create_refined_tables()
    _add_refined_columns()
    _backfill_refined_packaging_data()
    _enforce_refined_constraints()


def downgrade() -> None:
    _restore_legacy_columns_and_links()

    op.drop_table("planned_package_rows")
    op.drop_table("print_events")
    op.drop_table("package_labels")
    op.drop_table("package_status_histories")

    with op.batch_alter_table("packages") as batch_op:
        batch_op.drop_constraint(
            "fk_packages_packaging_allocation_id",
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            "ck_packages_package_weight_positive",
            type_="check",
        )
        batch_op.drop_constraint(
            "ck_packages_finished_product_weight_positive",
            type_="check",
        )
        batch_op.alter_column(
            "packaging_operation_id",
            existing_type=sa.CHAR(length=36),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_packages_packaging_operation_id",
            "packaging_operations",
            ["packaging_operation_id"],
            ["id"],
        )
        batch_op.drop_column("packaged_at")
        batch_op.drop_column("packaging_allocation_id")

    op.drop_table("packaging_allocation_source_trays")
    op.drop_table("packaging_allocations")
    op.drop_index(
        "uq_packaging_operations_open_batch",
        table_name="packaging_operations",
    )

    with op.batch_alter_table("packaging_operations") as batch_op:
        batch_op.drop_constraint(
            "fk_packaging_operations_production_batch_id",
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            "ck_packaging_operations_completion",
            type_="check",
        )
        batch_op.drop_constraint(
            "ck_packaging_operations_status",
            type_="check",
        )
        batch_op.alter_column(
            "packaged_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )
        batch_op.drop_column("updated_at")
        batch_op.drop_column("created_at")
        batch_op.drop_column("completed_at")
        batch_op.drop_column("started_at")
        batch_op.drop_column("status")
        batch_op.drop_column("production_batch_id")


def _create_refined_tables() -> None:
    op.create_table(
        "packaging_allocations",
        sa.Column("packaging_operation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["packaging_operation_id"],
            ["packaging_operations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "packaging_allocation_source_trays",
        sa.Column("packaging_allocation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("tray_id", sa.CHAR(length=36), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["packaging_allocation_id"],
            ["packaging_allocations.id"],
        ),
        sa.ForeignKeyConstraint(["tray_id"], ["trays.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "packaging_allocation_id",
            "tray_id",
            name="uq_packaging_allocation_source_tray",
        ),
        sa.UniqueConstraint(
            "tray_id",
            name="uq_packaging_allocation_source_tray_id",
        ),
    )
    op.create_table(
        "package_status_histories",
        sa.Column("package_id", sa.CHAR(length=36), nullable=False),
        sa.Column("previous_status", sa.String(length=10), nullable=True),
        sa.Column("current_status", sa.String(length=10), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "previous_status is null or previous_status in "
            "('In Storage', 'Given Away', 'Depleted')",
            name="ck_package_status_histories_previous_status",
        ),
        sa.CheckConstraint(
            "current_status in ('In Storage', 'Given Away', 'Depleted')",
            name="ck_package_status_histories_current_status",
        ),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "package_labels",
        sa.Column("package_id", sa.CHAR(length=36), nullable=False),
        sa.Column("status", sa.String(length=13), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ingredients_summary", sa.Text(), nullable=True),
        sa.Column("preparation_summary", sa.Text(), nullable=True),
        sa.Column("rehydration_instructions", sa.Text(), nullable=True),
        sa.Column("serving_notes", sa.Text(), nullable=True),
        sa.Column("net_weight_display", sa.String(length=255), nullable=True),
        sa.Column("fresh_equivalent_display", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "status in ('Draft', 'Ready', 'Needs Reprint')",
            name="ck_package_labels_status",
        ),
        sa.ForeignKeyConstraint(["package_id"], ["packages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("package_id", name="uq_package_labels_package_id"),
    )
    op.create_table(
        "print_events",
        sa.Column("package_label_id", sa.CHAR(length=36), nullable=False),
        sa.Column("printed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("template", sa.String(length=255), nullable=False),
        sa.Column("print_job_id", sa.CHAR(length=36), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(["package_label_id"], ["package_labels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "planned_package_rows",
        sa.Column("packaging_allocation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("package_type_id", sa.CHAR(length=36), nullable=True),
        sa.Column(
            "finished_product_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=True,
        ),
        sa.Column("finished_product_weight_unit", sa.String(length=16), nullable=True),
        sa.Column(
            "sealed_package_weight_grams",
            sa.Numeric(precision=12, scale=3),
            nullable=True,
        ),
        sa.Column("sealed_package_weight_unit", sa.String(length=16), nullable=True),
        sa.Column("oxygen_absorber", sa.String(length=255), nullable=True),
        sa.Column("storage_location_id", sa.CHAR(length=36), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("label_status", sa.String(length=13), nullable=False),
        sa.Column("label_display_name", sa.String(length=255), nullable=True),
        sa.Column("label_description", sa.Text(), nullable=True),
        sa.Column("label_ingredients_summary", sa.Text(), nullable=True),
        sa.Column("label_preparation_summary", sa.Text(), nullable=True),
        sa.Column("label_rehydration_instructions", sa.Text(), nullable=True),
        sa.Column("label_serving_notes", sa.Text(), nullable=True),
        sa.Column("label_net_weight_display", sa.String(length=255), nullable=True),
        sa.Column(
            "label_fresh_equivalent_display", sa.String(length=255), nullable=True
        ),
        sa.Column("recorded_package_id", sa.CHAR(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "label_status in ('Draft', 'Ready', 'Needs Reprint')",
            name="ck_planned_package_rows_label_status",
        ),
        sa.CheckConstraint(
            "finished_product_weight_grams is null or "
            "finished_product_weight_grams > 0",
            name="ck_planned_package_rows_finished_weight_positive",
        ),
        sa.CheckConstraint(
            "sealed_package_weight_grams is null or sealed_package_weight_grams > 0",
            name="ck_planned_package_rows_sealed_weight_positive",
        ),
        sa.ForeignKeyConstraint(
            ["packaging_allocation_id"],
            ["packaging_allocations.id"],
        ),
        sa.ForeignKeyConstraint(["package_type_id"], ["package_types.id"]),
        sa.ForeignKeyConstraint(["recorded_package_id"], ["packages.id"]),
        sa.ForeignKeyConstraint(
            ["storage_location_id"],
            ["storage_locations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recorded_package_id",
            name="uq_planned_package_rows_recorded_package_id",
        ),
    )


def _add_refined_columns() -> None:
    with op.batch_alter_table("packaging_operations") as batch_op:
        batch_op.add_column(
            sa.Column("production_batch_id", sa.CHAR(length=36), nullable=True)
        )
        batch_op.add_column(sa.Column("status", sa.String(length=9), nullable=True))
        batch_op.add_column(
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True)
        )

    with op.batch_alter_table("packages") as batch_op:
        batch_op.add_column(
            sa.Column("packaging_allocation_id", sa.CHAR(length=36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("packaged_at", sa.DateTime(timezone=True), nullable=True)
        )


def _backfill_refined_packaging_data() -> None:
    bind = op.get_bind()
    operations = list(
        bind.execute(
            sa.text("select id, packaged_at from packaging_operations order by id")
        ).mappings()
    )
    legacy_links = list(bind.execute(sa.text("""
                select pot.id, pot.packaging_operation_id, pot.tray_id,
                       t.production_batch_id, t.product_name, t.preparation
                from packaging_operation_trays pot
                join trays t on t.id = pot.tray_id
                order by pot.packaging_operation_id, pot.id
                """)).mappings())

    links_by_operation: dict[str, list[sa.RowMapping]] = defaultdict(list)
    for link in legacy_links:
        links_by_operation[str(link["packaging_operation_id"])].append(link)

    allocation_by_operation: dict[str, str] = {}
    for operation in operations:
        operation_id = str(operation["id"])
        links = links_by_operation[operation_id]
        batch_ids = {str(link["production_batch_id"]) for link in links}
        if len(batch_ids) != 1:
            raise RuntimeError(
                "Cannot migrate Packaging Operation "
                f"{operation_id}: expected Trays from exactly one Production Batch."
            )

        production_batch_id = next(iter(batch_ids))
        packaged_at = operation["packaged_at"]
        allocation_id = _stable_id("allocation", operation_id)
        allocation_by_operation[operation_id] = allocation_id

        bind.execute(
            sa.text("""
                update packaging_operations
                set production_batch_id = :production_batch_id,
                    status = 'Completed',
                    started_at = :packaged_at,
                    completed_at = :packaged_at,
                    created_at = :packaged_at,
                    updated_at = :packaged_at
                where id = :operation_id
                """),
            {
                "production_batch_id": production_batch_id,
                "packaged_at": packaged_at,
                "operation_id": operation_id,
            },
        )
        bind.execute(
            sa.text("""
                insert into packaging_allocations
                    (id, packaging_operation_id, notes, created_at, updated_at)
                values
                    (:id, :operation_id, null, :created_at, :updated_at)
                """),
            {
                "id": allocation_id,
                "operation_id": operation_id,
                "created_at": packaged_at,
                "updated_at": packaged_at,
            },
        )
        for link in links:
            bind.execute(
                sa.text("""
                    insert into packaging_allocation_source_trays
                        (id, packaging_allocation_id, tray_id)
                    values
                        (:id, :allocation_id, :tray_id)
                    """),
                {
                    "id": _stable_id("allocation-source", link["id"]),
                    "allocation_id": allocation_id,
                    "tray_id": link["tray_id"],
                },
            )

    packages = list(bind.execute(sa.text("""
                select id, packaging_operation_id, storage_location_id,
                       package_identifier, package_weight_grams,
                       finished_product_weight_grams, status
                from packages
                order by id
                """)).mappings())
    for package in packages:
        package_id = str(package["id"])
        legacy_status = str(package["status"])
        operation_id = str(package["packaging_operation_id"])
        allocation_id = allocation_by_operation.get(operation_id)
        if allocation_id is None:
            raise RuntimeError(
                f"Cannot migrate Package {package_id}: "
                "its Packaging Operation is invalid."
            )
        operation = next(item for item in operations if str(item["id"]) == operation_id)
        packaged_at = operation["packaged_at"]
        source_links = links_by_operation[operation_id]
        display_name = ", ".join(
            sorted({str(link["product_name"]) for link in source_links})
        )
        preparation_summary = "; ".join(
            dict.fromkeys(
                str(link["preparation"]) for link in source_links if link["preparation"]
            )
        )
        net_weight = (
            package["finished_product_weight_grams"]
            if package["finished_product_weight_grams"] is not None
            else package["package_weight_grams"]
        )

        bind.execute(
            sa.text("""
                update packages
                set packaging_allocation_id = :allocation_id,
                    packaged_at = :packaged_at
                where id = :package_id
                """),
            {
                "allocation_id": allocation_id,
                "packaged_at": packaged_at,
                "package_id": package_id,
            },
        )
        bind.execute(
            sa.text("""
                insert into package_labels
                    (id, package_id, status, display_name, description,
                     ingredients_summary, preparation_summary,
                     rehydration_instructions, serving_notes,
                     net_weight_display, fresh_equivalent_display,
                     created_at, updated_at)
                values
                    (:id, :package_id, 'Ready', :display_name, null, null,
                     :preparation_summary, null, null, :net_weight_display,
                     null, :created_at, :updated_at)
                """),
            {
                "id": _stable_id("package-label", package_id),
                "package_id": package_id,
                "display_name": display_name or str(package["package_identifier"]),
                "preparation_summary": preparation_summary or None,
                "net_weight_display": f"{net_weight} g",
                "created_at": packaged_at,
                "updated_at": packaged_at,
            },
        )
        bind.execute(
            sa.text("""
                insert into package_status_histories
                    (id, package_id, previous_status, current_status,
                     effective_at, recorded_at, notes)
                values
                    (:id, :package_id, null, 'In Storage',
                     :effective_at, :recorded_at, :notes)
                """),
            {
                "id": _stable_id("package-status", package_id),
                "package_id": package_id,
                "effective_at": packaged_at,
                "recorded_at": packaged_at,
                "notes": "Created during refined Packaging persistence migration.",
            },
        )
        if legacy_status != "In Storage":
            bind.execute(
                sa.text("""
                    insert into package_status_histories
                        (id, package_id, previous_status, current_status,
                         effective_at, recorded_at, notes)
                    values
                        (:id, :package_id, 'In Storage', :current_status,
                         :effective_at, :recorded_at, :notes)
                    """),
                {
                    "id": _stable_id("package-status-current", package_id),
                    "package_id": package_id,
                    "current_status": legacy_status,
                    "effective_at": packaged_at,
                    "recorded_at": packaged_at,
                    "notes": (
                        "Preserved legacy Package status during refined Packaging "
                        "persistence migration."
                    ),
                },
            )
        has_storage_history = bind.execute(
            sa.text(
                "select 1 from storage_location_histories "
                "where package_id = :package_id limit 1"
            ),
            {"package_id": package_id},
        ).first()
        if has_storage_history is None:
            bind.execute(
                sa.text("""
                    insert into storage_location_histories
                        (id, package_id, previous_storage_location_id,
                         current_storage_location_id, moved_at, notes)
                    values
                        (:id, :package_id, null, :storage_location_id,
                         :moved_at, :notes)
                    """),
                {
                    "id": _stable_id("storage-history", package_id),
                    "package_id": package_id,
                    "storage_location_id": package["storage_location_id"],
                    "moved_at": packaged_at,
                    "notes": "Created during refined Packaging persistence migration.",
                },
            )


def _enforce_refined_constraints() -> None:
    with op.batch_alter_table("packaging_operations") as batch_op:
        batch_op.alter_column(
            "production_batch_id",
            existing_type=sa.CHAR(length=36),
            nullable=False,
        )
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=9),
            nullable=False,
        )
        batch_op.alter_column(
            "started_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )
        batch_op.alter_column(
            "created_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )
        batch_op.alter_column(
            "updated_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_packaging_operations_production_batch_id",
            "production_batches",
            ["production_batch_id"],
            ["id"],
        )
        batch_op.create_check_constraint(
            "ck_packaging_operations_status",
            "status in ('Open', 'Completed')",
        )
        batch_op.create_check_constraint(
            "ck_packaging_operations_completion",
            "(status = 'Open' and completed_at is null) or "
            "(status = 'Completed' and completed_at is not null)",
        )
        batch_op.drop_column("packaged_at")

    op.create_index(
        "uq_packaging_operations_open_batch",
        "packaging_operations",
        ["production_batch_id"],
        unique=True,
        sqlite_where=sa.text("status = 'Open'"),
        postgresql_where=sa.text("status = 'Open'"),
    )

    with op.batch_alter_table("packages") as batch_op:
        batch_op.alter_column(
            "packaging_allocation_id",
            existing_type=sa.CHAR(length=36),
            nullable=False,
        )
        batch_op.alter_column(
            "packaged_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_packages_packaging_allocation_id",
            "packaging_allocations",
            ["packaging_allocation_id"],
            ["id"],
        )
        batch_op.create_check_constraint(
            "ck_packages_package_weight_positive",
            "package_weight_grams > 0",
        )
        batch_op.create_check_constraint(
            "ck_packages_finished_product_weight_positive",
            "finished_product_weight_grams is null or "
            "finished_product_weight_grams > 0",
        )
        batch_op.drop_column("packaging_operation_id")

    op.drop_table("packaging_operation_trays")


def _restore_legacy_columns_and_links() -> None:
    bind = op.get_bind()
    with op.batch_alter_table("packaging_operations") as batch_op:
        batch_op.add_column(
            sa.Column("packaged_at", sa.DateTime(timezone=True), nullable=True)
        )
    with op.batch_alter_table("packages") as batch_op:
        batch_op.add_column(
            sa.Column("packaging_operation_id", sa.CHAR(length=36), nullable=True)
        )

    bind.execute(sa.text("""
        update packaging_operations
        set packaged_at = coalesce(completed_at, started_at, created_at)
        """))
    bind.execute(sa.text("""
        update packages
        set packaging_operation_id = (
            select packaging_allocations.packaging_operation_id
            from packaging_allocations
            where packaging_allocations.id = packages.packaging_allocation_id
        )
        """))

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
    bind.execute(sa.text("""
        insert into packaging_operation_trays
            (id, packaging_operation_id, tray_id)
        select source.id, allocation.packaging_operation_id, source.tray_id
        from packaging_allocation_source_trays source
        join packaging_allocations allocation
          on allocation.id = source.packaging_allocation_id
        """))

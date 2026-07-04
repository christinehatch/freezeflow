"""drying runs and weight tracking

Revision ID: 0004_drying_runs_and_weight_tracking
Revises: 0003_tray_slots_and_physical_trays
Create Date: 2026-07-03 00:00:00.000000

"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0004_drying_runs_and_weight_tracking"
down_revision: str | Sequence[str] | None = "0003_tray_slots_and_physical_trays"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "drying_runs",
        sa.Column("production_batch_id", sa.CHAR(length=36), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.CheckConstraint(
            "status IN ('Active', 'Complete', 'Voided')",
            name="ck_drying_runs_status",
        ),
        sa.ForeignKeyConstraint(["production_batch_id"], ["production_batches.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("weight_checks") as batch_op:
        batch_op.add_column(sa.Column("drying_run_id", sa.CHAR(length=36)))
        batch_op.create_foreign_key(
            "fk_weight_checks_drying_run_id_drying_runs",
            "drying_runs",
            ["drying_run_id"],
            ["id"],
        )

    connection = op.get_bind()
    weight_check_rows = connection.execute(sa.text("""
        select
            weight_checks.id as weight_check_id,
            weight_checks.observed_at as observed_at,
            trays.production_batch_id as production_batch_id
        from weight_checks
        join trays on trays.id = weight_checks.tray_id
        where weight_checks.drying_run_id is null
        """)).mappings()

    for weight_check in weight_check_rows:
        drying_run_id = str(uuid4())
        observed_at = weight_check["observed_at"]
        connection.execute(
            sa.text("""
                insert into drying_runs
                    (
                        id,
                        production_batch_id,
                        status,
                        started_at,
                        ended_at,
                        notes,
                        created_at,
                        updated_at
                    )
                values
                    (
                        :id,
                        :production_batch_id,
                        'Complete',
                        :observed_at,
                        :observed_at,
                        :notes,
                        :observed_at,
                        :observed_at
                    )
                """),
            {
                "id": drying_run_id,
                "production_batch_id": weight_check["production_batch_id"],
                "observed_at": observed_at,
                "notes": (
                    "Created during Drying Run migration for an existing Weight Check."
                ),
            },
        )
        connection.execute(
            sa.text("""
                update weight_checks
                set drying_run_id = :drying_run_id
                where id = :weight_check_id
                """),
            {
                "drying_run_id": drying_run_id,
                "weight_check_id": weight_check["weight_check_id"],
            },
        )

    with op.batch_alter_table("weight_checks") as batch_op:
        batch_op.alter_column("drying_run_id", nullable=False)
        batch_op.create_unique_constraint(
            "uq_weight_checks_tray_drying_run",
            ["tray_id", "drying_run_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("weight_checks") as batch_op:
        batch_op.drop_constraint("uq_weight_checks_tray_drying_run", type_="unique")
        batch_op.drop_constraint(
            "fk_weight_checks_drying_run_id_drying_runs",
            type_="foreignkey",
        )
        batch_op.drop_column("drying_run_id")

    op.drop_table("drying_runs")

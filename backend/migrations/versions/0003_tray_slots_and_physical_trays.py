"""tray slots and physical trays

Revision ID: 0003_tray_slots_and_physical_trays
Revises: 0002_initial_persistence_schema
Create Date: 2026-07-02 00:00:00.000000

"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0003_tray_slots_and_physical_trays"
down_revision: str | Sequence[str] | None = "0002_initial_persistence_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "physical_trays",
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("label"),
    )

    op.create_table(
        "tray_slots",
        sa.Column("freeze_dryer_id", sa.CHAR(length=36), nullable=False),
        sa.Column("slot_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.ForeignKeyConstraint(["freeze_dryer_id"], ["freeze_dryers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "freeze_dryer_id",
            "slot_number",
            name="uq_tray_slots_freeze_dryer_slot_number",
        ),
    )

    connection = op.get_bind()
    freeze_dryer_rows = connection.execute(
        sa.text("select id from freeze_dryers")
    ).mappings()
    for freeze_dryer in freeze_dryer_rows:
        for slot_number in range(1, 5):
            connection.execute(
                sa.text("""
                    insert into tray_slots
                        (id, freeze_dryer_id, slot_number, label, archived)
                    values
                        (:id, :freeze_dryer_id, :slot_number, :label, :archived)
                    """),
                {
                    "id": str(uuid4()),
                    "freeze_dryer_id": freeze_dryer["id"],
                    "slot_number": slot_number,
                    "label": f"Slot {slot_number}",
                    "archived": False,
                },
            )

    with op.batch_alter_table("trays") as batch_op:
        batch_op.add_column(sa.Column("tray_slot_id", sa.CHAR(length=36)))
        batch_op.add_column(sa.Column("physical_tray_id", sa.CHAR(length=36)))
        batch_op.create_foreign_key(
            "fk_trays_tray_slot_id_tray_slots",
            "tray_slots",
            ["tray_slot_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_trays_physical_tray_id_physical_trays",
            "physical_trays",
            ["physical_tray_id"],
            ["id"],
        )
        batch_op.create_unique_constraint(
            "uq_trays_production_batch_tray_slot",
            ["production_batch_id", "tray_slot_id"],
        )
        batch_op.create_unique_constraint(
            "uq_trays_production_batch_physical_tray",
            ["production_batch_id", "physical_tray_id"],
        )

    tray_rows = connection.execute(sa.text("""
            select
                trays.id as tray_id,
                trays.tray_number as tray_number,
                production_batches.freeze_dryer_id as freeze_dryer_id
            from trays
            join production_batches
                on production_batches.id = trays.production_batch_id
            where trays.tray_slot_id is null
                or trays.physical_tray_id is null
            """)).mappings()
    for tray in tray_rows:
        slot_number = tray["tray_number"] or 1
        tray_slot_id = connection.execute(
            sa.text("""
                select id
                from tray_slots
                where freeze_dryer_id = :freeze_dryer_id
                    and slot_number = :slot_number
                """),
            {
                "freeze_dryer_id": tray["freeze_dryer_id"],
                "slot_number": slot_number,
            },
        ).scalar_one_or_none()
        if tray_slot_id is None:
            tray_slot_id = str(uuid4())
            connection.execute(
                sa.text("""
                    insert into tray_slots
                        (id, freeze_dryer_id, slot_number, label, archived)
                    values
                        (:id, :freeze_dryer_id, :slot_number, :label, :archived)
                    """),
                {
                    "id": tray_slot_id,
                    "freeze_dryer_id": tray["freeze_dryer_id"],
                    "slot_number": slot_number,
                    "label": f"Slot {slot_number}",
                    "archived": False,
                },
            )

        physical_tray_id = str(uuid4())
        connection.execute(
            sa.text("""
                insert into physical_trays (id, label, notes, archived)
                values (:id, :label, :notes, :archived)
                """),
            {
                "id": physical_tray_id,
                "label": f"Imported Tray {slot_number} {physical_tray_id[:8]}",
                "notes": "Created during Tray Slot migration for an existing Tray.",
                "archived": False,
            },
        )
        connection.execute(
            sa.text("""
                update trays
                set tray_slot_id = :tray_slot_id,
                    physical_tray_id = :physical_tray_id
                where id = :tray_id
                """),
            {
                "tray_slot_id": tray_slot_id,
                "physical_tray_id": physical_tray_id,
                "tray_id": tray["tray_id"],
            },
        )


def downgrade() -> None:
    with op.batch_alter_table("trays") as batch_op:
        batch_op.drop_constraint(
            "uq_trays_production_batch_physical_tray",
            type_="unique",
        )
        batch_op.drop_constraint("uq_trays_production_batch_tray_slot", type_="unique")
        batch_op.drop_constraint(
            "fk_trays_physical_tray_id_physical_trays",
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            "fk_trays_tray_slot_id_tray_slots",
            type_="foreignkey",
        )
        batch_op.drop_column("physical_tray_id")
        batch_op.drop_column("tray_slot_id")

    op.drop_table("tray_slots")
    op.drop_table("physical_trays")

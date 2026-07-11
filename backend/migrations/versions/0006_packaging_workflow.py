"""packaging workflow

Revision ID: 0006_packaging_workflow
Revises: 0005_physical_tray_tare_weight
Create Date: 2026-07-07 12:00:00.000000

"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0006_packaging_workflow"
down_revision: str | Sequence[str] | None = "0005_physical_tray_tare_weight"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "package_types",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("default_oxygen_absorber", sa.String(length=255), nullable=True),
        sa.Column("default_label_template", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("packages") as batch_op:
        batch_op.add_column(sa.Column("package_type_id", sa.CHAR(length=36)))
        batch_op.add_column(sa.Column("package_identifier", sa.String(length=255)))

    _backfill_existing_packages()

    with op.batch_alter_table("packages") as batch_op:
        batch_op.drop_constraint("ck_packages_status", type_="check")
        batch_op.alter_column("package_type_id", nullable=False)
        batch_op.alter_column("package_identifier", nullable=False)
        batch_op.create_foreign_key(
            "fk_packages_package_type_id_package_types",
            "package_types",
            ["package_type_id"],
            ["id"],
        )
        batch_op.create_unique_constraint(
            "uq_packages_package_identifier",
            ["package_identifier"],
        )
        batch_op.create_check_constraint(
            "ck_packages_status",
            "status in ('In Storage', 'Given Away', 'Depleted')",
        )


def downgrade() -> None:
    with op.batch_alter_table("packages") as batch_op:
        batch_op.drop_constraint("ck_packages_status", type_="check")
        batch_op.drop_constraint("uq_packages_package_identifier", type_="unique")
        batch_op.drop_constraint(
            "fk_packages_package_type_id_package_types",
            type_="foreignkey",
        )
        batch_op.create_check_constraint(
            "ck_packages_status",
            "status in ('In Storage', 'Depleted')",
        )
        batch_op.drop_column("package_identifier")
        batch_op.drop_column("package_type_id")

    op.drop_table("package_types")


def _backfill_existing_packages() -> None:
    bind = op.get_bind()
    package_ids = list(bind.execute(sa.text("select id from packages")).scalars())
    if not package_ids:
        return

    package_type_id = str(uuid4())
    bind.execute(
        sa.text("""
            insert into package_types
                (
                    id,
                    name,
                    default_oxygen_absorber,
                    default_label_template,
                    notes,
                    archived
                )
            values
                (:id, 'Imported Package Type', null, null,
                 'Created during Packaging Workflow migration for existing Packages.',
                 0)
            """),
        {"id": package_type_id},
    )
    for index, package_id in enumerate(package_ids, start=1):
        bind.execute(
            sa.text("""
                update packages
                set package_type_id = :package_type_id,
                    package_identifier = :package_identifier
                where id = :package_id
                """),
            {
                "package_type_id": package_type_id,
                "package_identifier": f"PKG-IMPORT-{index:06d}",
                "package_id": package_id,
            },
        )

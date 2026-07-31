from pathlib import Path
from uuid import UUID, uuid5

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings

MIGRATION_NAMESPACE = UUID("28751318-8a43-4e10-8484-08a60fcbd56a")


def _alembic_config(database_path: Path, monkeypatch) -> Config:
    monkeypatch.setenv("FREEZEFLOW_DATABASE_URL", f"sqlite:///{database_path}")
    get_settings.cache_clear()
    backend_root = Path(__file__).parents[2]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    return config


def test_alembic_upgrade_creates_refined_packaging_tables(
    tmp_path, monkeypatch
) -> None:
    database_path = tmp_path / "freezeflow_test.db"
    alembic_config = _alembic_config(database_path, monkeypatch)
    command.upgrade(alembic_config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    assert {
        "audit_entries",
        "drying_runs",
        "freeze_dryers",
        "package_labels",
        "package_status_histories",
        "package_types",
        "packages",
        "packaging_allocation_source_trays",
        "packaging_allocations",
        "packaging_operations",
        "physical_trays",
        "planned_package_rows",
        "print_events",
        "production_batches",
        "recipes",
        "storage_location_histories",
        "storage_locations",
        "tray_slots",
        "trays",
        "weight_checks",
    }.issubset(table_names)
    assert "packaging_operation_trays" not in table_names

    operation_columns = {
        column["name"] for column in inspector.get_columns("packaging_operations")
    }
    assert {
        "production_batch_id",
        "status",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
    }.issubset(operation_columns)
    assert "packaged_at" not in operation_columns
    assert any(
        index["name"] == "uq_packaging_operations_open_batch" and index["unique"]
        for index in inspector.get_indexes("packaging_operations")
    )

    package_columns = {column["name"] for column in inspector.get_columns("packages")}
    assert {
        "packaging_allocation_id",
        "packaged_at",
        "package_type_id",
        "package_identifier",
        "finished_product_weight_grams",
        "package_weight_grams",
    }.issubset(package_columns)
    assert "packaging_operation_id" not in package_columns

    tray_columns = {column["name"]: column for column in inspector.get_columns("trays")}
    assert tray_columns["tray_slot_id"]["nullable"] is False
    assert tray_columns["physical_tray_id"]["nullable"] is False
    assert tray_columns["tray_number"]["nullable"] is True

    get_settings.cache_clear()


def test_refined_packaging_migration_backfills_legacy_traceability(
    tmp_path, monkeypatch
) -> None:
    database_path = tmp_path / "legacy_freezeflow.db"
    alembic_config = _alembic_config(database_path, monkeypatch)
    command.upgrade(alembic_config, "0008_align_tray_nullability")

    engine = create_engine(f"sqlite:///{database_path}")
    ids = {
        "dryer": "00000000-0000-0000-0000-000000000001",
        "batch": "00000000-0000-0000-0000-000000000002",
        "slot": "00000000-0000-0000-0000-000000000003",
        "physical_tray": "00000000-0000-0000-0000-000000000004",
        "tray": "00000000-0000-0000-0000-000000000005",
        "operation": "00000000-0000-0000-0000-000000000006",
        "operation_tray": "00000000-0000-0000-0000-000000000007",
        "location": "00000000-0000-0000-0000-000000000008",
        "package_type": "00000000-0000-0000-0000-000000000009",
        "package": "00000000-0000-0000-0000-000000000010",
    }
    packaged_at = "2026-07-17 15:30:00"

    with engine.begin() as connection:
        connection.execute(
            text(
                "insert into freeze_dryers (id, name, notes, archived) "
                "values (:id, 'Black', null, 0)"
            ),
            {"id": ids["dryer"]},
        )
        connection.execute(
            text(
                "insert into production_batches "
                "(id, freeze_dryer_id, batch_number, status, started_at, "
                "completed_at, notes) values "
                "(:id, :dryer_id, 'Batch 014', 'Completed', :at, :at, null)"
            ),
            {"id": ids["batch"], "dryer_id": ids["dryer"], "at": packaged_at},
        )
        connection.execute(
            text(
                "insert into tray_slots "
                "(id, freeze_dryer_id, slot_number, label, archived) "
                "values (:id, :dryer_id, 1, 'Slot 1', 0)"
            ),
            {"id": ids["slot"], "dryer_id": ids["dryer"]},
        )
        connection.execute(
            text(
                "insert into physical_trays "
                "(id, label, tare_weight_grams, notes, archived) "
                "values (:id, 'Tray 1', null, null, 0)"
            ),
            {"id": ids["physical_tray"]},
        )
        connection.execute(
            text(
                "insert into trays "
                "(id, production_batch_id, recipe_id, tray_number, product_name, "
                "preparation, notes, status, starting_weight_grams, "
                "final_dry_weight_grams, completed_at, tray_slot_id, "
                "physical_tray_id) values "
                "(:id, :batch_id, null, 1, 'Taco Chicken', 'shredded, seasoned', "
                "null, 'Packaged', 900, 240, :at, :slot_id, :physical_tray_id)"
            ),
            {
                "id": ids["tray"],
                "batch_id": ids["batch"],
                "at": packaged_at,
                "slot_id": ids["slot"],
                "physical_tray_id": ids["physical_tray"],
            },
        )
        connection.execute(
            text(
                "insert into packaging_operations (id, packaged_at, notes) "
                "values (:id, :at, 'Legacy operation')"
            ),
            {"id": ids["operation"], "at": packaged_at},
        )
        connection.execute(
            text(
                "insert into packaging_operation_trays "
                "(id, packaging_operation_id, tray_id) "
                "values (:id, :operation_id, :tray_id)"
            ),
            {
                "id": ids["operation_tray"],
                "operation_id": ids["operation"],
                "tray_id": ids["tray"],
            },
        )
        connection.execute(
            text(
                "insert into storage_locations (id, name, notes, archived) "
                "values (:id, 'Unassigned', null, 0)"
            ),
            {"id": ids["location"]},
        )
        connection.execute(
            text(
                "insert into package_types "
                "(id, name, default_oxygen_absorber, default_label_template, "
                "notes, archived) values "
                "(:id, 'Quart Mylar', '500cc', 'Avery 5163', null, 0)"
            ),
            {"id": ids["package_type"]},
        )
        connection.execute(
            text(
                "insert into packages "
                "(id, packaging_operation_id, storage_location_id, "
                "package_weight_grams, oxygen_absorber, notes, status, "
                "package_type_id, package_identifier, "
                "finished_product_weight_grams) values "
                "(:id, :operation_id, :location_id, 250, '500cc', null, "
                "'In Storage', :package_type_id, 'PKG-2026-000014', 240)"
            ),
            {
                "id": ids["package"],
                "operation_id": ids["operation"],
                "location_id": ids["location"],
                "package_type_id": ids["package_type"],
            },
        )

    command.upgrade(alembic_config, "head")

    expected_allocation_id = str(
        uuid5(MIGRATION_NAMESPACE, f"allocation:{ids['operation']}")
    )
    expected_label_id = str(
        uuid5(MIGRATION_NAMESPACE, f"package-label:{ids['package']}")
    )
    with engine.connect() as connection:
        operation = (
            connection.execute(
                text("select * from packaging_operations where id = :id"),
                {"id": ids["operation"]},
            )
            .mappings()
            .one()
        )
        assert operation["production_batch_id"] == ids["batch"]
        assert operation["status"] == "Completed"
        assert operation["completed_at"] is not None

        allocation = (
            connection.execute(
                text("select * from packaging_allocations where id = :id"),
                {"id": expected_allocation_id},
            )
            .mappings()
            .one()
        )
        assert allocation["packaging_operation_id"] == ids["operation"]

        source = (
            connection.execute(
                text(
                    "select * from packaging_allocation_source_trays "
                    "where packaging_allocation_id = :allocation_id"
                ),
                {"allocation_id": expected_allocation_id},
            )
            .mappings()
            .one()
        )
        assert source["tray_id"] == ids["tray"]

        package = (
            connection.execute(
                text("select * from packages where id = :id"),
                {"id": ids["package"]},
            )
            .mappings()
            .one()
        )
        assert package["packaging_allocation_id"] == expected_allocation_id
        assert package["packaged_at"] is not None

        label = (
            connection.execute(
                text("select * from package_labels where package_id = :package_id"),
                {"package_id": ids["package"]},
            )
            .mappings()
            .one()
        )
        assert label["id"] == expected_label_id
        assert label["display_name"] == "Taco Chicken"
        assert label["preparation_summary"] == "shredded, seasoned"

        statuses = (
            connection.execute(
                text(
                    "select current_status from package_status_histories "
                    "where package_id = :package_id order by recorded_at"
                ),
                {"package_id": ids["package"]},
            )
            .scalars()
            .all()
        )
        assert statuses == ["In Storage"]

        storage_history_count = connection.execute(
            text(
                "select count(*) from storage_location_histories "
                "where package_id = :package_id"
            ),
            {"package_id": ids["package"]},
        ).scalar_one()
        assert storage_history_count == 1

    engine.dispose()
    command.downgrade(alembic_config, "0008_align_tray_nullability")

    downgraded_engine = create_engine(f"sqlite:///{database_path}")
    downgraded_inspector = inspect(downgraded_engine)
    assert "packaging_operation_trays" in downgraded_inspector.get_table_names()
    assert "packaging_allocations" not in downgraded_inspector.get_table_names()
    assert "packaged_at" in {
        column["name"]
        for column in downgraded_inspector.get_columns("packaging_operations")
    }
    assert "packaging_operation_id" in {
        column["name"] for column in downgraded_inspector.get_columns("packages")
    }

    with downgraded_engine.connect() as connection:
        restored_operation_id = connection.execute(
            text(
                "select packaging_operation_id from packages " "where id = :package_id"
            ),
            {"package_id": ids["package"]},
        ).scalar_one()
        assert restored_operation_id == ids["operation"]

        restored_source_trays = connection.execute(
            text(
                "select tray_id from packaging_operation_trays "
                "where packaging_operation_id = :operation_id"
            ),
            {"operation_id": ids["operation"]},
        ).scalars()
        assert list(restored_source_trays) == [ids["tray"]]

    downgraded_engine.dispose()

    get_settings.cache_clear()

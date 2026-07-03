from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings


def test_alembic_upgrade_creates_persistence_tables(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "freezeflow_test.db"
    monkeypatch.setenv("FREEZEFLOW_DATABASE_URL", f"sqlite:///{database_path}")
    get_settings.cache_clear()

    backend_root = Path(__file__).parents[2]
    alembic_config = Config(str(backend_root / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(backend_root / "migrations"))
    command.upgrade(alembic_config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    inspector = inspect(engine)

    assert {
        "audit_entries",
        "freeze_dryers",
        "packages",
        "packaging_operation_trays",
        "packaging_operations",
        "physical_trays",
        "production_batches",
        "recipes",
        "storage_location_histories",
        "storage_locations",
        "tray_slots",
        "trays",
        "weight_checks",
    }.issubset(set(inspector.get_table_names()))

    get_settings.cache_clear()

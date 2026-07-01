from datetime import UTC, datetime
from decimal import Decimal

from app.models import (
    FreezeDryer,
    InventoryStatus,
    Package,
    PackagingOperation,
    PackagingOperationTray,
    ProductionBatch,
    ProductionBatchStatus,
    Recipe,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TrayStatus,
    WeightCheck,
)


def test_model_creation_and_relationships(db_session) -> None:
    now = datetime.now(UTC)
    freeze_dryer = FreezeDryer(
        name="Freeze Dryer #1",
        manufacturer="Harvest Right",
        model="Medium",
        tray_count=4,
    )
    recipe = Recipe(
        name="Taco Chicken",
        product="Chicken",
        preparation="Cubed and seasoned.",
    )
    storage_location = StorageLocation(name="Bin A")
    db_session.add_all([freeze_dryer, recipe, storage_location])
    db_session.flush()

    production_batch = ProductionBatch(
        freeze_dryer_id=freeze_dryer.id,
        name="Chicken Batch",
        started_at=now,
        status=ProductionBatchStatus.RUNNING,
    )
    db_session.add(production_batch)
    db_session.flush()

    tray = Tray(
        production_batch_id=production_batch.id,
        recipe_id=recipe.id,
        tray_number=1,
        product_name="Chicken",
        preparation="Cubed and seasoned.",
        starting_weight_grams=Decimal("964.000"),
        final_dry_weight_grams=Decimal("231.000"),
        status=TrayStatus.COMPLETED,
    )
    db_session.add(tray)
    db_session.flush()

    weight_check = WeightCheck(
        tray_id=tray.id,
        observed_at=now,
        elapsed_hours=Decimal("12.50"),
        weight_grams=Decimal("250.000"),
    )
    packaging_operation = PackagingOperation(
        packaged_at=now,
        total_source_weight_grams=Decimal("231.000"),
    )
    db_session.add_all([weight_check, packaging_operation])
    db_session.flush()

    packaging_link = PackagingOperationTray(
        packaging_operation_id=packaging_operation.id,
        tray_id=tray.id,
    )
    package = Package(
        packaging_operation_id=packaging_operation.id,
        package_date=now,
        package_weight_grams=Decimal("240.000"),
        oxygen_absorber="300cc",
        storage_location_id=storage_location.id,
        inventory_status=InventoryStatus.IN_STORAGE,
    )
    db_session.add_all([packaging_link, package])
    db_session.flush()

    storage_history = StorageLocationHistory(
        package_id=package.id,
        previous_storage_location_id=None,
        new_storage_location_id=storage_location.id,
        moved_at=now,
    )
    db_session.add(storage_history)
    db_session.commit()

    assert freeze_dryer.production_batches == [production_batch]
    assert production_batch.trays == [tray]
    assert tray.recipe == recipe
    assert tray.weight_checks == [weight_check]
    assert tray.packaging_operation_link == packaging_link
    assert packaging_operation.tray_links == [packaging_link]
    assert packaging_operation.packages == [package]
    assert package.storage_location == storage_location
    assert package.storage_location_history == [storage_history]

from datetime import UTC, datetime
from decimal import Decimal

from app.models import (
    FreezeDryer,
    InventoryStatus,
    Package,
    PackagingOperation,
    PackagingOperationTray,
    PhysicalTray,
    ProductionBatch,
    ProductionBatchStatus,
    Recipe,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TraySlot,
    TrayStatus,
    WeightCheck,
)


def test_model_creation_and_relationships(db_session) -> None:
    now = datetime.now(UTC)
    freeze_dryer = FreezeDryer(
        name="Freeze Dryer #1",
        notes="Primary freeze dryer",
    )
    recipe = Recipe(
        name="Taco Chicken",
        product_name="Chicken",
        preparation="Cubed and seasoned.",
    )
    storage_location = StorageLocation(name="Bin A")
    db_session.add_all([freeze_dryer, recipe, storage_location])
    db_session.flush()
    tray_slot = TraySlot(
        freeze_dryer_id=freeze_dryer.id,
        slot_number=1,
        label="Slot 1",
    )
    physical_tray = PhysicalTray(label="Tray 1")
    db_session.add_all([tray_slot, physical_tray])
    db_session.flush()

    production_batch = ProductionBatch(
        freeze_dryer_id=freeze_dryer.id,
        batch_number="Chicken Batch",
        started_at=now,
        status=ProductionBatchStatus.RUNNING,
    )
    db_session.add(production_batch)
    db_session.flush()

    tray = Tray(
        production_batch_id=production_batch.id,
        tray_slot_id=tray_slot.id,
        physical_tray_id=physical_tray.id,
        recipe_id=recipe.id,
        tray_number=tray_slot.slot_number,
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
        weight_grams=Decimal("250.000"),
    )
    packaging_operation = PackagingOperation(packaged_at=now)
    db_session.add_all([weight_check, packaging_operation])
    db_session.flush()

    packaging_link = PackagingOperationTray(
        packaging_operation_id=packaging_operation.id,
        tray_id=tray.id,
    )
    package = Package(
        packaging_operation_id=packaging_operation.id,
        package_weight_grams=Decimal("240.000"),
        oxygen_absorber="300cc",
        storage_location_id=storage_location.id,
        status=InventoryStatus.IN_STORAGE,
    )
    db_session.add_all([packaging_link, package])
    db_session.flush()

    storage_history = StorageLocationHistory(
        package_id=package.id,
        previous_storage_location_id=None,
        current_storage_location_id=storage_location.id,
        moved_at=now,
    )
    db_session.add(storage_history)
    db_session.commit()

    assert freeze_dryer.production_batches == [production_batch]
    assert freeze_dryer.tray_slots == [tray_slot]
    assert production_batch.trays == [tray]
    assert tray.tray_slot == tray_slot
    assert tray.physical_tray == physical_tray
    assert tray.recipe == recipe
    assert tray.weight_checks == [weight_check]
    assert tray.packaging_operation_link == packaging_link
    assert packaging_operation.tray_links == [packaging_link]
    assert packaging_operation.packages == [package]
    assert package.storage_location == storage_location
    assert package.storage_location_history == [storage_history]

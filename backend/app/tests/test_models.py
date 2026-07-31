from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from app.models import (
    FreezeDryer,
    InventoryStatus,
    PackageLabelStatus,
    PackageType,
    PackagingAllocation,
    PackagingAllocationSourceTray,
    PackagingOperation,
    PackagingOperationStatus,
    PhysicalTray,
    PlannedPackageRow,
    ProductionBatch,
    ProductionBatchStatus,
    StorageLocation,
    Tray,
    TraySlot,
    TrayStatus,
)
from app.repositories.packages import package_repository
from app.schemas import PackageCreate, PackageLabelCreate


def test_refined_packaging_model_relationships(db_session) -> None:
    now = datetime.now(UTC)
    freeze_dryer = FreezeDryer(name="Freeze Dryer #1")
    package_type = PackageType(
        name="Quart Mylar",
        default_oxygen_absorber="300cc",
        default_label_template="standard",
    )
    storage_location = StorageLocation(name="Bin A")
    physical_tray = PhysicalTray(label="Tray 1")
    db_session.add_all([freeze_dryer, package_type, storage_location, physical_tray])
    db_session.flush()

    tray_slot = TraySlot(
        freeze_dryer_id=freeze_dryer.id,
        slot_number=1,
        label="Slot 1",
    )
    batch = ProductionBatch(
        freeze_dryer_id=freeze_dryer.id,
        batch_number="Chicken Batch",
        started_at=now,
        completed_at=now,
        status=ProductionBatchStatus.COMPLETED,
    )
    db_session.add_all([tray_slot, batch])
    db_session.flush()

    tray = Tray(
        production_batch_id=batch.id,
        tray_slot_id=tray_slot.id,
        physical_tray_id=physical_tray.id,
        tray_number=1,
        product_name="Chicken",
        preparation="Cubed and seasoned.",
        starting_weight_grams=Decimal("964.000"),
        final_dry_weight_grams=Decimal("231.000"),
        status=TrayStatus.COMPLETED,
        completed_at=now,
    )
    operation = PackagingOperation(
        production_batch_id=batch.id,
        status=PackagingOperationStatus.OPEN,
        started_at=now,
    )
    db_session.add_all([tray, operation])
    db_session.flush()

    allocation = PackagingAllocation(packaging_operation_id=operation.id)
    db_session.add(allocation)
    db_session.flush()
    source = PackagingAllocationSourceTray(
        packaging_allocation_id=allocation.id,
        tray_id=tray.id,
    )
    planned_row = PlannedPackageRow(
        packaging_allocation_id=allocation.id,
        package_type_id=package_type.id,
        finished_product_weight_grams=Decimal("100.000"),
        sealed_package_weight_grams=Decimal("110.000"),
        label_status=PackageLabelStatus.DRAFT,
        label_display_name="Taco Chicken",
    )
    db_session.add_all([source, planned_row])
    db_session.flush()

    package = package_repository.create(
        db_session,
        PackageCreate(
            packaging_allocation_id=allocation.id,
            package_type_id=package_type.id,
            package_identifier=f"PKG-{uuid4()}",
            packaged_at=now,
            storage_location_id=storage_location.id,
            package_weight_grams=Decimal("141.000"),
            finished_product_weight_grams=Decimal("131.000"),
            oxygen_absorber="300cc",
            label=PackageLabelCreate(
                status=PackageLabelStatus.READY,
                display_name="Taco Chicken",
            ),
        ),
    )
    planned_row.recorded_package_id = package.id
    db_session.commit()

    assert batch.packaging_operations == [operation]
    assert operation.production_batch == batch
    assert operation.allocations == [allocation]
    assert allocation.source_tray_links == [source]
    assert source.tray == tray
    assert allocation.planned_package_rows == [planned_row]
    assert allocation.packages == [package]
    assert allocation.selected_weight_grams == Decimal("231.000")
    assert allocation.allocated_weight_grams == Decimal("131.000")
    assert allocation.remaining_weight_grams == Decimal("100.000")
    assert package.status == InventoryStatus.IN_STORAGE
    assert package.label.display_name == "Taco Chicken"
    assert len(package.status_history) == 1
    assert len(package.storage_location_history) == 1

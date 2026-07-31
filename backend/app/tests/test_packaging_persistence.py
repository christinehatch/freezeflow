from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import (
    FreezeDryer,
    InventoryStatus,
    Package,
    PackageLabelStatus,
    PackageStatusHistory,
    PackageType,
    PackagingOperation,
    PackagingOperationStatus,
    PhysicalTray,
    ProductionBatch,
    ProductionBatchStatus,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TraySlot,
    TrayStatus,
)
from app.repositories.package_history import print_event_repository
from app.repositories.package_labels import package_label_repository
from app.repositories.packages import package_repository
from app.repositories.packaging_operations import (
    packaging_allocation_repository,
    packaging_operation_repository,
    planned_package_row_repository,
)
from app.schemas import (
    PackageCreate,
    PackageLabelCreate,
    PackageLabelUpdate,
    PlannedPackageRowCreate,
    PrintEventCreate,
)


def _create_completed_batch(db_session, *, suffix: str = "A"):
    now = datetime.now(UTC)
    freeze_dryer = FreezeDryer(name=f"Dryer {suffix}")
    batch = ProductionBatch(
        freeze_dryer=freeze_dryer,
        batch_number=f"Batch {suffix}",
        status=ProductionBatchStatus.COMPLETED,
        started_at=now - timedelta(days=1),
        completed_at=now,
    )
    db_session.add(batch)
    db_session.flush()

    trays = []
    for slot_number, final_weight in ((1, "120.000"), (2, "80.000")):
        slot = TraySlot(
            freeze_dryer=freeze_dryer,
            slot_number=slot_number,
            label=f"Slot {slot_number}",
        )
        physical_tray = PhysicalTray(label=f"Tray {suffix}-{slot_number}")
        tray = Tray(
            production_batch=batch,
            tray_slot=slot,
            physical_tray=physical_tray,
            tray_number=slot_number,
            product_name="Chicken",
            preparation="Cubed, salt, and pepper",
            starting_weight_grams=Decimal("500.000"),
            final_dry_weight_grams=Decimal(final_weight),
            status=TrayStatus.COMPLETED,
            completed_at=now,
        )
        db_session.add(tray)
        trays.append(tray)
    db_session.flush()
    return batch, trays


def _create_open_operation(db_session, batch):
    operation = PackagingOperation(
        production_batch_id=batch.id,
        status=PackagingOperationStatus.OPEN,
        started_at=datetime.now(UTC),
    )
    db_session.add(operation)
    db_session.flush()
    return operation


def test_operation_is_resumable_and_only_one_may_be_open_per_batch(db_session) -> None:
    batch, _ = _create_completed_batch(db_session)
    operation = _create_open_operation(db_session, batch)
    operation_id = operation.id
    db_session.commit()
    db_session.expire_all()

    resumed = db_session.get(PackagingOperation, operation_id)
    assert resumed is not None
    assert resumed.status == PackagingOperationStatus.OPEN
    assert resumed.completed_at is None

    db_session.add(
        PackagingOperation(
            production_batch_id=batch.id,
            status=PackagingOperationStatus.OPEN,
            started_at=datetime.now(UTC),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

    resumed = db_session.get(PackagingOperation, operation_id)
    packaging_operation_repository.complete(db_session, resumed)
    replacement = _create_open_operation(db_session, batch)
    db_session.commit()

    assert resumed.status == PackagingOperationStatus.COMPLETED
    assert resumed.completed_at is not None
    assert replacement.status == PackagingOperationStatus.OPEN


def test_allocation_requires_unique_completed_same_batch_source_trays(
    db_session,
) -> None:
    batch, trays = _create_completed_batch(db_session)
    other_batch, other_trays = _create_completed_batch(db_session, suffix="B")
    operation = _create_open_operation(db_session, batch)

    with pytest.raises(ValueError, match="at least one"):
        packaging_allocation_repository.create_with_sources(
            db_session, packaging_operation_id=operation.id, tray_ids=[]
        )
    with pytest.raises(ValueError, match="only appear once"):
        packaging_allocation_repository.create_with_sources(
            db_session,
            packaging_operation_id=operation.id,
            tray_ids=[trays[0].id, trays[0].id],
        )
    with pytest.raises(ValueError, match="Production Batch"):
        packaging_allocation_repository.create_with_sources(
            db_session,
            packaging_operation_id=operation.id,
            tray_ids=[other_trays[0].id],
        )

    trays[1].status = TrayStatus.RUNNING
    with pytest.raises(ValueError, match="Only Completed"):
        packaging_allocation_repository.create_with_sources(
            db_session,
            packaging_operation_id=operation.id,
            tray_ids=[trays[1].id],
        )
    trays[1].status = TrayStatus.COMPLETED

    allocation = packaging_allocation_repository.create_with_sources(
        db_session,
        packaging_operation_id=operation.id,
        tray_ids=[trays[0].id, trays[1].id],
    )
    db_session.commit()

    assert allocation.id is not None
    assert allocation.packages == []
    assert {link.tray_id for link in allocation.source_tray_links} == {
        trays[0].id,
        trays[1].id,
    }
    with pytest.raises(ValueError, match="only belong to one"):
        packaging_allocation_repository.create_with_sources(
            db_session,
            packaging_operation_id=operation.id,
            tray_ids=[trays[0].id],
        )
    assert other_batch.id != batch.id


def test_planned_rows_persist_without_inventory_and_drive_derived_totals(
    db_session,
) -> None:
    batch, trays = _create_completed_batch(db_session)
    operation = _create_open_operation(db_session, batch)
    allocation = packaging_allocation_repository.create_with_sources(
        db_session,
        packaging_operation_id=operation.id,
        tray_ids=[tray.id for tray in trays],
    )
    package_type = PackageType(name="Quart Mylar")
    db_session.add(package_type)
    db_session.flush()

    row = planned_package_row_repository.create(
        db_session,
        PlannedPackageRowCreate(
            packaging_allocation_id=allocation.id,
            package_type_id=package_type.id,
            finished_product_weight_grams=Decimal("75.000"),
            finished_product_weight_unit="g",
            sealed_package_weight_grams=Decimal("90.000"),
            sealed_package_weight_unit="g",
            label_status=PackageLabelStatus.DRAFT,
            label_display_name="Chicken",
        ),
    )
    db_session.commit()

    assert db_session.scalar(select(Package)) is None
    assert db_session.scalar(select(PackageStatusHistory)) is None
    assert row.recorded_package_id is None
    assert allocation.selected_weight_grams == Decimal("200.000")
    assert allocation.allocated_weight_grams == Decimal("75.000")
    assert allocation.remaining_weight_grams == Decimal("125.000")


def test_package_creation_adds_label_and_initial_histories_with_unassigned(
    db_session,
) -> None:
    batch, trays = _create_completed_batch(db_session)
    operation = _create_open_operation(db_session, batch)
    allocation = packaging_allocation_repository.create_with_sources(
        db_session,
        packaging_operation_id=operation.id,
        tray_ids=[trays[0].id],
    )
    package_type = PackageType(name="Pint Mylar")
    db_session.add(package_type)
    db_session.flush()
    packaged_at = datetime.now(UTC) - timedelta(hours=2)

    package = package_repository.create(
        db_session,
        PackageCreate(
            packaging_allocation_id=allocation.id,
            package_type_id=package_type.id,
            package_identifier=f"PKG-{uuid4()}",
            packaged_at=packaged_at,
            package_weight_grams=Decimal("101.000"),
            finished_product_weight_grams=Decimal("95.000"),
            label=PackageLabelCreate(
                status=PackageLabelStatus.READY,
                display_name="Taco Chicken",
                preparation_summary="Cubed, salt, and pepper",
            ),
        ),
    )
    db_session.commit()

    assert package.storage_location.name == "Unassigned"
    assert package.status == InventoryStatus.IN_STORAGE
    assert package.label.display_name == "Taco Chicken"
    assert package.label.package_id == package.id
    assert package.status_history[0].previous_status is None
    assert package.status_history[0].current_status == InventoryStatus.IN_STORAGE
    assert package.status_history[0].effective_at == packaged_at.replace(tzinfo=None)
    assert package.storage_location_history[0].previous_storage_location_id is None
    assert (
        package.storage_location_history[0].current_storage_location_id
        == package.storage_location_id
    )
    assert package.packaging_allocation.packaging_operation.production_batch == batch
    assert package.packaging_allocation.source_tray_links[0].tray == trays[0]


def test_selected_storage_label_updates_and_print_events_are_preserved(
    db_session,
) -> None:
    batch, trays = _create_completed_batch(db_session)
    operation = _create_open_operation(db_session, batch)
    allocation = packaging_allocation_repository.create_with_sources(
        db_session,
        packaging_operation_id=operation.id,
        tray_ids=[trays[0].id],
    )
    package_type = PackageType(name="Quart Mylar")
    storage = StorageLocation(name="Bin A")
    db_session.add_all([package_type, storage])
    db_session.flush()
    now = datetime.now(UTC)
    package = package_repository.create(
        db_session,
        PackageCreate(
            packaging_allocation_id=allocation.id,
            package_type_id=package_type.id,
            package_identifier=f"PKG-{uuid4()}",
            packaged_at=now,
            storage_location_id=storage.id,
            package_weight_grams=Decimal("110.000"),
            finished_product_weight_grams=Decimal("100.000"),
            label=PackageLabelCreate(display_name="Chicken"),
        ),
    )
    package_label_repository.update(
        db_session,
        package.label,
        PackageLabelUpdate(
            status=PackageLabelStatus.READY,
            display_name="Martin's Taco Meal",
        ),
    )
    print_job_id = uuid4()
    first = print_event_repository.create(
        db_session,
        PrintEventCreate(
            package_label_id=package.label.id,
            printed_at=now,
            template="Avery 5163",
            print_job_id=print_job_id,
        ),
    )
    second = print_event_repository.create(
        db_session,
        PrintEventCreate(
            package_label_id=package.label.id,
            printed_at=now + timedelta(minutes=5),
            template="Avery 5163",
            print_job_id=uuid4(),
            notes="Replacement label",
        ),
    )
    db_session.commit()

    histories = list(db_session.scalars(select(StorageLocationHistory)).all())
    assert package.storage_location == storage
    assert histories[0].current_storage_location_id == storage.id
    assert package.label.display_name == "Martin's Taco Meal"
    assert package.label.status == PackageLabelStatus.READY
    assert [event.id for event in package.label.print_events] == [first.id, second.id]
    assert first.print_job_id == print_job_id

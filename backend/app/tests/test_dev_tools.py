from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models import (
    InventoryStatus,
    Package,
    PackageLabel,
    PackageLabelStatus,
    PackageStatusHistory,
    PackagingAllocationSourceTray,
    PackagingOperation,
    PackagingOperationStatus,
    PlannedPackageRow,
    PrintEvent,
    ProductionBatch,
    ProductionBatchStatus,
    StorageLocationHistory,
    Tray,
    TrayStatus,
    WeightCheck,
)


def test_basic_demo_seeds_a_consistent_lifecycle(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/dev/demo/basic")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["action"] == "basic"
    for table_name in (
        "freeze_dryers",
        "recipes",
        "production_batches",
        "trays",
        "packaging_operations",
        "packaging_allocations",
        "planned_package_rows",
        "packages",
        "package_labels",
        "print_events",
        "package_status_histories",
        "storage_locations",
        "storage_location_histories",
    ):
        assert payload["counts"][table_name] > 0

    statuses = set(db_session.scalars(select(Package.status)))
    assert statuses == {
        InventoryStatus.IN_STORAGE,
        InventoryStatus.GIVEN_AWAY,
        InventoryStatus.DEPLETED,
    }

    running_batches = list(
        db_session.scalars(
            select(ProductionBatch).where(
                ProductionBatch.status == ProductionBatchStatus.RUNNING
            )
        )
    )
    assert len(running_batches) == 1
    assert all(tray.status == TrayStatus.RUNNING for tray in running_batches[0].trays)

    for check in db_session.scalars(select(WeightCheck)):
        assert check.tray.production_batch_id == check.drying_run.production_batch_id

    operations = list(db_session.scalars(select(PackagingOperation)))
    assert {operation.status for operation in operations} == {
        PackagingOperationStatus.OPEN,
        PackagingOperationStatus.COMPLETED,
    }
    for operation in operations:
        linked_batches = {
            link.tray.production_batch_id
            for allocation in operation.allocations
            for link in allocation.source_tray_links
        }
        assert linked_batches == {operation.production_batch_id}

    open_operation = next(
        operation
        for operation in operations
        if operation.status == PackagingOperationStatus.OPEN
    )
    assert len(open_operation.allocations) == 1
    open_allocation = open_operation.allocations[0]
    assert len(open_allocation.source_tray_links) == 2
    assert len(open_allocation.planned_package_rows) == 2
    assert not open_allocation.packages
    assert open_allocation.remaining_weight_grams > 0
    assert all(
        row.recorded_package_id is None and row.label_status == PackageLabelStatus.DRAFT
        for row in open_allocation.planned_package_rows
    )
    assert all(
        link.tray.status == TrayStatus.COMPLETED
        for link in open_allocation.source_tray_links
    )

    completed_operation = next(
        operation
        for operation in operations
        if operation.status == PackagingOperationStatus.COMPLETED
    )
    assert len(completed_operation.allocations) == 1
    completed_allocation = completed_operation.allocations[0]
    source_weight = sum(
        link.tray.final_dry_weight_grams
        for link in completed_allocation.source_tray_links
    )
    packaged_weight = sum(
        package.finished_product_weight_grams
        for package in completed_allocation.packages
    )
    assert packaged_weight == source_weight
    assert completed_allocation.remaining_weight_grams == 0
    assert len(completed_allocation.source_tray_links) == 3
    assert len(completed_allocation.packages) == 3
    assert len(completed_allocation.planned_package_rows) == 3
    assert all(
        row.recorded_package_id is not None
        and row.label_status == PackageLabelStatus.READY
        for row in completed_allocation.planned_package_rows
    )

    packaged_trays = list(
        db_session.scalars(select(Tray).where(Tray.status == TrayStatus.PACKAGED))
    )
    assert packaged_trays
    assert all(tray.packaging_allocation_links for tray in packaged_trays)
    packages = list(db_session.scalars(select(Package)))
    assert len({package.package_identifier for package in packages}) == len(packages)
    assert all(package.label is not None for package in packages)
    assert all(
        package.status_history[0].previous_status is None
        and package.status_history[0].current_status == InventoryStatus.IN_STORAGE
        for package in packages
    )
    assert {package.storage_location.name for package in packages} >= {
        "Unassigned",
        "Basement Bin A",
    }
    assert db_session.scalar(
        select(func.count()).select_from(StorageLocationHistory)
    ) == db_session.scalar(select(func.count()).select_from(Package))
    assert db_session.scalar(
        select(func.count()).select_from(PackageStatusHistory)
    ) >= db_session.scalar(select(func.count()).select_from(Package))
    assert db_session.scalar(
        select(func.count()).select_from(PackageLabel)
    ) == db_session.scalar(select(func.count()).select_from(Package))
    assert set(db_session.scalars(select(PackageLabel.status))) == {
        PackageLabelStatus.READY
    }
    assert db_session.scalar(select(func.count()).select_from(PrintEvent)) == 1


def test_basic_demo_packaging_graphs_are_available_through_the_api(
    client: TestClient,
    db_session: Session,
) -> None:
    client.post("/dev/demo/basic")

    open_operation = db_session.scalar(
        select(PackagingOperation).where(
            PackagingOperation.status == PackagingOperationStatus.OPEN
        )
    )
    assert open_operation is not None
    open_response = client.get(
        f"/api/v1/production-batches/{open_operation.production_batch_id}"
        "/packaging-operation"
    )
    assert open_response.status_code == 200
    open_data = open_response.json()["data"]
    assert open_data["status"] == PackagingOperationStatus.OPEN.value
    assert len(open_data["allocations"]) == 1
    open_allocation = open_data["allocations"][0]
    assert len(open_allocation["source_trays"]) == 2
    assert len(open_allocation["planned_packages"]) == 2
    assert open_allocation["packages"] == []
    assert float(open_allocation["remaining_weight_grams"]) > 0
    assert all(
        row["recorded_package_id"] is None
        and row["label_status"] == PackageLabelStatus.DRAFT.value
        for row in open_allocation["planned_packages"]
    )

    completed_operation = db_session.scalar(
        select(PackagingOperation).where(
            PackagingOperation.status == PackagingOperationStatus.COMPLETED
        )
    )
    assert completed_operation is not None
    completed_response = client.get(
        f"/api/v1/packaging-operations/{completed_operation.id}"
    )
    assert completed_response.status_code == 200
    completed_data = completed_response.json()["data"]
    assert completed_data["status"] == PackagingOperationStatus.COMPLETED.value
    completed_allocation = completed_data["allocations"][0]
    assert len(completed_allocation["source_trays"]) == 3
    assert len(completed_allocation["planned_packages"]) == 3
    assert len(completed_allocation["packages"]) == 3
    assert all(
        row["recorded_package_id"] is not None
        for row in completed_allocation["planned_packages"]
    )

    printed_label = db_session.scalar(select(PackageLabel).join(PrintEvent).limit(1))
    assert printed_label is not None
    package_response = client.get(f"/api/v1/packages/{printed_label.package_id}")
    assert package_response.status_code == 200
    package_data = package_response.json()["data"]
    assert package_data["label"]["status"] == PackageLabelStatus.READY.value
    assert len(package_data["label"]["print_events"]) == 1


def test_basic_demo_replaces_existing_demo_data(
    client: TestClient,
    db_session: Session,
) -> None:
    first = client.post("/dev/demo/basic").json()["data"]["counts"]
    second = client.post("/dev/demo/basic").json()["data"]["counts"]

    assert second == first
    assert (
        db_session.scalar(
            select(func.count()).select_from(PackagingAllocationSourceTray)
        )
        == second["packaging_allocation_source_trays"]
    )
    assert (
        db_session.scalar(select(func.count()).select_from(PlannedPackageRow))
        == second["planned_package_rows"]
    )
    assert db_session.scalar(select(func.count()).select_from(PrintEvent)) == 1


def test_reset_removes_seeded_application_data(client: TestClient) -> None:
    client.post("/dev/demo/basic")

    response = client.post("/dev/reset")

    assert response.status_code == 200
    assert all(count == 0 for count in response.json()["data"]["counts"].values())


def test_random_batch_count_is_bounded_and_honored(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/dev/demo/random-batches", json={"count": 7})

    assert response.status_code == 200
    assert response.json()["data"]["counts"]["production_batches"] == 7

    physical_tray_ids = list(db_session.scalars(select(Tray.physical_tray_id)))
    assert len(physical_tray_ids) == len(set(physical_tray_ids))

    invalid = client.post("/dev/demo/random-batches", json={"count": 501})
    assert invalid.status_code == 422


def test_busy_day_does_not_reuse_trays_in_active_batches(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/dev/demo/busy-production-day")

    assert response.status_code == 200
    running_tray_ids = list(
        db_session.scalars(
            select(Tray.physical_tray_id)
            .join(ProductionBatch)
            .where(ProductionBatch.status == ProductionBatchStatus.RUNNING)
        )
    )
    assert len(running_tray_ids) == len(set(running_tray_ids))


def test_large_inventory_seeds_dozens_of_bins_and_hundreds_of_packages(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/dev/demo/large-inventory")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["action"] == "large-inventory"
    assert payload["counts"]["storage_locations"] >= 24
    assert payload["counts"]["packages"] >= 200

    packages = list(db_session.scalars(select(Package)))
    assert len({package.package_identifier for package in packages}) == len(packages)
    assert all(package.label is not None for package in packages)
    assert all(package.storage_location.name != "Unassigned" for package in packages)

    statuses = {package.status for package in packages}
    assert InventoryStatus.IN_STORAGE in statuses
    assert InventoryStatus.GIVEN_AWAY in statuses
    assert InventoryStatus.DEPLETED in statuses

    distinct_locations = {package.storage_location_id for package in packages}
    assert len(distinct_locations) > 10

    for package in packages:
        assert (
            package.status_history[0].previous_status is None
            and package.status_history[0].current_status == InventoryStatus.IN_STORAGE
        )
        if package.status != InventoryStatus.IN_STORAGE:
            assert len(package.status_history) == 2
            assert package.status_history[1].current_status == package.status
            assert (
                package.status_history[1].effective_at
                >= package.status_history[0].effective_at
            )

    search_response = client.get("/api/v1/inventory")
    assert search_response.status_code == 200
    assert len(search_response.json()["data"]) <= 100

    groups_response = client.get("/api/v1/inventory/products")
    assert groups_response.status_code == 200
    groups = groups_response.json()["data"]
    assert len(groups) == 4
    assert sum(group["available_package_count"] for group in groups) == sum(
        1 for package in packages if package.status == InventoryStatus.IN_STORAGE
    )


def test_developer_routes_are_not_registered_in_production() -> None:
    app = create_app(Settings(environment="production"))

    with TestClient(app) as client:
        response = client.post("/dev/demo/basic")

    assert response.status_code == 404

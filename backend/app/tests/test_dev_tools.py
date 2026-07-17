from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models import (
    InventoryStatus,
    Package,
    PackagingOperation,
    PackagingOperationTray,
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
        "packages",
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

    for operation in db_session.scalars(select(PackagingOperation)):
        linked_batches = {
            link.tray.production_batch_id for link in operation.tray_links
        }
        assert len(linked_batches) == 1
        source_weight = sum(
            link.tray.final_dry_weight_grams for link in operation.tray_links
        )
        packaged_weight = sum(
            package.finished_product_weight_grams for package in operation.packages
        )
        assert packaged_weight == source_weight

    packaged_trays = list(
        db_session.scalars(select(Tray).where(Tray.status == TrayStatus.PACKAGED))
    )
    assert packaged_trays
    assert all(tray.packaging_operation_link is not None for tray in packaged_trays)
    assert db_session.scalar(
        select(func.count()).select_from(StorageLocationHistory)
    ) == db_session.scalar(select(func.count()).select_from(Package))


def test_basic_demo_replaces_existing_demo_data(
    client: TestClient,
    db_session: Session,
) -> None:
    first = client.post("/dev/demo/basic").json()["data"]["counts"]
    second = client.post("/dev/demo/basic").json()["data"]["counts"]

    assert second == first
    assert (
        db_session.scalar(select(func.count()).select_from(PackagingOperationTray))
        == second["packaging_operation_trays"]
    )


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


def test_developer_routes_are_not_registered_in_production() -> None:
    app = create_app(Settings(environment="production"))

    with TestClient(app) as client:
        response = client.post("/dev/demo/basic")

    assert response.status_code == 404

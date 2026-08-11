from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Package,
    PackageLabel,
    PackageLabelStatus,
    PackageStatusHistory,
    PackagingLoss,
    PackagingOperation,
    PackagingOperationStatus,
    PrintEvent,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TrayStatus,
)


def _data(response) -> dict | list:
    return response.json()["data"]


def _assert_business_error(response, message: str) -> None:
    assert response.status_code == 400
    assert message in response.json()["detail"]["message"]


def _create_freeze_dryer(client: TestClient, name: str = "Freeze Dryer #1") -> dict:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": name, "tray_slot_count": 2},
    )
    assert response.status_code == 201
    return _data(response)


def _create_physical_tray(client: TestClient, label: str) -> dict:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return _data(response)


def _create_draft_batch(client: TestClient, batch_number: str) -> dict:
    freeze_dryer = _create_freeze_dryer(client, f"{batch_number} Dryer")
    response = client.post(
        "/api/v1/production-batches",
        json={
            "freeze_dryer_id": freeze_dryer["id"],
            "batch_number": batch_number,
        },
    )
    assert response.status_code == 201
    return _data(response)


def _create_completed_batch(
    client: TestClient,
    *,
    batch_number: str,
    product_name: str = "Taco Chicken",
) -> tuple[dict, list[dict]]:
    freeze_dryer = _create_freeze_dryer(client, f"{batch_number} Dryer")
    physical_trays = [
        _create_physical_tray(client, f"{batch_number} Tray 1"),
        _create_physical_tray(client, f"{batch_number} Tray 2"),
    ]
    batch_response = client.post(
        "/api/v1/production-batches",
        json={
            "freeze_dryer_id": freeze_dryer["id"],
            "batch_number": batch_number,
        },
    )
    assert batch_response.status_code == 201
    batch = _data(batch_response)
    trays: list[dict] = []
    for index, physical_tray in enumerate(physical_trays):
        tray_response = client.post(
            f"/api/v1/production-batches/{batch['id']}/trays",
            json={
                "tray_slot_id": freeze_dryer["tray_slots"][index]["id"],
                "physical_tray_id": physical_tray["id"],
                "product_name": product_name,
                "preparation": "Cubed and seasoned.",
                "starting_weight_grams": "907.000",
            },
        )
        assert tray_response.status_code == 201
        trays.append(_data(tray_response))

    start_response = client.post(f"/api/v1/production-batches/{batch['id']}/start")
    assert start_response.status_code == 200
    drying_run_id = _data(start_response)["drying_runs"][0]["id"]
    complete_run_response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/complete",
        json={},
    )
    assert complete_run_response.status_code == 200

    completed_trays: list[dict] = []
    for tray in trays:
        check_response = client.post(
            f"/api/v1/trays/{tray['id']}/weight-checks",
            json={
                "drying_run_id": drying_run_id,
                "weight_grams": "250.000",
                "observed_at": datetime.now(UTC).isoformat(),
            },
        )
        assert check_response.status_code == 201
        complete_tray_response = client.post(
            f"/api/v1/trays/{tray['id']}/complete",
            json={"final_dry_weight_grams": "250.000"},
        )
        assert complete_tray_response.status_code == 200
        completed_trays.append(_data(complete_tray_response))

    complete_batch_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/complete"
    )
    assert complete_batch_response.status_code == 200
    return _data(complete_batch_response), completed_trays


def _create_package_type(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/package-types",
        json={
            "name": "Quart Mylar",
            "default_oxygen_absorber": "500cc",
            "default_label_template": "standard",
        },
    )
    assert response.status_code == 201
    return _data(response)


def _start_operation(
    client: TestClient, batch_id: str, notes: str | None = None
) -> dict:
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/packaging-operation",
        json={"notes": notes},
    )
    assert response.status_code == 201
    return _data(response)


def _allocate(
    client: TestClient,
    operation_id: str,
    tray_ids: list[str],
    notes: str | None = None,
) -> dict:
    response = client.post(
        f"/api/v1/packaging-operations/{operation_id}/allocate-trays",
        json={"tray_ids": tray_ids, "notes": notes},
    )
    assert response.status_code == 201
    return _data(response)


def _record_packages(
    client: TestClient,
    operation_id: str,
    allocation_id: str,
    packages: list[dict],
) -> dict:
    response = client.post(
        f"/api/v1/packaging-operations/{operation_id}/allocations/"
        f"{allocation_id}/packages",
        json={"packages": packages},
    )
    assert response.status_code == 201
    return _data(response)


def _record_loss(
    client: TestClient,
    operation_id: str,
    allocation_id: str,
    body: dict,
) -> object:
    return client.post(
        f"/api/v1/packaging-operations/{operation_id}/allocations/"
        f"{allocation_id}/losses",
        json=body,
    )


def test_packaging_operation_starts_resumes_and_is_queryable(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch operation")

    missing_operation = client.get(
        f"/api/v1/production-batches/{batch['id']}/packaging-operation"
    )
    assert missing_operation.status_code == 404
    assert (
        missing_operation.json()["detail"]["message"]
        == "Production Batch has no Packaging Operation."
    )

    worksheet_response = client.get("/api/v1/packaging/worksheet")
    assert worksheet_response.status_code == 200
    worksheet = _data(worksheet_response)
    assert worksheet[0]["production_batch"]["id"] == batch["id"]
    assert [tray["id"] for tray in worksheet[0]["eligible_trays"]] == [
        tray["id"] for tray in trays
    ]

    operation = _start_operation(client, batch["id"], "Weekend packaging.")
    resumed = _start_operation(client, batch["id"], "Ignored on resume.")

    assert operation["id"] == resumed["id"]
    assert operation["status"] == PackagingOperationStatus.OPEN
    assert operation["notes"] == "Weekend packaging."
    assert operation["allocations"] == []

    by_batch = client.get(
        f"/api/v1/production-batches/{batch['id']}/packaging-operation"
    )
    by_id = client.get(f"/api/v1/packaging-operations/{operation['id']}")
    assert by_batch.status_code == 200
    assert by_id.status_code == 200
    assert _data(by_batch)["id"] == operation["id"]
    assert _data(by_id)["id"] == operation["id"]

    draft_batch = _create_draft_batch(client, "Draft packaging")
    ineligible_response = client.post(
        f"/api/v1/production-batches/{draft_batch['id']}/packaging-operation",
        json={},
    )
    _assert_business_error(ineligible_response, "Completed Production Batch")


def test_allocations_have_stable_identity_and_enforce_source_rules(
    client: TestClient,
) -> None:
    batch_a, trays_a = _create_completed_batch(client, batch_number="Batch A")
    batch_b, trays_b = _create_completed_batch(client, batch_number="Batch B")
    operation_a = _start_operation(client, batch_a["id"])
    _start_operation(client, batch_b["id"])

    allocation = _allocate(
        client,
        operation_a["id"],
        [tray["id"] for tray in trays_a],
        "Mix both chicken trays.",
    )
    fetched = client.get(f"/api/v1/packaging-operations/{operation_a['id']}")

    assert fetched.status_code == 200
    fetched_allocation = _data(fetched)["allocations"][0]
    assert fetched_allocation["id"] == allocation["id"]
    assert fetched_allocation["notes"] == "Mix both chicken trays."
    assert fetched_allocation["packages"] == []
    assert fetched_allocation["selected_weight_grams"] == 500.0

    duplicate_response = client.post(
        f"/api/v1/packaging-operations/{operation_a['id']}/allocate-trays",
        json={"tray_ids": [trays_a[0]["id"]]},
    )
    _assert_business_error(
        duplicate_response,
        "only belong to one Packaging Allocation",
    )

    cross_batch_response = client.post(
        f"/api/v1/packaging-operations/{operation_a['id']}/allocate-trays",
        json={"tray_ids": [trays_b[0]["id"]]},
    )
    _assert_business_error(cross_batch_response, "operation's Production Batch")


@pytest.mark.parametrize("status", [TrayStatus.RUNNING, TrayStatus.PACKAGED])
def test_allocation_rejects_non_completed_source_trays(
    client: TestClient,
    db_session: Session,
    status: TrayStatus,
) -> None:
    batch, trays = _create_completed_batch(
        client,
        batch_number=f"Batch source {status.value}",
    )
    tray = db_session.get(Tray, trays[0]["id"])
    assert tray is not None
    tray.status = status
    db_session.commit()
    operation = _start_operation(client, batch["id"])

    response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/allocate-trays",
        json={"tray_ids": [trays[0]["id"]]},
    )

    _assert_business_error(response, "Only Completed Trays")


def test_planned_package_rows_can_be_updated_and_recorded_once(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch planning")
    package_type = _create_package_type(client)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])
    allocation_url = (
        f"/api/v1/packaging-operations/{operation['id']}/allocations/"
        f"{allocation['id']}"
    )

    plan_response = client.patch(
        allocation_url,
        json={
            "notes": "Two bags planned.",
            "planned_packages": [
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "100.000",
                    "finished_product_weight_unit": "g",
                    "sealed_package_weight_grams": "105.000",
                    "sealed_package_weight_unit": "g",
                    "oxygen_absorber": "500cc",
                    "notes": "Small bag.",
                    "label_display_name": "Taco Chicken",
                },
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "150.000",
                    "finished_product_weight_unit": "g",
                    "sealed_package_weight_grams": "155.000",
                    "sealed_package_weight_unit": "g",
                    "oxygen_absorber": "750cc",
                    "label_display_name": "Family Taco Chicken",
                },
            ],
        },
    )
    assert plan_response.status_code == 200
    planned = _data(plan_response)["planned_packages"]
    assert len(planned) == 2
    assert planned[0]["notes"] == "Small bag."
    assert planned[1]["oxygen_absorber"] == "750cc"

    update_response = client.patch(
        allocation_url,
        json={
            "planned_packages": [
                {
                    "id": planned[0]["id"],
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "100.000",
                    "sealed_package_weight_grams": "106.000",
                    "label_display_name": "Updated Taco Chicken",
                },
                {
                    "id": planned[1]["id"],
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "150.000",
                    "sealed_package_weight_grams": "155.000",
                },
            ]
        },
    )
    assert update_response.status_code == 200
    updated = _data(update_response)["planned_packages"]
    assert updated[0]["sealed_package_weight_grams"] == 106.0
    assert updated[0]["label_display_name"] == "Updated Taco Chicken"

    recorded = _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [{"planned_package_row_id": planned[0]["id"]}],
    )
    recorded_package_id = recorded["packages"][0]["id"]
    recorded_plan = recorded["packaging_operation"]["allocations"][0][
        "planned_packages"
    ][0]
    assert recorded_plan["recorded_package_id"] == recorded_package_id

    reuse_response = client.post(
        f"{allocation_url}/packages",
        json={"packages": [{"planned_package_row_id": planned[0]["id"]}]},
    )
    _assert_business_error(reuse_response, "already been recorded")

    # Recorded rows are excluded from reconciliation entirely: including one
    # is a no-op for that row rather than an edit, and its sibling unrecorded
    # row still updates normally.
    included_response = client.patch(
        allocation_url,
        json={
            "planned_packages": [
                {
                    "id": planned[0]["id"],
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "90.000",
                    "sealed_package_weight_grams": "96.000",
                },
                {
                    "id": planned[1]["id"],
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "150.000",
                    "sealed_package_weight_grams": "155.000",
                    "notes": "Updated while the sibling row stayed recorded.",
                },
            ]
        },
    )
    assert included_response.status_code == 200
    included_plans = _data(included_response)["planned_packages"]
    still_recorded = next(
        row for row in included_plans if row["id"] == planned[0]["id"]
    )
    assert still_recorded["finished_product_weight_grams"] == 100.0
    assert still_recorded["recorded_package_id"] == recorded_package_id
    updated_sibling = next(
        row for row in included_plans if row["id"] == planned[1]["id"]
    )
    assert updated_sibling["notes"] == "Updated while the sibling row stayed recorded."

    # Omitting a recorded row's id must not delete it either.
    omitted_response = client.patch(
        allocation_url,
        json={
            "planned_packages": [
                {
                    "id": planned[1]["id"],
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "150.000",
                    "sealed_package_weight_grams": "155.000",
                },
            ]
        },
    )
    assert omitted_response.status_code == 200
    omitted_plans = _data(omitted_response)["planned_packages"]
    assert len(omitted_plans) == 2
    still_present = next(row for row in omitted_plans if row["id"] == planned[0]["id"])
    assert still_present["recorded_package_id"] == recorded_package_id


def test_bagged_weight_ignores_drafts_while_allocated_weight_reserves_them(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch physical")
    package_type = _create_package_type(client)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])
    allocation_url = (
        f"/api/v1/packaging-operations/{operation['id']}/allocations/"
        f"{allocation['id']}"
    )

    assert allocation["selected_weight_grams"] == 250.0
    assert allocation["bagged_weight_grams"] == 0.0
    assert allocation["remaining_to_bag_grams"] == 250.0

    draft_response = client.patch(
        allocation_url,
        json={
            "planned_packages": [
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "100.000",
                    "finished_product_weight_unit": "g",
                    "sealed_package_weight_grams": "105.000",
                    "sealed_package_weight_unit": "g",
                }
            ],
        },
    )
    assert draft_response.status_code == 200
    drafted = _data(draft_response)

    assert drafted["allocated_weight_grams"] == 100.0
    assert drafted["remaining_weight_grams"] == 150.0
    assert drafted["bagged_weight_grams"] == 0.0
    assert drafted["remaining_to_bag_grams"] == 250.0

    planned_row_id = drafted["planned_packages"][0]["id"]
    record_response = _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [{"planned_package_row_id": planned_row_id}],
    )
    recorded_allocation = record_response["packaging_operation"]["allocations"][0]

    assert recorded_allocation["allocated_weight_grams"] == 100.0
    assert recorded_allocation["remaining_weight_grams"] == 150.0
    assert recorded_allocation["bagged_weight_grams"] == 100.0
    assert recorded_allocation["remaining_to_bag_grams"] == 150.0


def test_recording_packages_is_traceable_atomic_and_keeps_operation_open(
    client: TestClient,
    db_session: Session,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch packages")
    package_type = _create_package_type(client)
    storage = StorageLocation(name="Basement Bin A", archived=False)
    db_session.add(storage)
    db_session.commit()
    db_session.refresh(storage)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(
        client,
        operation["id"],
        [tray["id"] for tray in trays],
    )

    result = _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "240.000",
                "sealed_package_weight_grams": "245.000",
                "packaged_at": "2026-07-04T09:00:00Z",
            },
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "260.000",
                "sealed_package_weight_grams": "265.000",
                "oxygen_absorber": "750cc",
                "storage_location_id": str(storage.id),
                "notes": "Gift size.",
                "label": {"display_name": "Family Taco Chicken"},
            },
        ],
    )

    packages = result["packages"]
    assert len(packages) == 2
    assert all(
        package["package_identifier"].startswith("PKG-2026-") for package in packages
    )
    assert packages[0]["oxygen_absorber"] == "500cc"
    assert packages[0]["storage_location"]["name"] == "Unassigned"
    assert packages[1]["oxygen_absorber"] == "750cc"
    assert packages[1]["storage_location"]["name"] == "Basement Bin A"
    assert packages[1]["label"]["display_name"] == "Family Taco Chicken"
    assert packages[0]["label"]["status"] == PackageLabelStatus.READY
    assert packages[0]["label"]["preparation_summary"] == "Cubed and seasoned."
    assert result["packaging_operation"]["status"] == PackagingOperationStatus.OPEN
    assert (
        result["packaging_operation"]["allocations"][0]["remaining_weight_grams"] == 0.0
    )

    assert db_session.query(Package).count() == 2
    assert db_session.query(PackageStatusHistory).count() == 2
    assert db_session.query(StorageLocationHistory).count() == 2
    assert db_session.query(PackageLabel).count() == 2
    assert {tray.status for tray in db_session.query(Tray).all()} == {
        TrayStatus.COMPLETED
    }

    rollback_batch, rollback_trays = _create_completed_batch(
        client,
        batch_number="Batch atomic rollback",
    )
    rollback_operation = _start_operation(client, rollback_batch["id"])
    rollback_allocation = _allocate(
        client,
        rollback_operation["id"],
        [tray["id"] for tray in rollback_trays],
    )
    counts_before = {
        Package: db_session.query(Package).count(),
        PackageStatusHistory: db_session.query(PackageStatusHistory).count(),
        StorageLocationHistory: db_session.query(StorageLocationHistory).count(),
        PackageLabel: db_session.query(PackageLabel).count(),
    }
    failed_response = client.post(
        f"/api/v1/packaging-operations/{rollback_operation['id']}/allocations/"
        f"{rollback_allocation['id']}/packages",
        json={
            "packages": [
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "200.000",
                    "sealed_package_weight_grams": "205.000",
                },
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "400.000",
                    "sealed_package_weight_grams": "405.000",
                },
            ]
        },
    )
    _assert_business_error(failed_response, "exceed")
    db_session.expire_all()
    for model, count in counts_before.items():
        assert db_session.query(model).count() == count
    rollback_operation_model = db_session.get(
        PackagingOperation,
        rollback_operation["id"],
    )
    assert rollback_operation_model is not None
    assert rollback_operation_model.status == PackagingOperationStatus.OPEN


def test_package_labels_can_be_edited_previewed_printed_and_reprinted(
    client: TestClient,
    db_session: Session,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch labels")
    package_type = _create_package_type(client)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])
    recorded = _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "125.000",
                "sealed_package_weight_grams": "130.000",
            },
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "125.000",
                "sealed_package_weight_grams": "130.000",
            },
        ],
    )
    packages = recorded["packages"]
    label_ids = [package["label"]["id"] for package in packages]

    get_response = client.get(f"/api/v1/packages/{packages[0]['id']}/label")
    assert get_response.status_code == 200
    assert _data(get_response)["package_id"] == packages[0]["id"]

    edit_response = client.patch(
        f"/api/v1/packages/{packages[0]['id']}/label",
        json={
            "display_name": "Martin's Taco Meal",
            "rehydration_instructions": "Add two cups of water.",
        },
    )
    assert edit_response.status_code == 200
    assert _data(edit_response)["status"] == PackageLabelStatus.READY
    assert _data(edit_response)["display_name"] == "Martin's Taco Meal"

    preview_response = client.post(
        "/api/v1/package-labels/preview",
        json={"package_label_ids": label_ids},
    )
    assert preview_response.status_code == 200
    assert [label["id"] for label in _data(preview_response)] == label_ids

    print_response = client.post(
        "/api/v1/package-labels/print",
        json={
            "package_label_ids": label_ids,
            "template": "Avery 5163",
            "notes": "First sheet.",
        },
    )
    assert print_response.status_code == 200
    print_data = _data(print_response)
    assert print_data["print_job_id"]
    assert all(len(label["print_events"]) == 1 for label in print_data["labels"])

    post_print_edit = client.patch(
        f"/api/v1/packages/{packages[0]['id']}/label",
        json={"net_weight_display": "4.4 oz freeze-dried"},
    )
    assert post_print_edit.status_code == 200
    assert _data(post_print_edit)["status"] == PackageLabelStatus.NEEDS_REPRINT

    reprint_response = client.post(
        "/api/v1/package-labels/print",
        json={"package_label_ids": [label_ids[0]], "notes": "Replacement."},
    )
    assert reprint_response.status_code == 200
    reprinted_label = _data(reprint_response)["labels"][0]
    assert reprinted_label["status"] == PackageLabelStatus.READY
    assert len(reprinted_label["print_events"]) == 2
    assert db_session.query(PrintEvent).count() == 3


def test_completion_reports_each_blocker_and_succeeds_explicitly(
    client: TestClient,
    db_session: Session,
) -> None:
    package_type = _create_package_type(client)

    no_allocation_batch, _ = _create_completed_batch(
        client,
        batch_number="Batch no allocation",
    )
    no_allocation_operation = _start_operation(client, no_allocation_batch["id"])
    response = client.post(
        f"/api/v1/packaging-operations/{no_allocation_operation['id']}/complete",
        json={},
    )
    _assert_business_error(response, "at least one Allocation")

    no_package_batch, no_package_trays = _create_completed_batch(
        client,
        batch_number="Batch no package",
    )
    no_package_operation = _start_operation(client, no_package_batch["id"])
    _allocate(client, no_package_operation["id"], [no_package_trays[0]["id"]])
    response = client.post(
        f"/api/v1/packaging-operations/{no_package_operation['id']}/complete",
        json={},
    )
    _assert_business_error(response, "requires at least one Package")

    planned_batch, planned_trays = _create_completed_batch(
        client,
        batch_number="Batch unrecorded plan",
    )
    planned_operation = _start_operation(client, planned_batch["id"])
    planned_allocation = _allocate(
        client,
        planned_operation["id"],
        [planned_trays[0]["id"]],
    )
    planned_response = client.patch(
        f"/api/v1/packaging-operations/{planned_operation['id']}/allocations/"
        f"{planned_allocation['id']}",
        json={
            "planned_packages": [
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "100.000",
                    "sealed_package_weight_grams": "105.000",
                },
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "150.000",
                    "sealed_package_weight_grams": "155.000",
                },
            ]
        },
    )
    assert planned_response.status_code == 200
    planned_rows = _data(planned_response)["planned_packages"]
    _record_packages(
        client,
        planned_operation["id"],
        planned_allocation["id"],
        [{"planned_package_row_id": planned_rows[0]["id"]}],
    )
    response = client.post(
        f"/api/v1/packaging-operations/{planned_operation['id']}/complete",
        json={},
    )
    _assert_business_error(response, "planned Package")

    remaining_batch, remaining_trays = _create_completed_batch(
        client,
        batch_number="Batch remaining",
    )
    remaining_operation = _start_operation(client, remaining_batch["id"])
    remaining_allocation = _allocate(
        client,
        remaining_operation["id"],
        [remaining_trays[0]["id"]],
    )
    _record_packages(
        client,
        remaining_operation["id"],
        remaining_allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "100.000",
                "sealed_package_weight_grams": "105.000",
            }
        ],
    )
    response = client.post(
        f"/api/v1/packaging-operations/{remaining_operation['id']}/complete",
        json={},
    )
    _assert_business_error(response, "All selected product")

    success_batch, success_trays = _create_completed_batch(
        client,
        batch_number="Batch complete packaging",
    )
    success_operation = _start_operation(client, success_batch["id"])
    success_allocation = _allocate(
        client,
        success_operation["id"],
        [tray["id"] for tray in success_trays],
    )
    success_recorded = _record_packages(
        client,
        success_operation["id"],
        success_allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "250.000",
                "sealed_package_weight_grams": "255.000",
            },
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "250.000",
                "sealed_package_weight_grams": "255.000",
            },
        ],
    )
    draft_label = db_session.get(
        PackageLabel,
        success_recorded["packages"][0]["label"]["id"],
    )
    assert draft_label is not None
    draft_label.status = PackageLabelStatus.DRAFT
    db_session.commit()
    response = client.post(
        f"/api/v1/packaging-operations/{success_operation['id']}/complete",
        json={},
    )
    _assert_business_error(response, "Package Label must be Ready")

    draft_label.status = PackageLabelStatus.READY
    db_session.commit()
    completed_at = datetime.now(UTC).isoformat()
    complete_response = client.post(
        f"/api/v1/packaging-operations/{success_operation['id']}/complete",
        json={"completed_at": completed_at},
    )
    assert complete_response.status_code == 200
    completed = _data(complete_response)
    assert completed["status"] == PackagingOperationStatus.COMPLETED
    returned_completed_at = datetime.fromisoformat(completed["completed_at"])
    if returned_completed_at.tzinfo is None:
        returned_completed_at = returned_completed_at.replace(tzinfo=UTC)
    assert returned_completed_at == datetime.fromisoformat(completed_at)

    db_session.expire_all()
    assert {db_session.get(Tray, tray["id"]).status for tray in success_trays} == {
        TrayStatus.PACKAGED
    }
    repeat_response = client.post(
        f"/api/v1/packaging-operations/{success_operation['id']}/complete",
        json={},
    )
    _assert_business_error(repeat_response, "Only an Open Packaging Operation")

    completed_label_edit = client.patch(
        f"/api/v1/packages/{success_recorded['packages'][0]['id']}/label",
        json={"display_name": "Changed after completion"},
    )
    _assert_business_error(
        completed_label_edit,
        "Completed Packaging Operations cannot be changed",
    )


def test_package_finished_weight_remains_structured_and_not_derived(
    client: TestClient,
    db_session: Session,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch structured")
    package_type = _create_package_type(client)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])
    result = _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "250.000",
                "sealed_package_weight_grams": "257.000",
            }
        ],
    )

    assert result["packages"][0]["finished_product_weight_grams"] == 250.0
    assert result["packages"][0]["package_weight_grams"] == 257.0
    stored = db_session.query(Package).one()
    assert stored.finished_product_weight_grams == Decimal("250.000")
    assert stored.package_weight_grams == Decimal("257.000")


def test_packaging_loss_reduces_remaining_and_appears_in_allocation_history(
    client: TestClient,
    db_session: Session,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch loss")
    package_type = _create_package_type(client)
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [tray["id"] for tray in trays])
    assert allocation["remaining_weight_grams"] == 500.0

    loss_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "6.000", "reason": "Crumbs"},
    )
    assert loss_response.status_code == 201
    after_loss = _data(loss_response)
    recorded_loss = after_loss["packaging_loss"]
    assert recorded_loss["weight_grams"] == 6.0
    assert recorded_loss["reason"] == "Crumbs"
    assert recorded_loss["reason_detail"] is None
    assert recorded_loss["recorded_at"] is not None
    after_loss_allocation = after_loss["packaging_operation"]["allocations"][0]
    assert after_loss_allocation["remaining_weight_grams"] == 494.0
    assert after_loss_allocation["total_recorded_loss_weight_grams"] == 6.0
    assert len(after_loss_allocation["packaging_losses"]) == 1

    other_loss_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {
            "weight_grams": "4.000",
            "reason": "Other",
            "reason_detail": "Dropped while sealing.",
        },
    )
    assert other_loss_response.status_code == 201
    after_other_loss_allocation = _data(other_loss_response)["packaging_operation"][
        "allocations"
    ][0]
    assert after_other_loss_allocation["remaining_weight_grams"] == 490.0
    assert len(after_other_loss_allocation["packaging_losses"]) == 2
    assert after_other_loss_allocation["packaging_losses"][1]["reason_detail"] == (
        "Dropped while sealing."
    )

    _record_packages(
        client,
        operation["id"],
        allocation["id"],
        [
            {
                "package_type_id": package_type["id"],
                "finished_product_weight_grams": "490.000",
                "sealed_package_weight_grams": "495.000",
            }
        ],
    )
    complete_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/complete",
        json={},
    )
    assert complete_response.status_code == 200

    db_session.expire_all()
    assert db_session.query(PackagingLoss).count() == 2


def test_packaging_loss_alone_unblocks_completion(client: TestClient) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch full loss")
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])

    loss_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "250.000", "reason": "Spilled"},
    )
    assert loss_response.status_code == 201
    assert (
        _data(loss_response)["packaging_operation"]["allocations"][0][
            "remaining_weight_grams"
        ]
        == 0.0
    )

    complete_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/complete",
        json={},
    )
    assert complete_response.status_code == 200
    assert _data(complete_response)["status"] == PackagingOperationStatus.COMPLETED


def test_packaging_loss_validation_rules(client: TestClient) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch loss rules")
    operation = _start_operation(client, batch["id"])
    allocation = _allocate(client, operation["id"], [trays[0]["id"]])

    no_work_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/complete",
        json={},
    )
    _assert_business_error(no_work_response, "requires at least one Package")

    zero_weight_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "0", "reason": "Sampled"},
    )
    assert zero_weight_response.status_code == 422

    detail_without_other_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {
            "weight_grams": "5.000",
            "reason": "Sampled",
            "reason_detail": "Should not be accepted.",
        },
    )
    _assert_business_error(
        detail_without_other_response,
        "only accepted when reason is Other",
    )

    exceeds_remaining_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "999.000", "reason": "Spilled"},
    )
    _assert_business_error(exceeds_remaining_response, "cannot exceed")

    ok_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "10.000", "reason": "Sampled"},
    )
    assert ok_response.status_code == 201

    other_batch, other_trays = _create_completed_batch(
        client,
        batch_number="Batch loss other operation",
    )
    other_operation = _start_operation(client, other_batch["id"])
    _allocate(client, other_operation["id"], [other_trays[0]["id"]])
    mismatched_response = _record_loss(
        client,
        other_operation["id"],
        allocation["id"],
        {"weight_grams": "1.000", "reason": "Sampled"},
    )
    _assert_business_error(
        mismatched_response,
        "Allocation does not belong to this Packaging Operation",
    )

    _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "240.000", "reason": "Crumbs"},
    )
    closing_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/complete",
        json={},
    )
    assert closing_response.status_code == 200

    reopened_response = _record_loss(
        client,
        operation["id"],
        allocation["id"],
        {"weight_grams": "1.000", "reason": "Sampled"},
    )
    _assert_business_error(
        reopened_response,
        "Completed Packaging Operations cannot be changed",
    )

    delete_response = client.delete(
        f"/api/v1/packaging-operations/{operation['id']}/allocations/"
        f"{allocation['id']}/losses"
    )
    assert delete_response.status_code == 405

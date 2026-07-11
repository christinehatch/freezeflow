from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Package, StorageLocationHistory, Tray, TrayStatus


def _create_freeze_dryer(client: TestClient, name: str = "Freeze Dryer #1") -> dict:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": name, "tray_slot_count": 2},
    )
    assert response.status_code == 201
    return response.json()["data"]


def _create_physical_tray(client: TestClient, label: str) -> dict:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return response.json()["data"]


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
    batch = batch_response.json()["data"]
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
        trays.append(tray_response.json()["data"])

    start_response = client.post(f"/api/v1/production-batches/{batch['id']}/start")
    assert start_response.status_code == 200
    drying_run_id = start_response.json()["data"]["drying_runs"][0]["id"]
    complete_run_response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/complete",
        json={"ended_at": "2026-07-03T12:00:00Z"},
    )
    assert complete_run_response.status_code == 200

    completed_trays: list[dict] = []
    for tray in trays:
        check_response = client.post(
            f"/api/v1/trays/{tray['id']}/weight-checks",
            json={
                "drying_run_id": drying_run_id,
                "weight_grams": "250.000",
                "observed_at": "2026-07-03T12:05:00Z",
            },
        )
        assert check_response.status_code == 201
        complete_tray_response = client.post(
            f"/api/v1/trays/{tray['id']}/complete",
            json={"final_dry_weight_grams": "250.000"},
        )
        assert complete_tray_response.status_code == 200
        completed_trays.append(complete_tray_response.json()["data"])

    complete_batch_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/complete"
    )
    assert complete_batch_response.status_code == 200
    return complete_batch_response.json()["data"], completed_trays


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
    return response.json()["data"]


def test_packaging_worksheet_lists_completed_unpackaged_trays(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch 001")

    response = client.get("/api/v1/packaging/worksheet")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data[0]["production_batch"]["id"] == batch["id"]
    assert [tray["id"] for tray in data[0]["eligible_trays"]] == [
        tray["id"] for tray in trays
    ]
    assert data[0]["source_weight_grams"] == 500.0


def test_packaging_session_creates_packages_labels_and_storage_history(
    client: TestClient,
    db_session: Session,
) -> None:
    _batch, trays = _create_completed_batch(client, batch_number="Batch 001")
    package_type = _create_package_type(client)

    response = client.post(
        "/api/v1/packages",
        json={
            "tray_ids": [tray["id"] for tray in trays],
            "packaged_at": "2026-07-04T09:00:00Z",
            "packages": [
                {
                    "package_type_id": package_type["id"],
                    "package_weight_grams": "245.000",
                },
                {
                    "package_type_id": package_type["id"],
                    "package_weight_grams": "245.000",
                    "oxygen_absorber": "750cc",
                    "notes": "Gift size.",
                },
            ],
        },
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert len(data["packages"]) == 2
    assert data["packages"][0]["package_identifier"].startswith("PKG-2026-")
    assert data["packages"][0]["oxygen_absorber"] == "500cc"
    assert data["packages"][1]["oxygen_absorber"] == "750cc"
    assert data["packages"][0]["storage_location"]["name"] == "Unassigned"
    assert data["warnings"]
    assert (
        data["labels"][0]["package_identifier"]
        == data["packages"][0]["package_identifier"]
    )

    stored_packages = db_session.query(Package).all()
    histories = db_session.query(StorageLocationHistory).all()
    stored_trays = db_session.query(Tray).all()
    assert len(stored_packages) == 2
    assert len(histories) == 2
    assert {tray.status for tray in stored_trays} == {TrayStatus.PACKAGED}


def test_packaging_rejects_cross_batch_selection(client: TestClient) -> None:
    _batch_1, trays_1 = _create_completed_batch(
        client,
        batch_number="Batch 001",
    )
    _batch_2, trays_2 = _create_completed_batch(
        client,
        batch_number="Batch 002",
        product_name="Apples",
    )
    package_type = _create_package_type(client)

    response = client.post(
        "/api/v1/packages",
        json={
            "tray_ids": [trays_1[0]["id"], trays_2[0]["id"]],
            "packages": [
                {
                    "package_type_id": package_type["id"],
                    "package_weight_grams": "500.000",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert "one Production Batch" in response.json()["detail"]["message"]


def test_packaging_rejects_already_packaged_tray(client: TestClient) -> None:
    _batch, trays = _create_completed_batch(client, batch_number="Batch 001")
    package_type = _create_package_type(client)
    package_payload = {
        "tray_ids": [trays[0]["id"]],
        "packages": [
            {
                "package_type_id": package_type["id"],
                "package_weight_grams": "250.000",
            }
        ],
    }
    first_response = client.post("/api/v1/packages", json=package_payload)
    assert first_response.status_code == 201

    second_response = client.post("/api/v1/packages", json=package_payload)

    assert second_response.status_code == 400
    assert "only be packaged once" in second_response.json()["detail"]["message"]

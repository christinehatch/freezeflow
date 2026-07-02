from fastapi.testclient import TestClient


def _create_freeze_dryer(client: TestClient, name: str = "Freeze Dryer #1") -> str:
    response = client.post("/api/v1/freeze-dryers", json={"name": name})
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _create_batch(client: TestClient, freeze_dryer_id: str) -> str:
    response = client.post(
        "/api/v1/production-batches",
        json={
            "freeze_dryer_id": freeze_dryer_id,
            "batch_number": "Batch 001",
            "notes": "Notebook-style setup note.",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_freeze_dryer_management_prevents_duplicate_names(client: TestClient) -> None:
    freeze_dryer_id = _create_freeze_dryer(client)

    duplicate_response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": "Freeze Dryer #1"},
    )

    assert duplicate_response.status_code == 400

    archive_response = client.patch(
        f"/api/v1/freeze-dryers/{freeze_dryer_id}",
        json={"archived": True},
    )

    assert archive_response.status_code == 200
    assert archive_response.json()["data"]["archived"] is True


def test_create_batch_add_tray_and_start_production(client: TestClient) -> None:
    freeze_dryer_id = _create_freeze_dryer(client)
    batch_id = _create_batch(client, freeze_dryer_id)

    tray_response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_number": 1,
            "product_name": "Chicken",
            "preparation": "Cubed and seasoned.",
            "notes": "same as above",
        },
    )
    assert tray_response.status_code == 201
    assert tray_response.json()["data"]["status"] == "Draft"

    start_response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert start_response.status_code == 200
    data = start_response.json()["data"]
    assert data["status"] == "Running"
    assert data["started_at"] is not None
    assert data["trays"][0]["status"] == "Running"


def test_start_production_requires_at_least_one_tray(client: TestClient) -> None:
    freeze_dryer_id = _create_freeze_dryer(client)
    batch_id = _create_batch(client, freeze_dryer_id)

    response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert response.status_code == 400
    assert "at least one Tray" in response.json()["detail"]["message"]


def test_tray_numbers_are_unique_within_batch(client: TestClient) -> None:
    freeze_dryer_id = _create_freeze_dryer(client)
    batch_id = _create_batch(client, freeze_dryer_id)
    tray_payload = {
        "tray_number": 1,
        "product_name": "Strawberries",
        "preparation": "Washed, hulled, sliced.",
    }

    first_response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json=tray_payload,
    )
    second_response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json=tray_payload,
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 400


def test_tray_setup_locks_after_start(client: TestClient) -> None:
    freeze_dryer_id = _create_freeze_dryer(client)
    batch_id = _create_batch(client, freeze_dryer_id)
    tray_response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_number": 1,
            "product_name": "Skittles",
            "preparation": "Single layer.",
        },
    )
    tray_id = tray_response.json()["data"]["id"]

    client.post(f"/api/v1/production-batches/{batch_id}/start")

    edit_response = client.patch(
        f"/api/v1/trays/{tray_id}",
        json={"notes": "late setup edit"},
    )
    delete_response = client.delete(f"/api/v1/trays/{tray_id}")

    assert edit_response.status_code == 400
    assert delete_response.status_code == 400

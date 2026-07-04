from fastapi.testclient import TestClient


def _create_freeze_dryer(
    client: TestClient,
    name: str = "Freeze Dryer #1",
    tray_slot_count: int = 4,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": name, "tray_slot_count": tray_slot_count},
    )
    assert response.status_code == 201
    return response.json()["data"]


def _create_physical_tray(client: TestClient, label: str) -> dict[str, object]:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return response.json()["data"]


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


def _add_tray(
    client: TestClient,
    batch_id: str,
    tray_slot_id: str,
    physical_tray_id: str,
    product_name: str = "Chicken",
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": tray_slot_id,
            "physical_tray_id": physical_tray_id,
            "product_name": product_name,
            "preparation": "Cubed and seasoned.",
            "notes": "same as above",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]


def _record_starting_weight(client: TestClient, tray_id: str) -> None:
    response = client.post(
        f"/api/v1/trays/{tray_id}/starting-weight",
        json={"starting_weight_grams": "907.000"},
    )
    assert response.status_code == 200


def test_freeze_dryer_management_configures_tray_slots(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client, tray_slot_count=3)

    assert freeze_dryer["tray_slot_count"] == 3
    assert [slot["slot_number"] for slot in freeze_dryer["tray_slots"]] == [1, 2, 3]

    duplicate_response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": "Freeze Dryer #1", "tray_slot_count": 4},
    )
    assert duplicate_response.status_code == 400

    archive_response = client.patch(
        f"/api/v1/freeze-dryers/{freeze_dryer['id']}",
        json={"archived": True},
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["data"]["archived"] is True


def test_physical_tray_setup(client: TestClient) -> None:
    response = client.post(
        "/api/v1/physical-trays",
        json={"label": "Tray 1", "tare_weight_grams": "68.039"},
    )
    assert response.status_code == 201
    physical_tray = response.json()["data"]
    assert physical_tray["label"] == "Tray 1"
    assert physical_tray["tare_weight_grams"] == 68.039

    duplicate_response = client.post("/api/v1/physical-trays", json={"label": "Tray 1"})
    assert duplicate_response.status_code == 400

    update_response = client.patch(
        f"/api/v1/physical-trays/{physical_tray['id']}",
        json={"tare_weight_grams": "70.000", "notes": "Sits slightly high."},
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["tare_weight_grams"] == 70.0
    assert update_response.json()["data"]["notes"] == "Sits slightly high."


def test_create_batch_select_trays_and_start_production(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))

    tray = _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray["id"]),
    )
    assert tray["status"] == "Draft"
    assert tray["tray_slot"]["slot_number"] == 1
    assert tray["physical_tray"]["label"] == "Tray 1"
    _record_starting_weight(client, str(tray["id"]))

    start_response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert start_response.status_code == 200
    data = start_response.json()["data"]
    assert data["status"] == "Running"
    assert data["started_at"] is not None
    assert data["trays"][0]["status"] == "Running"


def test_start_production_requires_at_least_one_tray(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    batch_id = _create_batch(client, str(freeze_dryer["id"]))

    response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert response.status_code == 400
    assert "at least one Tray" in response.json()["detail"]["message"]


def test_tray_slot_is_unique_within_batch(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray_1 = _create_physical_tray(client, "Tray 1")
    physical_tray_2 = _create_physical_tray(client, "Tray 2")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))
    tray_slot_id = str(freeze_dryer["tray_slots"][0]["id"])

    _add_tray(client, batch_id, tray_slot_id, str(physical_tray_1["id"]))
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": tray_slot_id,
            "physical_tray_id": physical_tray_2["id"],
            "product_name": "Strawberries",
            "preparation": "Washed, hulled, sliced.",
        },
    )

    assert response.status_code == 400
    assert "Tray Slot already selected" in response.json()["detail"]["message"]


def test_physical_tray_is_unique_within_batch(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))

    _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray["id"]),
    )
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][1]["id"],
            "physical_tray_id": physical_tray["id"],
            "product_name": "Blueberries",
            "preparation": "Halved.",
        },
    )

    assert response.status_code == 400
    assert "Physical Tray already selected" in response.json()["detail"]["message"]


def test_physical_tray_cannot_be_used_in_another_draft_batch(
    client: TestClient,
) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    first_batch_id = _create_batch(client, str(freeze_dryer["id"]))
    second_batch_id = _create_batch(client, str(freeze_dryer["id"]))

    _add_tray(
        client,
        first_batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray["id"]),
    )
    response = client.post(
        f"/api/v1/production-batches/{second_batch_id}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][1]["id"],
            "physical_tray_id": physical_tray["id"],
            "product_name": "Blueberries",
            "preparation": "Halved.",
        },
    )

    assert response.status_code == 400
    assert "Draft or Running Production Batch" in response.json()["detail"]["message"]


def test_selected_trays_cannot_exceed_freeze_dryer_slot_count(
    client: TestClient,
) -> None:
    freeze_dryer = _create_freeze_dryer(client, tray_slot_count=1)
    physical_tray_1 = _create_physical_tray(client, "Tray 1")
    physical_tray_2 = _create_physical_tray(client, "Tray 2")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))

    _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray_1["id"]),
    )
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
            "physical_tray_id": physical_tray_2["id"],
            "product_name": "Blueberries",
            "preparation": "Halved.",
        },
    )

    assert response.status_code == 400
    assert "Tray Slot count" in response.json()["detail"]["message"]


def test_tray_setup_locks_after_start(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))
    tray = _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray["id"]),
        "Skittles",
    )
    _record_starting_weight(client, str(tray["id"]))

    client.post(f"/api/v1/production-batches/{batch_id}/start")

    edit_response = client.patch(
        f"/api/v1/trays/{tray['id']}",
        json={"notes": "late setup edit"},
    )
    delete_response = client.delete(f"/api/v1/trays/{tray['id']}")

    assert edit_response.status_code == 400
    assert delete_response.status_code == 400

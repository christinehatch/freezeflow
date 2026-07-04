from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Tray


def _create_freeze_dryer(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": "Freeze Dryer #1", "tray_slot_count": 2},
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
        json={"freeze_dryer_id": freeze_dryer_id, "batch_number": "Batch 001"},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _add_tray(
    client: TestClient,
    batch_id: str,
    tray_slot_id: str,
    physical_tray_id: str,
    product_name: str,
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": tray_slot_id,
            "physical_tray_id": physical_tray_id,
            "product_name": product_name,
            "preparation": "Prepared for drying.",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]


def _record_starting_weight(client: TestClient, tray_id: str, weight: str) -> None:
    response = client.post(
        f"/api/v1/trays/{tray_id}/starting-weight",
        json={"starting_weight_grams": weight},
    )
    assert response.status_code == 200


def _setup_batch_with_two_trays(
    client: TestClient,
) -> tuple[str, list[dict[str, object]]]:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray_1 = _create_physical_tray(client, "Tray 1")
    physical_tray_2 = _create_physical_tray(client, "Tray 2")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))
    tray_1 = _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][0]["id"]),
        str(physical_tray_1["id"]),
        "Chicken",
    )
    tray_2 = _add_tray(
        client,
        batch_id,
        str(freeze_dryer["tray_slots"][1]["id"]),
        str(physical_tray_2["id"]),
        "Strawberries",
    )
    return batch_id, [tray_1, tray_2]


def test_start_production_requires_starting_weight(client: TestClient) -> None:
    batch_id, _trays = _setup_batch_with_two_trays(client)

    response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert response.status_code == 400
    assert "Starting Weight" in response.json()["detail"]["message"]


def test_tray_creation_can_include_starting_weight(client: TestClient) -> None:
    freeze_dryer = _create_freeze_dryer(client)
    physical_tray = _create_physical_tray(client, "Tray 1")
    batch_id = _create_batch(client, str(freeze_dryer["id"]))

    response = client.post(
        f"/api/v1/production-batches/{batch_id}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
            "physical_tray_id": physical_tray["id"],
            "product_name": "Chicken",
            "preparation": "Cubed.",
            "starting_weight_grams": "907.000",
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["starting_weight_grams"] == 907.0


def test_start_production_creates_first_drying_run(client: TestClient) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    _record_starting_weight(client, str(trays[0]["id"]), "907.000")
    _record_starting_weight(client, str(trays[1]["id"]), "454.000")

    response = client.post(f"/api/v1/production-batches/{batch_id}/start")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "Running"
    assert data["drying_runs"][0]["status"] == "Active"
    assert data["drying_runs"][0]["started_at"] is not None


def test_missing_running_starting_weight_can_be_backfilled(
    client: TestClient,
    db_session: Session,
) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    client.post(f"/api/v1/production-batches/{batch_id}/start")
    tray_model = db_session.get(Tray, UUID(str(trays[0]["id"])))
    assert tray_model is not None
    tray_model.starting_weight_grams = None
    db_session.add(tray_model)
    db_session.commit()

    response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/starting-weight",
        json={"starting_weight_grams": "905.000"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["starting_weight_grams"] == 905.0


def test_current_run_complete_and_weight_checks(client: TestClient) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(f"/api/v1/production-batches/{batch_id}/start").json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]

    complete_response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/complete",
        json={"ended_at": "2026-07-03T12:00:00Z"},
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["data"]["status"] == "Complete"
    assert complete_response.json()["data"]["ended_at"] is not None

    check_response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "250.000",
            "observed_at": "2026-07-03T12:05:00Z",
            "notes": "Feels close.",
        },
    )
    assert check_response.status_code == 201
    assert check_response.json()["data"]["drying_run_id"] == drying_run_id

    duplicate_response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "249.000",
            "observed_at": "2026-07-03T12:06:00Z",
        },
    )
    assert duplicate_response.status_code == 400


def test_another_drying_run_requires_running_tray_weight_checks(
    client: TestClient,
) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(f"/api/v1/production-batches/{batch_id}/start").json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})
    client.post(
        f"/api/v1/trays/{trays[0]['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "250.000",
            "observed_at": "2026-07-03T12:05:00Z",
        },
    )

    response = client.post(
        f"/api/v1/production-batches/{batch_id}/drying-runs",
        json={},
    )

    assert response.status_code == 400
    assert "Every Running Tray" in response.json()["detail"]["message"]


def test_tray_completion_requires_latest_weight_check(client: TestClient) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(f"/api/v1/production-batches/{batch_id}/start").json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})

    response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/complete",
        json={"final_dry_weight_grams": "250.000"},
    )

    assert response.status_code == 400
    assert "Weight Check" in response.json()["detail"]["message"]


def test_completed_trays_are_excluded_from_later_weight_requirements(
    client: TestClient,
) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(f"/api/v1/production-batches/{batch_id}/start").json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})
    client.post(
        f"/api/v1/trays/{trays[0]['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "250.000",
            "observed_at": "2026-07-03T12:05:00Z",
        },
    )
    client.post(
        f"/api/v1/trays/{trays[0]['id']}/complete",
        json={"final_dry_weight_grams": "250.000"},
    )
    client.post(
        f"/api/v1/trays/{trays[1]['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "260.000",
            "observed_at": "2026-07-03T12:06:00Z",
        },
    )

    response = client.post(
        f"/api/v1/production-batches/{batch_id}/drying-runs",
        json={},
    )

    assert response.status_code == 201
    assert response.json()["data"]["status"] == "Active"


def test_complete_batch_requires_all_trays_complete(client: TestClient) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(f"/api/v1/production-batches/{batch_id}/start").json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})
    for tray in trays:
        client.post(
            f"/api/v1/trays/{tray['id']}/weight-checks",
            json={
                "drying_run_id": drying_run_id,
                "weight_grams": "250.000",
                "observed_at": "2026-07-03T12:05:00Z",
            },
        )

    early_response = client.post(f"/api/v1/production-batches/{batch_id}/complete")
    assert early_response.status_code == 400

    for tray in trays:
        complete_tray_response = client.post(
            f"/api/v1/trays/{tray['id']}/complete",
            json={"final_dry_weight_grams": "250.000"},
        )
        assert complete_tray_response.status_code == 200

    complete_response = client.post(f"/api/v1/production-batches/{batch_id}/complete")

    assert complete_response.status_code == 200
    assert complete_response.json()["data"]["status"] == "Completed"


def test_voided_drying_runs_are_preserved_and_excluded_from_total_time(
    client: TestClient,
) -> None:
    batch_id, trays = _setup_batch_with_two_trays(client)
    for tray in trays:
        _record_starting_weight(client, str(tray["id"]), "907.000")
    batch = client.post(
        f"/api/v1/production-batches/{batch_id}/start",
        json={"started_at": "2026-07-03T08:00:00Z"},
    ).json()["data"]
    drying_run_id = batch["drying_runs"][0]["id"]

    response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/void",
        json={"notes": "Started timer by mistake."},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "Voided"
    batch_response = client.get(f"/api/v1/production-batches/{batch_id}")
    data = batch_response.json()["data"]
    assert data["drying_runs"][0]["status"] == "Voided"
    assert data["total_drying_seconds"] == 0

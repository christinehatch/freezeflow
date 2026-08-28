from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AuditEntry, Tray, TrayStatus


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
                "ingredients": ["Chicken", "Taco seasoning"],
                "preparation_methods": ["Cubed and seasoned."],
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


def _package_a_completed_batch(client: TestClient, batch_number: str) -> dict:
    batch, trays = _create_completed_batch(client, batch_number=batch_number)
    package_type = _create_package_type(client)
    operation_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/packaging-operation",
        json={},
    )
    assert operation_response.status_code == 201
    operation = _data(operation_response)
    allocate_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/allocate-trays",
        json={"tray_ids": [tray["id"] for tray in trays]},
    )
    assert allocate_response.status_code == 201
    allocation = _data(allocate_response)
    record_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/allocations/"
        f"{allocation['id']}/packages",
        json={
            "packages": [
                {
                    "package_type_id": package_type["id"],
                    "finished_product_weight_grams": "500.000",
                    "sealed_package_weight_grams": "505.000",
                    "packaged_at": "2026-07-04T09:00:00Z",
                }
            ]
        },
    )
    assert record_response.status_code == 201
    return _data(record_response)["packages"][0]


def _audit_entries(
    db_session: Session, entity_type: str, entity_id: str
) -> list[AuditEntry]:
    return list(
        db_session.query(AuditEntry)
        .filter(
            AuditEntry.entity_type == entity_type,
            AuditEntry.entity_id == UUID(entity_id),
        )
        .order_by(AuditEntry.corrected_at)
        .all()
    )


def test_correct_tray_notes_updates_canonical_value_and_records_audit(
    client: TestClient, db_session: Session
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch notes")
    tray_id = trays[0]["id"]

    response = client.post(
        f"/api/v1/trays/{tray_id}/correct-notes",
        json={"notes": "Corrected: scale was off.", "reason": "Operator error."},
    )

    assert response.status_code == 200
    assert _data(response)["notes"] == "Corrected: scale was off."
    entries = _audit_entries(db_session, "Tray", tray_id)
    assert len(entries) == 1
    assert entries[0].field_name == "notes"
    assert entries[0].current_value == "Corrected: scale was off."
    assert entries[0].reason == "Operator error."

    # Corrections never reverse lifecycle state (CR-004).
    tray = db_session.get(Tray, UUID(tray_id))
    assert tray is not None
    assert tray.status == TrayStatus.COMPLETED


def test_correct_tray_notes_rejects_whitespace_only_change(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch ws notes")
    tray_id = trays[0]["id"]
    client.post(
        f"/api/v1/trays/{tray_id}/correct-notes",
        json={"notes": "Same text.", "reason": None},
    )

    response = client.post(
        f"/api/v1/trays/{tray_id}/correct-notes",
        json={"notes": "  Same text.  ", "reason": None},
    )

    _assert_business_error(response, "must differ from the current notes")


def test_correct_tray_preparation_metadata_only_writes_changed_fields(
    client: TestClient, db_session: Session
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch prep")
    tray_id = trays[0]["id"]

    response = client.post(
        f"/api/v1/trays/{tray_id}/correct-preparation",
        json={
            "ingredients": ["Chicken", "Taco seasoning", "Lime"],
            "reason": "Forgot the lime.",
        },
    )

    assert response.status_code == 200
    assert _data(response)["ingredients"] == ["Chicken", "Taco seasoning", "Lime"]
    entries = _audit_entries(db_session, "Tray", tray_id)
    assert len(entries) == 1
    assert entries[0].field_name == "ingredients"


def test_correct_tray_preparation_metadata_rejects_blank_product_name(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch blank")
    response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/correct-preparation",
        json={"product_name": "   ", "reason": None},
    )

    _assert_business_error(response, "Product name is required.")


def test_correct_tray_preparation_metadata_rejects_no_change(
    client: TestClient,
) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch no change")
    response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/correct-preparation",
        json={"product_name": trays[0]["product_name"], "reason": None},
    )

    _assert_business_error(
        response, "At least one Preparation Metadata field must differ"
    )


def test_correct_tray_starting_weight(client: TestClient, db_session: Session) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch start weight")
    tray_id = trays[0]["id"]

    response = client.post(
        f"/api/v1/trays/{tray_id}/correct-starting-weight",
        json={"starting_weight_grams": "905.000", "reason": "Scale misread."},
    )

    assert response.status_code == 200
    assert _data(response)["starting_weight_grams"] == 905.0
    entries = _audit_entries(db_session, "Tray", tray_id)
    assert entries[0].field_name == "startingWeightGrams"
    assert entries[0].previous_value == "907.000"
    assert entries[0].current_value == "905.000"


def test_correct_tray_starting_weight_rejects_non_positive(
    client: TestClient,
) -> None:
    # Milestone 9 moved this validation to the schema layer (Field(gt=0)),
    # so a non-positive weight is now a 422, not a BusinessRuleError.
    batch, trays = _create_completed_batch(client, batch_number="Batch neg weight")
    response = client.post(
        f"/api/v1/trays/{trays[0]['id']}/correct-starting-weight",
        json={"starting_weight_grams": "0.000", "reason": None},
    )

    assert response.status_code == 422


def test_correct_tray_final_dry_weight(client: TestClient, db_session: Session) -> None:
    batch, trays = _create_completed_batch(client, batch_number="Batch dry weight")
    tray_id = trays[0]["id"]

    response = client.post(
        f"/api/v1/trays/{tray_id}/correct-final-dry-weight",
        json={"final_dry_weight_grams": "245.000", "reason": None},
    )

    assert response.status_code == 200
    assert _data(response)["final_dry_weight_grams"] == 245.0
    entries = _audit_entries(db_session, "Tray", tray_id)
    assert entries[0].field_name == "finalDryWeightGrams"


def test_correct_production_batch_notes(
    client: TestClient, db_session: Session
) -> None:
    batch, _trays = _create_completed_batch(client, batch_number="Batch pb notes")

    response = client.post(
        f"/api/v1/production-batches/{batch['id']}/correct-notes",
        json={"notes": "Corrected batch note.", "reason": None},
    )

    assert response.status_code == 200
    assert _data(response)["notes"] == "Corrected batch note."
    entries = _audit_entries(db_session, "ProductionBatch", batch["id"])
    assert len(entries) == 1
    assert entries[0].field_name == "notes"


def test_correct_production_batch_notes_rejects_no_change(
    client: TestClient,
) -> None:
    batch, _trays = _create_completed_batch(client, batch_number="Batch same notes")
    response = client.post(
        f"/api/v1/production-batches/{batch['id']}/correct-notes",
        json={"notes": "", "reason": None},
    )

    _assert_business_error(response, "must differ from the current notes")


def test_correct_drying_run_timestamps_writes_only_changed_field(
    client: TestClient, db_session: Session
) -> None:
    batch, _trays = _create_completed_batch(client, batch_number="Batch drying")
    drying_run_id = batch["drying_runs"][0]["id"]

    response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/correct-timestamps",
        json={"started_at": "2026-07-03T07:55:00Z", "reason": "Clock was off."},
    )

    assert response.status_code == 200
    assert _data(response)["started_at"] is not None
    entries = _audit_entries(db_session, "DryingRun", drying_run_id)
    assert len(entries) == 1
    assert entries[0].field_name == "startedAt"


def test_correct_drying_run_timestamps_rejects_started_after_ended(
    client: TestClient,
) -> None:
    batch, _trays = _create_completed_batch(client, batch_number="Batch bad order")
    drying_run_id = batch["drying_runs"][0]["id"]

    response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/correct-timestamps",
        json={"started_at": "2099-01-01T00:00:00Z", "reason": None},
    )

    _assert_business_error(response, "startedAt must be before endedAt")


def test_correct_drying_run_timestamps_requires_a_field(
    client: TestClient,
) -> None:
    batch, _trays = _create_completed_batch(client, batch_number="Batch empty")
    drying_run_id = batch["drying_runs"][0]["id"]

    response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/correct-timestamps",
        json={},
    )

    _assert_business_error(response, "At least one of startedAt or endedAt")


def test_correct_package_weight(client: TestClient, db_session: Session) -> None:
    package = _package_a_completed_batch(client, "Batch pkg weight")

    response = client.post(
        f"/api/v1/packages/{package['id']}/correct-weight",
        json={"package_weight_grams": "500.000", "reason": "Reweighed."},
    )

    assert response.status_code == 200
    assert _data(response)["package_weight_grams"] == 500.0
    entries = _audit_entries(db_session, "Package", package["id"])
    assert entries[0].field_name == "packageWeightGrams"
    assert entries[0].previous_value == "505.000"


def test_correct_package_weight_rejects_non_positive_at_schema_level(
    client: TestClient,
) -> None:
    package = _package_a_completed_batch(client, "Batch pkg neg")

    response = client.post(
        f"/api/v1/packages/{package['id']}/correct-weight",
        json={"package_weight_grams": "0", "reason": None},
    )

    assert response.status_code == 422


def test_correct_package_notes(client: TestClient, db_session: Session) -> None:
    package = _package_a_completed_batch(client, "Batch pkg notes")

    response = client.post(
        f"/api/v1/packages/{package['id']}/correct-notes",
        json={"notes": "Gift for neighbor.", "reason": None},
    )

    assert response.status_code == 200
    assert _data(response)["notes"] == "Gift for neighbor."
    entries = _audit_entries(db_session, "Package", package["id"])
    assert entries[0].field_name == "notes"


def test_correct_package_label_after_operation_completes_records_audit(
    client: TestClient, db_session: Session
) -> None:
    package = _package_a_completed_batch(client, "Batch label")
    operation_id = package["packaging_operation_id"]
    complete_response = client.post(
        f"/api/v1/packaging-operations/{operation_id}/complete", json={}
    )
    assert complete_response.status_code == 200

    response = client.patch(
        f"/api/v1/packages/{package['id']}/label",
        json={"display_name": "Corrected Label Name"},
    )

    assert response.status_code == 200
    assert _data(response)["display_name"] == "Corrected Label Name"
    label_id = _data(response)["id"]
    entries = _audit_entries(db_session, "PackageLabel", label_id)
    assert len(entries) == 1
    assert entries[0].field_name == "displayName"


def test_list_audit_entries_scopes_by_entity_type_and_id(
    client: TestClient,
) -> None:
    batch_a, trays_a = _create_completed_batch(client, batch_number="Batch scope a")
    batch_b, trays_b = _create_completed_batch(client, batch_number="Batch scope b")
    client.post(
        f"/api/v1/trays/{trays_a[0]['id']}/correct-notes",
        json={"notes": "Note A", "reason": None},
    )
    client.post(
        f"/api/v1/trays/{trays_b[0]['id']}/correct-notes",
        json={"notes": "Note B", "reason": None},
    )

    response = client.get(
        "/api/v1/audit-entries",
        params={"entity_type": "Tray", "entity_id": trays_a[0]["id"]},
    )

    assert response.status_code == 200
    entries = _data(response)
    assert len(entries) == 1
    assert entries[0]["current_value"] == "Note A"
    assert entries[0]["entity_id"] == trays_a[0]["id"]

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DryingRun, ProductionBatch, Tray


def _data(response) -> dict | list:
    return response.json()["data"]


def _create_freeze_dryer(client: TestClient, name: str) -> dict:
    response = client.post(
        "/api/v1/freeze-dryers", json={"name": name, "tray_slot_count": 4}
    )
    assert response.status_code == 201
    return _data(response)


def _create_physical_tray(client: TestClient, label: str) -> dict:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return _data(response)


def _create_preparation_preset(
    client: TestClient, name: str, product_name: str
) -> dict:
    response = client.post(
        "/api/v1/preparation-presets",
        json={
            "name": name,
            "product_name": product_name,
            "ingredients": [],
            "preparation_methods": [],
        },
    )
    assert response.status_code == 201
    return _data(response)


def _complete_batch(
    client: TestClient,
    db_session: Session,
    *,
    freeze_dryer: dict,
    batch_number: str,
    trays: list[dict],
    completed_at: datetime,
    drying_hours: float = 12,
) -> dict:
    """Create a Production Batch, dry it, complete every Tray, and complete
    the Batch - with fully controlled weights/durations/dates so aggregate
    results can be hand-computed exactly.

    Each entry in `trays` is a dict with: physical_tray_id, product_name,
    starting_weight, final_weight, and optionally preparation_preset_id.
    """
    batch = _data(
        client.post(
            "/api/v1/production-batches",
            json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": batch_number},
        )
    )
    tray_ids = []
    for index, spec in enumerate(trays):
        payload = {
            "tray_slot_id": freeze_dryer["tray_slots"][index]["id"],
            "physical_tray_id": spec["physical_tray_id"],
            "product_name": spec["product_name"],
            "ingredients": ["placeholder"],
            "starting_weight_grams": str(spec["starting_weight"]),
        }
        if spec.get("preparation_preset_id"):
            payload["preparation_preset_id"] = spec["preparation_preset_id"]
        tray = _data(
            client.post(f"/api/v1/production-batches/{batch['id']}/trays", json=payload)
        )
        tray_ids.append(tray["id"])

    client.post(f"/api/v1/production-batches/{batch['id']}/start")
    started_batch = _data(client.get(f"/api/v1/production-batches/{batch['id']}"))
    drying_run_id = started_batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})

    # The /complete endpoints stamp real "now" timestamps; overwrite them
    # with controlled values afterward so durations are exact and known.
    end = completed_at - timedelta(hours=1)
    start = end - timedelta(hours=drying_hours)
    drying_run = db_session.get(DryingRun, drying_run_id)
    drying_run.started_at = start
    drying_run.ended_at = end
    db_session.commit()

    for tray_id, spec in zip(tray_ids, trays, strict=True):
        client.post(
            f"/api/v1/trays/{tray_id}/weight-checks",
            json={
                "drying_run_id": drying_run_id,
                "weight_grams": str(spec["final_weight"]),
                "observed_at": completed_at.isoformat(),
            },
        )
        client.post(
            f"/api/v1/trays/{tray_id}/complete",
            json={"final_dry_weight_grams": str(spec["final_weight"])},
        )
    client.post(f"/api/v1/production-batches/{batch['id']}/complete")

    production_batch = db_session.get(ProductionBatch, batch["id"])
    production_batch.started_at = start - timedelta(hours=1)
    production_batch.completed_at = completed_at
    db_session.commit()
    for tray_id in tray_ids:
        tray = db_session.get(Tray, tray_id)
        tray.completed_at = completed_at
    db_session.commit()

    return {
        "batch_id": batch["id"],
        "tray_ids": tray_ids,
        "drying_run_id": drying_run_id,
    }


def test_freeze_dryer_performance_computes_exact_aggregates(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=10,
    )
    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 002",
        trays=[
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            }
        ],
        completed_at=datetime(2026, 1, 3, tzinfo=UTC),
        drying_hours=14,
    )

    response = client.get("/api/v1/reports/freeze-dryer-performance")
    assert response.status_code == 200
    rows = _data(response)
    assert len(rows) == 1
    row = rows[0]
    assert row["freeze_dryer_name"] == "Black"
    assert row["completed_production_batch_count"] == 2
    assert row["average_dry_time_seconds"] == pytest.approx(
        12 * 3600, abs=1
    )  # (10h + 14h) / 2
    # weight loss: 1000->250 = 75%, 500->100 = 80%; average = 77.5%
    assert row["average_weight_loss_percent"] == "77.5"
    assert row["average_time_to_completion_seconds"] is not None


def test_product_history_computes_exact_aggregates(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    response = client.get("/api/v1/reports/product-history")
    assert response.status_code == 200
    rows = {row["product_name"]: row for row in _data(response)}
    assert rows["Chicken"]["times_produced"] == 1
    assert rows["Chicken"]["average_yield_percent"] == "25.0"
    assert rows["Chicken"]["average_drying_time_seconds"] == pytest.approx(
        12 * 3600, abs=1
    )
    assert rows["Chicken"]["last_batch_completed_at"].startswith("2026-01-02")


def test_preparation_history_buckets_trays_with_no_preset_separately(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")
    preset = _create_preparation_preset(client, "Sliced Chicken", "Chicken")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
                "preparation_preset_id": preset["id"],
            },
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            },
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    response = client.get("/api/v1/reports/preparation-history")
    assert response.status_code == 200
    rows = {row["preparation_preset_name"]: row for row in _data(response)}
    assert set(rows) == {"Sliced Chicken", "No Preset"}
    assert rows["Sliced Chicken"]["used_preset"] is True
    assert rows["Sliced Chicken"]["times_used"] == 1
    assert rows["No Preset"]["used_preset"] is False
    assert rows["No Preset"]["times_used"] == 1


def test_drying_time_lists_one_row_per_completed_batch(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")

    result = _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    response = client.get("/api/v1/reports/drying-time")
    assert response.status_code == 200
    rows = _data(response)
    assert len(rows) == 1
    assert rows[0]["production_batch_id"] == result["batch_id"]
    assert rows[0]["total_drying_time_seconds"] == pytest.approx(12 * 3600, abs=1)
    assert rows[0]["drying_run_count"] == 1
    assert rows[0]["voided_drying_run_count"] == 0


def test_production_history_reports_full_batch_content_and_narrows_by_product(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            },
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            },
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    response = client.get("/api/v1/reports/production-history")
    assert response.status_code == 200
    rows = _data(response)
    assert len(rows) == 1
    assert rows[0]["tray_count"] == 2
    assert set(rows[0]["products"]) == {"Chicken", "Apples"}

    # Filtering by Product narrows which Batches appear, but the row still
    # reports everything the Batch contained (not just the matching Tray).
    filtered = _data(
        client.get(
            "/api/v1/reports/production-history", params={"product_name": "Apples"}
        )
    )
    assert len(filtered) == 1
    assert filtered[0]["tray_count"] == 2
    assert set(filtered[0]["products"]) == {"Chicken", "Apples"}

    no_match = _data(
        client.get(
            "/api/v1/reports/production-history",
            params={"product_name": "Strawberries"},
        )
    )
    assert no_match == []


def test_inventory_summary_computes_status_counts_and_weight_totals(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")

    result = _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    op = _data(
        client.post(
            f"/api/v1/production-batches/{result['batch_id']}/packaging-operation",
            json={},
        )
    )
    allocation = _data(
        client.post(
            f"/api/v1/packaging-operations/{op['id']}/allocate-trays",
            json={"tray_ids": result["tray_ids"]},
        )
    )
    package_type = _data(
        client.post(
            "/api/v1/package-types",
            json={"name": "Quart Mylar", "default_oxygen_absorber": "500cc"},
        )
    )
    record = _data(
        client.post(
            f"/api/v1/packaging-operations/{op['id']}/allocations/{allocation['id']}/packages",
            json={
                "packages": [
                    {
                        "package_type_id": package_type["id"],
                        "finished_product_weight_grams": "240.000",
                        "sealed_package_weight_grams": "245.000",
                    }
                ]
            },
        )
    )
    package_id = record["packages"][0]["id"]
    client.post(f"/api/v1/packages/{package_id}/give-away", json={})

    response = client.get("/api/v1/reports/inventory-summary")
    assert response.status_code == 200
    summary = _data(response)
    assert summary["packages_in_storage"] == 0
    assert summary["packages_given_away"] == 1
    assert summary["packages_depleted"] == 0
    assert summary["total_packaged_weight_grams"] == "240.000"
    assert summary["total_dried_weight_grams"] == "250.000"
    assert summary["most_common_products"] == [
        {"product_name": "Chicken", "package_count": 1}
    ]


def test_still_running_tray_is_excluded_from_every_report(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    batch = _data(
        client.post(
            "/api/v1/production-batches",
            json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "Batch 001"},
        )
    )
    client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
            "physical_tray_id": pt1["id"],
            "product_name": "Chicken",
            "ingredients": ["placeholder"],
            "starting_weight_grams": "1000.000",
        },
    )
    client.post(f"/api/v1/production-batches/{batch['id']}/start")
    # Never completed - stays Running.

    assert _data(client.get("/api/v1/reports/product-history")) == []
    assert _data(client.get("/api/v1/reports/preparation-history")) == []
    assert _data(client.get("/api/v1/reports/freeze-dryer-performance")) == []
    assert _data(client.get("/api/v1/reports/drying-time")) == []
    assert _data(client.get("/api/v1/reports/production-history")) == []


def test_draft_and_cancelled_batches_are_excluded(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "Draft Batch"},
    )
    cancel_target = _data(
        client.post(
            "/api/v1/production-batches",
            json={
                "freeze_dryer_id": freeze_dryer["id"],
                "batch_number": "Cancel Batch",
            },
        )
    )
    client.post(f"/api/v1/production-batches/{cancel_target['id']}/cancel")

    assert _data(client.get("/api/v1/reports/freeze-dryer-performance")) == []
    assert _data(client.get("/api/v1/reports/drying-time")) == []
    assert _data(client.get("/api/v1/reports/production-history")) == []


def test_yield_excludes_trays_with_zero_or_null_starting_weight(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    # Tray 1 has a real starting weight; Tray 2's is forced to zero after
    # creation to exercise the exclude-don't-corrupt rule (the API itself
    # would reject a submitted zero, so this simulates a data edge case
    # directly at the persistence layer).
    result_a = _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )
    result_b = _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 002",
        trays=[
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Chicken",
                "starting_weight": 1,
                "final_weight": 1,
            }
        ],
        completed_at=datetime(2026, 1, 3, tzinfo=UTC),
        drying_hours=12,
    )
    tray_b = db_session.get(Tray, result_b["tray_ids"][0])
    tray_b.starting_weight_grams = None
    db_session.commit()

    rows = {
        row["product_name"]: row
        for row in _data(client.get("/api/v1/reports/product-history"))
    }
    assert rows["Chicken"]["times_produced"] == 2
    # Only Tray from Batch 001 contributes to the yield average - 25%
    # exactly, not skewed by Tray 2's now-missing starting weight.
    assert rows["Chicken"]["average_yield_percent"] == "25.0"
    assert result_a["batch_id"] != result_b["batch_id"]


def test_freeze_dryer_with_no_completed_batches_is_omitted_not_zeroed(
    client: TestClient, db_session: Session
) -> None:
    idle_freeze_dryer = _create_freeze_dryer(client, "White")
    busy_freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=busy_freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    rows = _data(client.get("/api/v1/reports/freeze-dryer-performance"))
    names = {row["freeze_dryer_name"] for row in rows}
    assert names == {"Black"}
    assert idle_freeze_dryer["id"] not in {row["freeze_dryer_id"] for row in rows}


def test_batch_with_two_products_contributes_its_duration_to_both_averages(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            },
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            },
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=15,
    )

    rows = {
        row["product_name"]: row
        for row in _data(client.get("/api/v1/reports/product-history"))
    }
    # The one shared Batch duration (15h) is attributed in full to both
    # Products' averages - not halved or otherwise divided between them.
    assert rows["Chicken"]["average_drying_time_seconds"] == pytest.approx(
        15 * 3600, abs=1
    )
    assert rows["Apples"]["average_drying_time_seconds"] == pytest.approx(
        15 * 3600, abs=1
    )


def test_date_range_filter_includes_and_excludes_by_completed_at(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 15, tzinfo=UTC),
        drying_hours=12,
    )

    included = _data(
        client.get(
            "/api/v1/reports/drying-time",
            params={"date_from": "2026-01-10", "date_to": "2026-01-20"},
        )
    )
    assert len(included) == 1

    excluded = _data(
        client.get(
            "/api/v1/reports/drying-time",
            params={"date_from": "2026-02-01", "date_to": "2026-02-28"},
        )
    )
    assert excluded == []

    # date_to is inclusive of the whole day.
    boundary = _data(
        client.get(
            "/api/v1/reports/drying-time",
            params={"date_from": "2026-01-15", "date_to": "2026-01-15"},
        )
    )
    assert len(boundary) == 1


def test_freeze_dryer_filter_narrows_results(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer_a = _create_freeze_dryer(client, "Black")
    freeze_dryer_b = _create_freeze_dryer(client, "White")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer_a,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            }
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )
    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer_b,
        batch_number="Batch 002",
        trays=[
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            }
        ],
        completed_at=datetime(2026, 1, 3, tzinfo=UTC),
        drying_hours=12,
    )

    rows = _data(
        client.get(
            "/api/v1/reports/drying-time",
            params={"freeze_dryer_id": freeze_dryer_a["id"]},
        )
    )
    assert len(rows) == 1
    assert rows[0]["freeze_dryer_name"] == "Black"


def test_unrecognized_filter_id_returns_empty_result_not_an_error(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/reports/freeze-dryer-performance",
        params={"freeze_dryer_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 200
    assert _data(response) == []


def test_malformed_filter_value_is_a_validation_error(client: TestClient) -> None:
    response = client.get(
        "/api/v1/reports/freeze-dryer-performance",
        params={"freeze_dryer_id": "not-a-uuid"},
    )
    assert response.status_code == 422


def test_product_names_lists_distinct_qualifying_product_names(
    client: TestClient, db_session: Session
) -> None:
    freeze_dryer = _create_freeze_dryer(client, "Black")
    pt1 = _create_physical_tray(client, "Tray 1")
    pt2 = _create_physical_tray(client, "Tray 2")

    _complete_batch(
        client,
        db_session,
        freeze_dryer=freeze_dryer,
        batch_number="Batch 001",
        trays=[
            {
                "physical_tray_id": pt1["id"],
                "product_name": "Chicken",
                "starting_weight": 1000,
                "final_weight": 250,
            },
            {
                "physical_tray_id": pt2["id"],
                "product_name": "Apples",
                "starting_weight": 500,
                "final_weight": 100,
            },
        ],
        completed_at=datetime(2026, 1, 2, tzinfo=UTC),
        drying_hours=12,
    )

    response = client.get("/api/v1/reports/product-names")
    assert response.status_code == 200
    assert _data(response) == ["Apples", "Chicken"]

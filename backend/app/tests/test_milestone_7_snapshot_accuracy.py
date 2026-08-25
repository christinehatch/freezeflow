"""Regression coverage for the report-level generalization of ADR-0013's
snapshot guarantee (see ADR-0019 and RP-005).

Once a Tray has been dried and counted into a report, later edits to (or
archiving of) the Preparation Preset it was created from must never change
that report's historical result. This mirrors
test_milestone_6_snapshot_integrity.py's discipline exactly: it's its own
module because the guarantee is load-bearing enough to be a named,
standalone, checkable fact about the system rather than one assertion
buried in the general report test suite.
"""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DryingRun, ProductionBatch, Tray


def _data(response) -> dict | list:
    return response.json()["data"]


def test_editing_a_preparation_preset_never_changes_a_reports_historical_result(
    client: TestClient, db_session: Session
) -> None:
    preset_response = client.post(
        "/api/v1/preparation-presets",
        json={
            "name": "Sliced Chicken",
            "product_name": "Chicken",
            "ingredients": ["Salt"],
            "preparation_methods": ["Sliced"],
        },
    )
    assert preset_response.status_code == 201
    preset = _data(preset_response)

    freeze_dryer = _data(
        client.post(
            "/api/v1/freeze-dryers", json={"name": "Black", "tray_slot_count": 1}
        )
    )
    physical_tray = _data(
        client.post("/api/v1/physical-trays", json={"label": "Tray 1"})
    )
    batch = _data(
        client.post(
            "/api/v1/production-batches",
            json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": "Batch 001"},
        )
    )
    tray = _data(
        client.post(
            f"/api/v1/production-batches/{batch['id']}/trays",
            json={
                "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
                "physical_tray_id": physical_tray["id"],
                "preparation_preset_id": preset["id"],
                "product_name": "Chicken",
                "ingredients": ["Salt"],
                "preparation_methods": ["Sliced"],
                "starting_weight_grams": "1000.000",
            },
        )
    )

    client.post(f"/api/v1/production-batches/{batch['id']}/start")
    started_batch = _data(client.get(f"/api/v1/production-batches/{batch['id']}"))
    drying_run_id = started_batch["drying_runs"][0]["id"]
    client.post(f"/api/v1/drying-runs/{drying_run_id}/complete", json={})

    completed_at = datetime(2026, 1, 2, tzinfo=UTC)
    drying_run = db_session.get(DryingRun, drying_run_id)
    drying_run.started_at = completed_at - timedelta(hours=13)
    drying_run.ended_at = completed_at - timedelta(hours=1)
    db_session.commit()

    client.post(
        f"/api/v1/trays/{tray['id']}/weight-checks",
        json={
            "drying_run_id": drying_run_id,
            "weight_grams": "250.000",
            "observed_at": completed_at.isoformat(),
        },
    )
    client.post(
        f"/api/v1/trays/{tray['id']}/complete",
        json={"final_dry_weight_grams": "250.000"},
    )
    client.post(f"/api/v1/production-batches/{batch['id']}/complete")

    production_batch = db_session.get(ProductionBatch, batch["id"])
    production_batch.started_at = completed_at - timedelta(hours=14)
    production_batch.completed_at = completed_at
    db_session.commit()
    db_session.get(Tray, tray["id"]).completed_at = completed_at
    db_session.commit()

    # Capture the report's result while the Preset still has its original name.
    before = _data(client.get("/api/v1/reports/preparation-history"))
    before_row = next(
        row for row in before if row["preparation_preset_name"] == "Sliced Chicken"
    )
    assert before_row["used_preset"] is True
    assert before_row["times_used"] == 1

    # Edit the Preset after the Tray has already dried and been counted.
    update_response = client.patch(
        f"/api/v1/preparation-presets/{preset['id']}",
        json={"name": "Renamed Preset"},
    )
    assert update_response.status_code == 200
    assert _data(update_response)["name"] == "Renamed Preset"

    # The report must still show the original name - never the Preset's
    # current one - for a Tray that was already counted under it.
    after = _data(client.get("/api/v1/reports/preparation-history"))
    after_names = {row["preparation_preset_name"] for row in after}
    assert "Sliced Chicken" in after_names
    assert "Renamed Preset" not in after_names
    after_row = next(
        row for row in after if row["preparation_preset_name"] == "Sliced Chicken"
    )
    assert after_row["used_preset"] is True
    assert after_row["times_used"] == 1

    # Archiving the Preset afterward must not affect the report either.
    archive_response = client.post(
        f"/api/v1/preparation-presets/{preset['id']}/archive"
    )
    assert archive_response.status_code == 200
    after_archive = _data(client.get("/api/v1/reports/preparation-history"))
    assert any(
        row["preparation_preset_name"] == "Sliced Chicken" for row in after_archive
    )

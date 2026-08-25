"""Regression coverage for ADR-0013's core guarantee.

Once a Tray is created, later edits to the Preparation Preset it was
created from must never retroactively rewrite that Tray's historical
record. This is the specific fix for a real pre-Milestone-6 bug: the old
`Tray.recipe_name` was computed live via a join to `Recipe.name`, so
renaming a Recipe silently changed what already-completed Trays displayed.
`Tray.preparation_preset_name_at_use` (plus the Tray's own copies of
`product_name`/`ingredients`/`preparation_methods`) exist specifically to
close that gap - see docs/persistence/04-preparation-preset.md and the
Milestone 6 plan's "Core Principle" section.

This is its own test module, separate from test_milestone_6_api.py's CRUD
coverage, because it documents an architectural guarantee as a concrete,
checkable fact about the system rather than exercising one endpoint's
contract.
"""

from fastapi.testclient import TestClient


def _data(response) -> dict | list:
    return response.json()["data"]


def _create_preparation_preset(
    client: TestClient,
    name: str,
    *,
    product_name: str,
    ingredients: list[str],
    preparation_methods: list[str],
) -> dict:
    response = client.post(
        "/api/v1/preparation-presets",
        json={
            "name": name,
            "product_name": product_name,
            "ingredients": ingredients,
            "preparation_methods": preparation_methods,
        },
    )
    assert response.status_code == 201
    return _data(response)


def _create_batch_and_slot(client: TestClient, batch_number: str) -> tuple[dict, dict]:
    freeze_dryer_response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": f"{batch_number} Dryer", "tray_slot_count": 1},
    )
    assert freeze_dryer_response.status_code == 201
    freeze_dryer = _data(freeze_dryer_response)

    physical_tray_response = client.post(
        "/api/v1/physical-trays", json={"label": f"{batch_number} Tray"}
    )
    assert physical_tray_response.status_code == 201
    physical_tray = _data(physical_tray_response)

    batch_response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": batch_number},
    )
    assert batch_response.status_code == 201
    batch = _data(batch_response)
    return batch, {
        "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
        "physical_tray_id": physical_tray["id"],
    }


def test_editing_a_preparation_preset_never_rewrites_a_created_trays_snapshot(
    client: TestClient,
) -> None:
    preset = _create_preparation_preset(
        client,
        "Snapshot Preset",
        product_name="Snapshot Product",
        ingredients=["Original ingredient"],
        preparation_methods=["Original method"],
    )
    batch, slot = _create_batch_and_slot(client, "Snapshot integrity batch")

    tray_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "preparation_preset_id": preset["id"],
            "product_name": preset["product_name"],
            "ingredients": preset["ingredients"],
            "preparation_methods": preset["preparation_methods"],
            "starting_weight_grams": "907.000",
        },
    )
    assert tray_response.status_code == 201
    tray = _data(tray_response)
    assert tray["preparation_preset_id"] == preset["id"]
    assert tray["preparation_preset_name"] == "Snapshot Preset"
    assert tray["product_name"] == "Snapshot Product"
    assert tray["ingredients"] == ["Original ingredient"]
    assert tray["preparation_methods"] == ["Original method"]

    # Edit the Preset after the Tray already exists: rename it and change
    # both structured fields, plus the product name it would pre-fill.
    update_response = client.patch(
        f"/api/v1/preparation-presets/{preset['id']}",
        json={
            "name": "Renamed Preset",
            "product_name": "Renamed Product",
            "ingredients": ["Changed ingredient"],
            "preparation_methods": ["Changed method"],
        },
    )
    assert update_response.status_code == 200
    updated_preset = _data(update_response)
    assert updated_preset["name"] == "Renamed Preset"

    refetched_response = client.get(f"/api/v1/trays/{tray['id']}")
    assert refetched_response.status_code == 200
    refetched_tray = _data(refetched_response)

    # The Tray's own historical record must be completely unaffected by
    # the Preset edit - this is the guarantee, checked field by field.
    assert refetched_tray["preparation_preset_id"] == preset["id"]
    assert refetched_tray["preparation_preset_name"] == "Snapshot Preset"
    assert refetched_tray["product_name"] == "Snapshot Product"
    assert refetched_tray["ingredients"] == ["Original ingredient"]
    assert refetched_tray["preparation_methods"] == ["Original method"]

    # Also confirm the Preset itself did change, so this test would have
    # failed loudly if the snapshot fields were live joins instead.
    preset_response = client.get(f"/api/v1/preparation-presets/{preset['id']}")
    assert preset_response.status_code == 200
    current_preset = _data(preset_response)
    assert current_preset["name"] == "Renamed Preset"
    assert current_preset["product_name"] == "Renamed Product"
    assert current_preset["ingredients"] == ["Changed ingredient"]
    assert current_preset["preparation_methods"] == ["Changed method"]


def test_archiving_a_preparation_preset_does_not_affect_trays_already_created_from_it(
    client: TestClient,
) -> None:
    preset = _create_preparation_preset(
        client,
        "Archivable Preset",
        product_name="Archivable Product",
        ingredients=["Ingredient"],
        preparation_methods=["Method"],
    )
    batch, slot = _create_batch_and_slot(client, "Archive integrity batch")

    tray_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "preparation_preset_id": preset["id"],
            "product_name": preset["product_name"],
            "ingredients": preset["ingredients"],
            "preparation_methods": preset["preparation_methods"],
            "starting_weight_grams": "907.000",
        },
    )
    assert tray_response.status_code == 201
    tray = _data(tray_response)

    archive_response = client.post(
        f"/api/v1/preparation-presets/{preset['id']}/archive"
    )
    assert archive_response.status_code == 200
    assert _data(archive_response)["archived"] is True

    refetched_response = client.get(f"/api/v1/trays/{tray['id']}")
    assert refetched_response.status_code == 200
    refetched_tray = _data(refetched_response)
    assert refetched_tray["preparation_preset_id"] == preset["id"]
    assert refetched_tray["preparation_preset_name"] == "Archivable Preset"
    assert refetched_tray["product_name"] == "Archivable Product"
    assert refetched_tray["ingredients"] == ["Ingredient"]
    assert refetched_tray["preparation_methods"] == ["Method"]

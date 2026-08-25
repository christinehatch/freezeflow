from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import PreparationPreset


def _data(response) -> dict | list:
    return response.json()["data"]


def _assert_business_error(response, message: str) -> None:
    assert response.status_code == 400
    assert message in response.json()["detail"]["message"]


def _create_preparation_preset(
    client: TestClient,
    name: str = "Taco Chicken",
    *,
    product_name: str = "Taco Chicken",
    ingredients: list[str] | None = None,
    preparation_methods: list[str] | None = None,
    notes: str | None = None,
) -> dict:
    response = client.post(
        "/api/v1/preparation-presets",
        json={
            "name": name,
            "product_name": product_name,
            "ingredients": ingredients or ["Taco seasoning"],
            "preparation_methods": preparation_methods or ["Cooked", "Shredded"],
            "notes": notes,
        },
    )
    assert response.status_code == 201
    return _data(response)


def _create_freeze_dryer(client: TestClient, name: str) -> dict:
    response = client.post(
        "/api/v1/freeze-dryers",
        json={"name": name, "tray_slot_count": 1},
    )
    assert response.status_code == 201
    return _data(response)


def _create_physical_tray(client: TestClient, label: str) -> dict:
    response = client.post("/api/v1/physical-trays", json={"label": label})
    assert response.status_code == 201
    return _data(response)


def _create_batch_and_slot(client: TestClient, batch_number: str) -> tuple[dict, dict]:
    freeze_dryer = _create_freeze_dryer(client, f"{batch_number} Dryer")
    physical_tray = _create_physical_tray(client, f"{batch_number} Tray")
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


def test_preparation_preset_can_be_created_listed_and_fetched(
    client: TestClient,
) -> None:
    created = _create_preparation_preset(
        client, "Sliced Strawberries", product_name="Sliced Strawberries"
    )
    assert created["name"] == "Sliced Strawberries"
    assert created["product_name"] == "Sliced Strawberries"
    assert created["ingredients"] == ["Taco seasoning"]
    assert created["preparation_methods"] == ["Cooked", "Shredded"]
    assert created["archived"] is False

    list_response = client.get("/api/v1/preparation-presets")
    assert list_response.status_code == 200
    names = [preset["name"] for preset in _data(list_response)]
    assert "Sliced Strawberries" in names

    get_response = client.get(f"/api/v1/preparation-presets/{created['id']}")
    assert get_response.status_code == 200
    assert _data(get_response)["id"] == created["id"]


def test_preparation_preset_name_is_trimmed_and_must_not_be_blank(
    client: TestClient,
) -> None:
    created = _create_preparation_preset(client, "  Apple Slices  ")
    assert created["name"] == "Apple Slices"

    blank_response = client.post(
        "/api/v1/preparation-presets",
        json={"name": "   ", "product_name": "Apple Slices"},
    )
    _assert_business_error(blank_response, "Preparation Preset name is required.")


def test_preparation_preset_names_are_case_insensitively_unique(
    client: TestClient,
) -> None:
    _create_preparation_preset(client, "Taco Chicken")

    duplicate_response = client.post(
        "/api/v1/preparation-presets",
        json={"name": "taco chicken", "product_name": "Taco Chicken"},
    )
    _assert_business_error(
        duplicate_response, 'A Preparation Preset named "taco chicken" already exists.'
    )


def test_preparation_preset_can_be_renamed_and_notes_updated(
    client: TestClient,
) -> None:
    created = _create_preparation_preset(client, "Taco Chicken")

    response = client.patch(
        f"/api/v1/preparation-presets/{created['id']}",
        json={"name": "Taco Beef", "notes": "Swap protein."},
    )
    assert response.status_code == 200
    updated = _data(response)
    assert updated["name"] == "Taco Beef"
    assert updated["notes"] == "Swap protein."


def test_preparation_preset_can_be_archived_and_restored(
    client: TestClient,
) -> None:
    created = _create_preparation_preset(client, "Beef Stew")

    archive_response = client.post(
        f"/api/v1/preparation-presets/{created['id']}/archive"
    )
    assert archive_response.status_code == 200
    assert _data(archive_response)["archived"] is True

    list_response = client.get("/api/v1/preparation-presets")
    assert created["id"] not in [preset["id"] for preset in _data(list_response)]

    include_archived_response = client.get(
        "/api/v1/preparation-presets", params={"include_archived": True}
    )
    assert created["id"] in [
        preset["id"] for preset in _data(include_archived_response)
    ]

    double_archive_response = client.post(
        f"/api/v1/preparation-presets/{created['id']}/archive"
    )
    _assert_business_error(
        double_archive_response, "Preparation Preset is already archived."
    )

    restore_response = client.post(
        f"/api/v1/preparation-presets/{created['id']}/restore"
    )
    assert restore_response.status_code == 200
    assert _data(restore_response)["archived"] is False

    restore_again_response = client.post(
        f"/api/v1/preparation-presets/{created['id']}/restore"
    )
    _assert_business_error(
        restore_again_response, "Preparation Preset is not archived."
    )


def test_restore_enforces_the_same_active_plus_archived_uniqueness_rule(
    client: TestClient, db_session: Session
) -> None:
    archived = _create_preparation_preset(client, "Beef Stew")
    archive_response = client.post(
        f"/api/v1/preparation-presets/{archived['id']}/archive"
    )
    assert archive_response.status_code == 200

    db_session.add(
        PreparationPreset(name="Beef Stew", product_name="Beef Stew", archived=False)
    )
    db_session.commit()

    restore_response = client.post(
        f"/api/v1/preparation-presets/{archived['id']}/restore"
    )
    _assert_business_error(
        restore_response, 'A Preparation Preset named "Beef Stew" already exists.'
    )


def test_archived_preparation_preset_cannot_be_selected_for_a_new_tray(
    client: TestClient,
) -> None:
    preset = _create_preparation_preset(client, "Archived Preset")
    client.post(f"/api/v1/preparation-presets/{preset['id']}/archive")

    batch, slot = _create_batch_and_slot(client, "Archived preset batch")
    response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "preparation_preset_id": preset["id"],
            "product_name": "Taco Chicken",
            "ingredients": ["Taco seasoning"],
            "starting_weight_grams": "907.000",
        },
    )
    _assert_business_error(
        response, "Archived Preparation Presets cannot be selected for new Trays."
    )


def test_tray_can_be_created_without_a_preset_using_inline_values(
    client: TestClient,
) -> None:
    batch, slot = _create_batch_and_slot(client, "Inline values batch")
    response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "product_name": "One-off Blend",
            "ingredients": ["Salt", "Pepper"],
            "starting_weight_grams": "907.000",
        },
    )
    assert response.status_code == 201
    tray = _data(response)
    assert tray["preparation_preset_id"] is None
    assert tray["preparation_preset_name"] is None
    assert tray["product_name"] == "One-off Blend"
    assert tray["ingredients"] == ["Salt", "Pepper"]


def test_tray_created_from_a_preset_snapshots_submitted_values_not_the_presets(
    client: TestClient,
) -> None:
    preset = _create_preparation_preset(
        client,
        "Sliceable Preset",
        product_name="Sliced Mango",
        ingredients=["Mango"],
        preparation_methods=["Sliced"],
    )
    batch, slot = _create_batch_and_slot(client, "Preset snapshot batch")
    response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "preparation_preset_id": preset["id"],
            "product_name": "Sliced Mango (extra ripe)",
            "ingredients": ["Mango", "Lime"],
            "preparation_methods": ["Sliced"],
            "starting_weight_grams": "907.000",
        },
    )
    assert response.status_code == 201
    tray = _data(response)
    assert tray["preparation_preset_id"] == preset["id"]
    assert tray["preparation_preset_name"] == "Sliceable Preset"
    assert tray["product_name"] == "Sliced Mango (extra ripe)"
    assert tray["ingredients"] == ["Mango", "Lime"]


def test_suggestions_endpoint_returns_distinct_values_from_presets_and_trays(
    client: TestClient,
) -> None:
    _create_preparation_preset(
        client,
        "Suggestion Preset",
        ingredients=["Salt", "Pepper"],
        preparation_methods=["Cooked"],
    )
    batch, slot = _create_batch_and_slot(client, "Suggestions batch")
    client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            **slot,
            "product_name": "One-off",
            "ingredients": ["Salt", "Cumin"],
            "starting_weight_grams": "907.000",
        },
    )

    response = client.get(
        "/api/v1/preparation-presets/suggestions", params={"field": "ingredients"}
    )
    assert response.status_code == 200
    values = _data(response)
    assert set(values) == {"Salt", "Pepper", "Cumin"}

    invalid_response = client.get(
        "/api/v1/preparation-presets/suggestions", params={"field": "notes"}
    )
    _assert_business_error(
        invalid_response,
        'field must be "ingredients" or "preparation_methods".',
    )

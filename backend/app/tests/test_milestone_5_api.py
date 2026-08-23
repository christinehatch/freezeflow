from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import StorageLocation


def _data(response) -> dict | list:
    return response.json()["data"]


def _assert_business_error(response, message: str) -> None:
    assert response.status_code == 400
    assert message in response.json()["detail"]["message"]


def _create_storage_location(
    client: TestClient, name: str = "Pantry", notes: str | None = None
) -> dict:
    response = client.post(
        "/api/v1/storage-locations",
        json={"name": name, "notes": notes},
    )
    assert response.status_code == 201
    return _data(response)


def test_storage_location_can_be_created_listed_and_fetched(
    client: TestClient,
) -> None:
    created = _create_storage_location(client, "Basement Bin A", notes="Cool and dry.")
    assert created["name"] == "Basement Bin A"
    assert created["notes"] == "Cool and dry."
    assert created["archived"] is False

    list_response = client.get("/api/v1/storage-locations")
    assert list_response.status_code == 200
    names = [location["name"] for location in _data(list_response)]
    assert "Basement Bin A" in names
    assert "Unassigned" in names

    get_response = client.get(f"/api/v1/storage-locations/{created['id']}")
    assert get_response.status_code == 200
    assert _data(get_response)["id"] == created["id"]


def test_storage_location_name_is_trimmed_and_must_not_be_blank(
    client: TestClient,
) -> None:
    created = _create_storage_location(client, "  Freezer Shelf A  ")
    assert created["name"] == "Freezer Shelf A"

    blank_response = client.post("/api/v1/storage-locations", json={"name": "   "})
    _assert_business_error(blank_response, "Storage Location name is required.")


def test_storage_location_names_are_case_insensitively_unique(
    client: TestClient,
) -> None:
    _create_storage_location(client, "Pantry")

    duplicate_response = client.post(
        "/api/v1/storage-locations", json={"name": "pantry"}
    )
    _assert_business_error(
        duplicate_response, 'A Storage Location named "pantry" already exists.'
    )


def test_unassigned_name_is_reserved(client: TestClient) -> None:
    response = client.post("/api/v1/storage-locations", json={"name": "Unassigned"})
    _assert_business_error(
        response,
        'The name "Unassigned" is reserved for the system-provided '
        "Storage Location.",
    )


def test_storage_location_can_be_renamed_and_notes_updated(
    client: TestClient,
) -> None:
    created = _create_storage_location(client, "Pantry")

    response = client.patch(
        f"/api/v1/storage-locations/{created['id']}",
        json={"name": "Pantry Shelf", "notes": "Updated notes."},
    )
    assert response.status_code == 200
    updated = _data(response)
    assert updated["name"] == "Pantry Shelf"
    assert updated["notes"] == "Updated notes."


def test_unassigned_storage_location_cannot_be_renamed_or_archived(
    client: TestClient,
) -> None:
    list_response = client.get("/api/v1/storage-locations")
    unassigned = next(
        location
        for location in _data(list_response)
        if location["name"] == "Unassigned"
    )

    rename_response = client.patch(
        f"/api/v1/storage-locations/{unassigned['id']}",
        json={"name": "Renamed"},
    )
    _assert_business_error(
        rename_response, "The Unassigned Storage Location cannot be renamed."
    )

    archive_response = client.post(
        f"/api/v1/storage-locations/{unassigned['id']}/archive"
    )
    _assert_business_error(
        archive_response, "The Unassigned Storage Location cannot be archived."
    )


def test_storage_location_can_be_archived_and_restored(
    client: TestClient,
) -> None:
    created = _create_storage_location(client, "Garage Shelf")

    archive_response = client.post(f"/api/v1/storage-locations/{created['id']}/archive")
    assert archive_response.status_code == 200
    assert _data(archive_response)["archived"] is True

    list_response = client.get("/api/v1/storage-locations")
    assert created["id"] not in [loc["id"] for loc in _data(list_response)]

    include_archived_response = client.get(
        "/api/v1/storage-locations", params={"include_archived": True}
    )
    assert created["id"] in [loc["id"] for loc in _data(include_archived_response)]

    double_archive_response = client.post(
        f"/api/v1/storage-locations/{created['id']}/archive"
    )
    _assert_business_error(
        double_archive_response, "Storage Location is already archived."
    )

    restore_response = client.post(f"/api/v1/storage-locations/{created['id']}/restore")
    assert restore_response.status_code == 200
    assert _data(restore_response)["archived"] is False

    restore_again_response = client.post(
        f"/api/v1/storage-locations/{created['id']}/restore"
    )
    _assert_business_error(restore_again_response, "Storage Location is not archived.")


def test_creating_a_storage_location_named_like_an_archived_one_is_rejected(
    client: TestClient,
) -> None:
    archived = _create_storage_location(client, "Bin A")
    archive_response = client.post(
        f"/api/v1/storage-locations/{archived['id']}/archive"
    )
    assert archive_response.status_code == 200

    duplicate_response = client.post(
        "/api/v1/storage-locations", json={"name": "Bin A"}
    )
    _assert_business_error(
        duplicate_response, 'A Storage Location named "Bin A" already exists.'
    )


def test_restore_enforces_the_same_active_plus_archived_uniqueness_rule(
    client: TestClient, db_session: Session
) -> None:
    archived = _create_storage_location(client, "Bin A")
    archive_response = client.post(
        f"/api/v1/storage-locations/{archived['id']}/archive"
    )
    assert archive_response.status_code == 200

    db_session.add(StorageLocation(name="Bin A", archived=False))
    db_session.commit()

    restore_response = client.post(
        f"/api/v1/storage-locations/{archived['id']}/restore"
    )
    _assert_business_error(
        restore_response, 'A Storage Location named "Bin A" already exists.'
    )


def test_renaming_a_storage_location_to_an_archived_name_is_rejected(
    client: TestClient,
) -> None:
    archived = _create_storage_location(client, "Bin A")
    client.post(f"/api/v1/storage-locations/{archived['id']}/archive")

    active = _create_storage_location(client, "Bin B")
    rename_response = client.patch(
        f"/api/v1/storage-locations/{active['id']}",
        json={"name": "Bin A"},
    )
    _assert_business_error(
        rename_response, 'A Storage Location named "Bin A" already exists.'
    )

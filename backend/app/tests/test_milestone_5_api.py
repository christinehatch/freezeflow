from datetime import UTC, datetime

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


def _create_completed_batch(
    client: TestClient,
    batch_number: str,
    *,
    product_name: str = "Taco Chicken",
    preparation: str = "Cubed and seasoned.",
) -> dict:
    freeze_dryer = _create_freeze_dryer(client, f"{batch_number} Dryer")
    physical_tray = _create_physical_tray(client, f"{batch_number} Tray")
    batch_response = client.post(
        "/api/v1/production-batches",
        json={"freeze_dryer_id": freeze_dryer["id"], "batch_number": batch_number},
    )
    assert batch_response.status_code == 201
    batch = _data(batch_response)

    tray_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/trays",
        json={
            "tray_slot_id": freeze_dryer["tray_slots"][0]["id"],
            "physical_tray_id": physical_tray["id"],
            "product_name": product_name,
            "preparation": preparation,
            "starting_weight_grams": "907.000",
        },
    )
    assert tray_response.status_code == 201
    tray = _data(tray_response)

    start_response = client.post(f"/api/v1/production-batches/{batch['id']}/start")
    assert start_response.status_code == 200
    drying_run_id = _data(start_response)["drying_runs"][0]["id"]
    complete_run_response = client.post(
        f"/api/v1/drying-runs/{drying_run_id}/complete", json={}
    )
    assert complete_run_response.status_code == 200
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

    complete_batch_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/complete"
    )
    assert complete_batch_response.status_code == 200
    return _data(complete_batch_response)


def _create_package_type(client: TestClient, name: str = "Quart Mylar") -> dict:
    response = client.post(
        "/api/v1/package-types",
        json={"name": name, "default_oxygen_absorber": "500cc"},
    )
    assert response.status_code == 201
    return _data(response)


def _create_package(
    client: TestClient,
    *,
    batch_number: str,
    product_name: str = "Taco Chicken",
    package_type_name: str = "Quart Mylar",
    storage_location_id: str | None = None,
    notes: str | None = None,
    packaged_at: str | None = None,
) -> dict:
    batch = _create_completed_batch(client, batch_number, product_name=product_name)
    package_type = _create_package_type(client, package_type_name)
    operation_response = client.post(
        f"/api/v1/production-batches/{batch['id']}/packaging-operation",
        json={},
    )
    assert operation_response.status_code == 201
    operation = _data(operation_response)

    tray_ids = [tray["id"] for tray in batch["trays"]]
    allocation_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/allocate-trays",
        json={"tray_ids": tray_ids},
    )
    assert allocation_response.status_code == 201
    allocation = _data(allocation_response)

    package_line: dict = {
        "package_type_id": package_type["id"],
        "finished_product_weight_grams": "240.000",
        "sealed_package_weight_grams": "245.000",
    }
    if storage_location_id is not None:
        package_line["storage_location_id"] = storage_location_id
    if notes is not None:
        package_line["notes"] = notes
    if packaged_at is not None:
        package_line["packaged_at"] = packaged_at
    record_response = client.post(
        f"/api/v1/packaging-operations/{operation['id']}/allocations/"
        f"{allocation['id']}/packages",
        json={"packages": [package_line]},
    )
    assert record_response.status_code == 201
    return _data(record_response)["packages"][0]


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


def test_move_updates_storage_location_and_appends_history(
    client: TestClient,
) -> None:
    package = _create_package(client, batch_number="Move batch")
    destination = _create_storage_location(client, "Garage Freezer")

    response = client.post(
        f"/api/v1/packages/{package['id']}/move",
        json={"storage_location_id": destination["id"], "notes": "Consolidated."},
    )
    assert response.status_code == 200
    moved = _data(response)
    assert moved["storage_location"]["id"] == destination["id"]

    history_response = client.get(f"/api/v1/packages/{package['id']}/storage-history")
    assert history_response.status_code == 200
    history = _data(history_response)
    assert len(history) == 2
    assert history[0]["previous_storage_location_id"] is None
    assert (
        history[1]["previous_storage_location_id"] == package["storage_location"]["id"]
    )
    assert history[1]["current_storage_location_id"] == destination["id"]
    assert history[1]["notes"] == "Consolidated."


def test_move_to_same_location_is_rejected_and_creates_no_history(
    client: TestClient,
) -> None:
    package = _create_package(client, batch_number="Same location batch")

    response = client.post(
        f"/api/v1/packages/{package['id']}/move",
        json={"storage_location_id": package["storage_location"]["id"]},
    )
    _assert_business_error(response, "Package is already in that Storage Location.")

    history_response = client.get(f"/api/v1/packages/{package['id']}/storage-history")
    assert len(_data(history_response)) == 1


def test_move_to_an_archived_location_is_rejected(client: TestClient) -> None:
    package = _create_package(client, batch_number="Archived destination batch")
    destination = _create_storage_location(client, "Retired Bin")
    client.post(f"/api/v1/storage-locations/{destination['id']}/archive")

    response = client.post(
        f"/api/v1/packages/{package['id']}/move",
        json={"storage_location_id": destination["id"]},
    )
    _assert_business_error(
        response, "Archived Storage Locations cannot receive Packages."
    )


def test_moving_out_of_an_archived_location_succeeds(client: TestClient) -> None:
    origin = _create_storage_location(client, "Old Chest Freezer")
    package = _create_package(
        client, batch_number="Origin archived batch", storage_location_id=origin["id"]
    )
    client.post(f"/api/v1/storage-locations/{origin['id']}/archive")
    destination = _create_storage_location(client, "New Chest Freezer")

    response = client.post(
        f"/api/v1/packages/{package['id']}/move",
        json={"storage_location_id": destination["id"]},
    )
    assert response.status_code == 200
    assert _data(response)["storage_location"]["id"] == destination["id"]


def test_give_away_and_deplete_update_status_and_append_status_history(
    client: TestClient,
) -> None:
    given_away = _create_package(client, batch_number="Given away batch")
    depleted = _create_package(client, batch_number="Depleted batch")

    give_away_response = client.post(
        f"/api/v1/packages/{given_away['id']}/give-away",
        json={"notes": "Gift for Mary."},
    )
    assert give_away_response.status_code == 200
    assert _data(give_away_response)["status"] == "Given Away"

    deplete_response = client.post(
        f"/api/v1/packages/{depleted['id']}/deplete",
        json={"notes": "Made soup."},
    )
    assert deplete_response.status_code == 200
    assert _data(deplete_response)["status"] == "Depleted"

    history_response = client.get(f"/api/v1/packages/{given_away['id']}/status-history")
    history = _data(history_response)
    assert len(history) == 2
    assert history[0]["previous_status"] is None
    assert history[0]["current_status"] == "In Storage"
    assert history[1]["previous_status"] == "In Storage"
    assert history[1]["current_status"] == "Given Away"
    assert history[1]["notes"] == "Gift for Mary."


def test_terminal_packages_reject_move_give_away_and_deplete(
    client: TestClient,
) -> None:
    package = _create_package(client, batch_number="Terminal batch")
    client.post(f"/api/v1/packages/{package['id']}/deplete", json={})

    destination = _create_storage_location(client, "Somewhere Else")
    move_response = client.post(
        f"/api/v1/packages/{package['id']}/move",
        json={"storage_location_id": destination["id"]},
    )
    _assert_business_error(move_response, "Only an In Storage Package can be moved.")

    give_away_response = client.post(
        f"/api/v1/packages/{package['id']}/give-away", json={}
    )
    _assert_business_error(
        give_away_response, "Only an In Storage Package can be given away."
    )

    deplete_response = client.post(f"/api/v1/packages/{package['id']}/deplete", json={})
    _assert_business_error(
        deplete_response, "Only an In Storage Package can be depleted."
    )


def _meta(response) -> dict:
    return response.json()["meta"]


def _product_groups(client: TestClient) -> list[dict]:
    response = client.get("/api/v1/inventory/products")
    assert response.status_code == 200
    return _data(response)


def test_product_groups_aggregate_by_historical_product_name(
    client: TestClient,
) -> None:
    bin_a = _create_storage_location(client, "Bin A")
    bin_c = _create_storage_location(client, "Bin C")
    _create_package(
        client,
        batch_number="Chicken batch 1",
        product_name="Chicken",
        storage_location_id=bin_a["id"],
        packaged_at="2026-05-03T00:00:00Z",
    )
    _create_package(
        client,
        batch_number="Chicken batch 2",
        product_name="Chicken",
        storage_location_id=bin_c["id"],
        packaged_at="2026-07-18T00:00:00Z",
    )
    _create_package(
        client, batch_number="Strawberries batch", product_name="Strawberries"
    )

    groups = {group["product_name"]: group for group in _product_groups(client)}
    assert set(groups) == {"Chicken", "Strawberries"}

    chicken = groups["Chicken"]
    assert chicken["available_package_count"] == 2
    assert chicken["storage_locations"] == ["Bin A", "Bin C"]
    assert chicken["oldest_packaged_at"].startswith("2026-05-03T00:00:00")
    assert chicken["newest_packaged_at"].startswith("2026-07-18T00:00:00")


def test_product_groups_exclude_given_away_and_depleted_packages(
    client: TestClient,
) -> None:
    kept = _create_package(client, batch_number="Kept batch", product_name="Chicken")
    given_away = _create_package(
        client, batch_number="Given away batch", product_name="Chicken"
    )
    client.post(f"/api/v1/packages/{given_away['id']}/give-away", json={})

    groups = {group["product_name"]: group for group in _product_groups(client)}
    assert groups["Chicken"]["available_package_count"] == 1

    only_depleted = _create_package(
        client, batch_number="Only depleted batch", product_name="Skittles"
    )
    client.post(f"/api/v1/packages/{only_depleted['id']}/deplete", json={})
    groups = {group["product_name"]: group for group in _product_groups(client)}
    assert "Skittles" not in groups
    assert kept["id"]


def test_relabeling_a_package_does_not_split_or_merge_its_product_group(
    client: TestClient,
) -> None:
    package = _create_package(client, batch_number="Relabel batch", product_name="Taco")
    client.patch(
        f"/api/v1/packages/{package['id']}/label",
        json={"display_name": "Hudson's Taco"},
    )

    groups = {group["product_name"]: group for group in _product_groups(client)}
    assert "Taco" in groups
    assert groups["Taco"]["available_package_count"] == 1
    assert "Hudson's Taco" not in groups


def test_search_matches_product_name_and_defaults_to_in_storage_sorted_by_product(
    client: TestClient,
) -> None:
    _create_package(
        client,
        batch_number="Search chicken",
        product_name="Chicken",
        packaged_at="2026-05-03T00:00:00Z",
    )
    _create_package(
        client,
        batch_number="Search strawberries",
        product_name="Strawberries",
        packaged_at="2026-06-01T00:00:00Z",
    )
    given_away = _create_package(
        client, batch_number="Search given away", product_name="Apples"
    )
    client.post(f"/api/v1/packages/{given_away['id']}/give-away", json={})

    all_response = client.get("/api/v1/inventory")
    assert all_response.status_code == 200
    all_results = _data(all_response)
    assert _meta(all_response)["total"] == 2
    display_names = [result["label"]["display_name"] for result in all_results]
    assert display_names == ["Chicken", "Strawberries"]
    assert all(result["status"] == "In Storage" for result in all_results)

    filtered_response = client.get("/api/v1/inventory", params={"query": "Chicken"})
    filtered_results = _data(filtered_response)
    assert len(filtered_results) == 1
    assert filtered_results[0]["label"]["display_name"] == "Chicken"


def test_search_matches_notes_label_name_storage_location_and_package_type(
    client: TestClient,
) -> None:
    location = _create_storage_location(client, "Garage Freezer")
    package = _create_package(
        client,
        batch_number="Match fields batch",
        product_name="Beef Jerky",
        package_type_name="Gallon Mylar",
        storage_location_id=location["id"],
        notes="For the camping trip",
    )
    client.patch(
        f"/api/v1/packages/{package['id']}/label",
        json={"display_name": "Trail Jerky"},
    )

    for term in [
        "camping",
        "Trail Jerky",
        "Garage Freezer",
        "Gallon Mylar",
        package["package_identifier"],
    ]:
        response = client.get("/api/v1/inventory", params={"query": term})
        results = _data(response)
        assert any(result["id"] == package["id"] for result in results), term


def test_search_query_and_filters_combine_with_and(client: TestClient) -> None:
    other_location = _create_storage_location(client, "Other Bin")
    _create_package(client, batch_number="And filter batch", product_name="Chicken")

    response = client.get(
        "/api/v1/inventory",
        params={"query": "Chicken", "storage_location_id": other_location["id"]},
    )
    assert response.status_code == 200
    assert _data(response) == []


def test_search_pagination_limit_and_offset(client: TestClient) -> None:
    for index in range(3):
        _create_package(
            client,
            batch_number=f"Page batch {index}",
            product_name="Chicken",
            packaged_at=f"2026-0{index + 1}-01T00:00:00Z",
        )

    first_page = client.get(
        "/api/v1/inventory", params={"product_name": "Chicken", "limit": 2, "offset": 0}
    )
    assert len(_data(first_page)) == 2
    assert _meta(first_page)["total"] == 3

    second_page = client.get(
        "/api/v1/inventory", params={"product_name": "Chicken", "limit": 2, "offset": 2}
    )
    assert len(_data(second_page)) == 1


def test_search_limit_is_capped_at_one_hundred(client: TestClient) -> None:
    response = client.get("/api/v1/inventory", params={"limit": 500})
    assert response.status_code == 200
    assert _meta(response)["limit"] == 100

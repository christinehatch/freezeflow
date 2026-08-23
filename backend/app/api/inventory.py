from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import (
    package_data,
    package_status_history_data,
    storage_location_data,
    storage_location_history_data,
)
from app.database.session import get_db
from app.schemas import (
    PackageDeplete,
    PackageGiveAway,
    PackageMove,
    StorageLocationCreate,
    StorageLocationUpdate,
)
from app.services.errors import BusinessRuleError
from app.services.inventory import (
    archive_storage_location,
    create_storage_location,
    deplete_package,
    get_package_status_history,
    get_package_storage_history,
    get_storage_location,
    give_away_package,
    list_storage_locations,
    move_package,
    restore_storage_location,
    update_storage_location,
)

router = APIRouter(tags=["inventory"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/storage-locations")
def list_storage_locations_endpoint(
    db: DBSession,
    include_archived: bool = False,
) -> dict[str, object]:
    locations = list_storage_locations(db, include_archived=include_archived)
    return success([storage_location_data(location) for location in locations])


@router.post("/storage-locations", status_code=201)
def create_storage_location_endpoint(
    data: StorageLocationCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        location = create_storage_location(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(storage_location_data(location))


@router.get("/storage-locations/{storage_location_id}")
def get_storage_location_endpoint(
    storage_location_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        location = get_storage_location(db, storage_location_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(storage_location_data(location))


@router.patch("/storage-locations/{storage_location_id}")
def update_storage_location_endpoint(
    storage_location_id: UUID,
    data: StorageLocationUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        location = update_storage_location(db, storage_location_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(storage_location_data(location))


@router.post("/storage-locations/{storage_location_id}/archive")
def archive_storage_location_endpoint(
    storage_location_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        location = archive_storage_location(db, storage_location_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(storage_location_data(location))


@router.post("/storage-locations/{storage_location_id}/restore")
def restore_storage_location_endpoint(
    storage_location_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        location = restore_storage_location(db, storage_location_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(storage_location_data(location))


@router.post("/packages/{package_id}/move")
def move_package_endpoint(
    package_id: UUID,
    data: PackageMove,
    db: DBSession,
) -> dict[str, object]:
    try:
        package = move_package(db, package_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_data(package))


@router.post("/packages/{package_id}/give-away")
def give_away_package_endpoint(
    package_id: UUID,
    data: PackageGiveAway,
    db: DBSession,
) -> dict[str, object]:
    try:
        package = give_away_package(db, package_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_data(package))


@router.post("/packages/{package_id}/deplete")
def deplete_package_endpoint(
    package_id: UUID,
    data: PackageDeplete,
    db: DBSession,
) -> dict[str, object]:
    try:
        package = deplete_package(db, package_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_data(package))


@router.get("/packages/{package_id}/storage-history")
def get_package_storage_history_endpoint(
    package_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        history = get_package_storage_history(db, package_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([storage_location_history_data(entry) for entry in history])


@router.get("/packages/{package_id}/status-history")
def get_package_status_history_endpoint(
    package_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        history = get_package_status_history(db, package_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([package_status_history_data(entry) for entry in history])

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import storage_location_data
from app.database.session import get_db
from app.schemas import StorageLocationCreate, StorageLocationUpdate
from app.services.errors import BusinessRuleError
from app.services.inventory import (
    archive_storage_location,
    create_storage_location,
    get_storage_location,
    list_storage_locations,
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

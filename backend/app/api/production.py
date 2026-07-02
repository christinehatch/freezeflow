from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import empty_success, raise_api_error, success
from app.api.serializers import production_batch_data, tray_data
from app.database.session import get_db
from app.schemas import (
    ProductionBatchCreate,
    ProductionBatchUpdate,
    TrayCreate,
    TrayUpdate,
)
from app.services.errors import BusinessRuleError
from app.services.production import (
    add_tray_to_batch,
    cancel_production_batch,
    create_production_batch,
    delete_tray,
    get_production_batch,
    get_tray,
    list_production_batches,
    start_production_batch,
    update_production_batch,
    update_tray,
)

router = APIRouter(tags=["production"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/production-batches")
def list_production_batches_endpoint(db: DBSession) -> dict[str, object]:
    batches = list_production_batches(db)
    return success([production_batch_data(batch) for batch in batches])


@router.post("/production-batches", status_code=201)
def create_production_batch_endpoint(
    data: ProductionBatchCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = create_production_batch(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.get("/production-batches/{batch_id}")
def get_production_batch_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = get_production_batch(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.patch("/production-batches/{batch_id}")
def update_production_batch_endpoint(
    batch_id: UUID,
    data: ProductionBatchUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = update_production_batch(db, batch_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.post("/production-batches/{batch_id}/start")
def start_production_batch_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = start_production_batch(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.post("/production-batches/{batch_id}/cancel")
def cancel_production_batch_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = cancel_production_batch(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.post("/production-batches/{batch_id}/trays", status_code=201)
def add_tray_to_batch_endpoint(
    batch_id: UUID,
    data: TrayCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = add_tray_to_batch(db, batch_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(get_tray(db, tray.id)))


@router.get("/trays/{tray_id}")
def get_tray_endpoint(
    tray_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = get_tray(db, tray_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.patch("/trays/{tray_id}")
def update_tray_endpoint(
    tray_id: UUID,
    data: TrayUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = update_tray(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.delete("/trays/{tray_id}")
def delete_tray_endpoint(
    tray_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        delete_tray(db, tray_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return empty_success()

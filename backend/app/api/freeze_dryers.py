from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import freeze_dryer_data, physical_tray_data, tray_slot_data
from app.database.session import get_db
from app.schemas import (
    FreezeDryerCreate,
    FreezeDryerUpdate,
    PhysicalTrayCreate,
    PhysicalTrayUpdate,
)
from app.services.errors import BusinessRuleError
from app.services.freeze_dryers import (
    create_freeze_dryer,
    create_physical_tray,
    list_freeze_dryers,
    list_physical_trays,
    list_tray_slots,
    update_freeze_dryer,
    update_physical_tray,
)

router = APIRouter(prefix="/freeze-dryers", tags=["freeze dryers"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("")
def list_freeze_dryers_endpoint(db: DBSession) -> dict[str, object]:
    freeze_dryers = list_freeze_dryers(db)
    return success([freeze_dryer_data(freeze_dryer) for freeze_dryer in freeze_dryers])


@router.post("", status_code=201)
def create_freeze_dryer_endpoint(
    data: FreezeDryerCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        freeze_dryer = create_freeze_dryer(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(freeze_dryer_data(freeze_dryer))


@router.patch("/{freeze_dryer_id}")
def update_freeze_dryer_endpoint(
    freeze_dryer_id: UUID,
    data: FreezeDryerUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        freeze_dryer = update_freeze_dryer(db, freeze_dryer_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(freeze_dryer_data(freeze_dryer))


@router.get("/{freeze_dryer_id}/tray-slots")
def list_tray_slots_endpoint(
    freeze_dryer_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray_slots = list_tray_slots(db, freeze_dryer_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([tray_slot_data(tray_slot) for tray_slot in tray_slots])


physical_trays_router = APIRouter(prefix="/physical-trays", tags=["physical trays"])


@physical_trays_router.get("")
def list_physical_trays_endpoint(db: DBSession) -> dict[str, object]:
    physical_trays = list_physical_trays(db)
    return success(
        [physical_tray_data(physical_tray) for physical_tray in physical_trays]
    )


@physical_trays_router.post("", status_code=201)
def create_physical_tray_endpoint(
    data: PhysicalTrayCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        physical_tray = create_physical_tray(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(physical_tray_data(physical_tray))


@physical_trays_router.patch("/{physical_tray_id}")
def update_physical_tray_endpoint(
    physical_tray_id: UUID,
    data: PhysicalTrayUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        physical_tray = update_physical_tray(db, physical_tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(physical_tray_data(physical_tray))

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import freeze_dryer_data
from app.database.session import get_db
from app.schemas import FreezeDryerCreate, FreezeDryerUpdate
from app.services.errors import BusinessRuleError
from app.services.freeze_dryers import (
    create_freeze_dryer,
    list_freeze_dryers,
    update_freeze_dryer,
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

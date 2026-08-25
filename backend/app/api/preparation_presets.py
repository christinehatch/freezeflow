from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import preparation_preset_data
from app.database.session import get_db
from app.schemas import PreparationPresetCreate, PreparationPresetUpdate
from app.services.errors import BusinessRuleError
from app.services.preparation_presets import (
    archive_preparation_preset,
    create_preparation_preset,
    get_preparation_preset,
    list_preparation_presets,
    list_preparation_suggestions,
    restore_preparation_preset,
    update_preparation_preset,
)

router = APIRouter(tags=["preparation-presets"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/preparation-presets")
def list_preparation_presets_endpoint(
    db: DBSession,
    include_archived: bool = False,
) -> dict[str, object]:
    presets = list_preparation_presets(db, include_archived=include_archived)
    return success([preparation_preset_data(preset) for preset in presets])


@router.post("/preparation-presets", status_code=201)
def create_preparation_preset_endpoint(
    data: PreparationPresetCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        preset = create_preparation_preset(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(preparation_preset_data(preset))


@router.get("/preparation-presets/suggestions")
def list_preparation_suggestions_endpoint(
    db: DBSession,
    field: str,
) -> dict[str, object]:
    try:
        values = list_preparation_suggestions(db, field)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(values)


@router.get("/preparation-presets/{preparation_preset_id}")
def get_preparation_preset_endpoint(
    preparation_preset_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        preset = get_preparation_preset(db, preparation_preset_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(preparation_preset_data(preset))


@router.patch("/preparation-presets/{preparation_preset_id}")
def update_preparation_preset_endpoint(
    preparation_preset_id: UUID,
    data: PreparationPresetUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        preset = update_preparation_preset(db, preparation_preset_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(preparation_preset_data(preset))


@router.post("/preparation-presets/{preparation_preset_id}/archive")
def archive_preparation_preset_endpoint(
    preparation_preset_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        preset = archive_preparation_preset(db, preparation_preset_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(preparation_preset_data(preset))


@router.post("/preparation-presets/{preparation_preset_id}/restore")
def restore_preparation_preset_endpoint(
    preparation_preset_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        preset = restore_preparation_preset(db, preparation_preset_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(preparation_preset_data(preset))

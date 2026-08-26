from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import empty_success, raise_api_error, success
from app.api.serializers import (
    drying_run_data,
    production_batch_data,
    tray_data,
    weight_check_data,
)
from app.database.session import get_db
from app.schemas import (
    DryingRunComplete,
    DryingRunStart,
    DryingRunTimestampCorrection,
    DryingRunVoid,
    ProductionBatchCreate,
    ProductionBatchNotesCorrection,
    ProductionBatchStart,
    ProductionBatchUpdate,
    TrayComplete,
    TrayCreate,
    TrayFinalDryWeightCorrection,
    TrayNotesCorrection,
    TrayPreparationCorrection,
    TrayStartingWeightCorrection,
    TrayStartingWeightUpdate,
    TrayUpdate,
    WeightCheckCorrection,
    WeightCheckCreate,
)
from app.services.errors import BusinessRuleError
from app.services.production import (
    add_tray_to_batch,
    cancel_production_batch,
    complete_drying_run,
    complete_production_batch,
    complete_tray,
    correct_drying_run_timestamps,
    correct_production_batch_notes,
    correct_tray_final_dry_weight,
    correct_tray_notes,
    correct_tray_preparation_metadata,
    correct_tray_starting_weight,
    correct_weight_check,
    create_production_batch,
    delete_tray,
    get_production_batch,
    get_tray,
    list_drying_runs,
    list_production_batches,
    list_weight_checks,
    record_starting_weight,
    record_weight_check,
    start_drying_run,
    start_production_batch,
    update_production_batch,
    update_tray,
    void_drying_run,
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
    data: ProductionBatchStart | None = None,
) -> dict[str, object]:
    try:
        batch = start_production_batch(db, batch_id, data)
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


@router.post("/production-batches/{batch_id}/complete")
def complete_production_batch_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = complete_production_batch(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.get("/production-batches/{batch_id}/drying-runs")
def list_drying_runs_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        drying_runs = list_drying_runs(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([drying_run_data(drying_run) for drying_run in drying_runs])


@router.post("/production-batches/{batch_id}/drying-runs", status_code=201)
def start_drying_run_endpoint(
    batch_id: UUID,
    data: DryingRunStart,
    db: DBSession,
) -> dict[str, object]:
    try:
        drying_run = start_drying_run(db, batch_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(drying_run_data(drying_run))


@router.post("/drying-runs/{drying_run_id}/complete")
def complete_drying_run_endpoint(
    drying_run_id: UUID,
    db: DBSession,
    data: DryingRunComplete | None = None,
) -> dict[str, object]:
    try:
        drying_run = complete_drying_run(
            db,
            drying_run_id,
            data or DryingRunComplete(),
        )
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(drying_run_data(drying_run))


@router.post("/drying-runs/{drying_run_id}/void")
def void_drying_run_endpoint(
    drying_run_id: UUID,
    data: DryingRunVoid,
    db: DBSession,
) -> dict[str, object]:
    try:
        drying_run = void_drying_run(db, drying_run_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(drying_run_data(drying_run))


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


@router.post("/trays/{tray_id}/starting-weight")
def record_starting_weight_endpoint(
    tray_id: UUID,
    data: TrayStartingWeightUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = record_starting_weight(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.post("/trays/{tray_id}/weight-checks", status_code=201)
def record_weight_check_endpoint(
    tray_id: UUID,
    data: WeightCheckCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        weight_check = record_weight_check(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(weight_check_data(weight_check))


@router.get("/trays/{tray_id}/weight-checks")
def list_weight_checks_endpoint(
    tray_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        weight_checks = list_weight_checks(db, tray_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([weight_check_data(weight_check) for weight_check in weight_checks])


@router.post("/weight-checks/{weight_check_id}/correct")
def correct_weight_check_endpoint(
    weight_check_id: UUID,
    data: WeightCheckCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        weight_check = correct_weight_check(db, weight_check_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(weight_check_data(weight_check))


@router.post("/trays/{tray_id}/correct-notes")
def correct_tray_notes_endpoint(
    tray_id: UUID,
    data: TrayNotesCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = correct_tray_notes(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.post("/trays/{tray_id}/correct-preparation")
def correct_tray_preparation_endpoint(
    tray_id: UUID,
    data: TrayPreparationCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = correct_tray_preparation_metadata(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.post("/trays/{tray_id}/correct-starting-weight")
def correct_tray_starting_weight_endpoint(
    tray_id: UUID,
    data: TrayStartingWeightCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = correct_tray_starting_weight(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.post("/trays/{tray_id}/correct-final-dry-weight")
def correct_tray_final_dry_weight_endpoint(
    tray_id: UUID,
    data: TrayFinalDryWeightCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = correct_tray_final_dry_weight(db, tray_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(tray_data(tray))


@router.post("/production-batches/{batch_id}/correct-notes")
def correct_production_batch_notes_endpoint(
    batch_id: UUID,
    data: ProductionBatchNotesCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        batch = correct_production_batch_notes(db, batch_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(production_batch_data(batch))


@router.post("/drying-runs/{drying_run_id}/correct-timestamps")
def correct_drying_run_timestamps_endpoint(
    drying_run_id: UUID,
    data: DryingRunTimestampCorrection,
    db: DBSession,
) -> dict[str, object]:
    try:
        drying_run = correct_drying_run_timestamps(db, drying_run_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(drying_run_data(drying_run))


@router.post("/trays/{tray_id}/complete")
def complete_tray_endpoint(
    tray_id: UUID,
    data: TrayComplete,
    db: DBSession,
) -> dict[str, object]:
    try:
        tray = complete_tray(db, tray_id, data)
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

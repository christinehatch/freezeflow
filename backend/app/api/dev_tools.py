from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import success
from app.database.session import get_db
from app.schemas.dev_tools import DevToolResult, RandomBatchRequest
from app.services.dev_tools import DeveloperDataService

router = APIRouter(prefix="/dev", tags=["developer-tools"])
DBSession = Annotated[Session, Depends(get_db)]


def run_action(db: Session, action: str) -> dict:
    result = DeveloperDataService(db).run(action)
    return success(DevToolResult(**result))


@router.post("/reset")
def reset_database(db: DBSession) -> dict:
    return run_action(db, "reset")


@router.post("/demo/basic")
def seed_basic_demo(db: DBSession) -> dict:
    return run_action(db, "basic")


@router.post("/demo/busy-production-day")
def seed_busy_production_day(db: DBSession) -> dict:
    return run_action(db, "busy-production-day")


@router.post("/demo/empty")
def seed_empty_database(db: DBSession) -> dict:
    return run_action(db, "empty")


@router.post("/demo/inventory")
def seed_inventory(db: DBSession) -> dict:
    return run_action(db, "inventory")


@router.post("/demo/packaging")
def seed_packaging(db: DBSession) -> dict:
    return run_action(db, "packaging")


@router.post("/demo/weight-history")
def seed_weight_history(db: DBSession) -> dict:
    return run_action(db, "weight-history")


@router.post("/demo/random-batches")
def seed_random_batches(
    body: RandomBatchRequest,
    db: DBSession,
) -> dict:
    service = DeveloperDataService(db)
    result = service.seed_random_batches(body.count)
    return success(DevToolResult(**result))


@router.post("/demo/edge-cases")
def seed_edge_cases(db: DBSession) -> dict:
    return run_action(db, "edge-cases")


@router.post("/randomize/dates")
def randomize_dates(db: DBSession) -> dict:
    return run_action(db, "randomize-dates")


@router.post("/randomize/weights")
def randomize_weights(db: DBSession) -> dict:
    return run_action(db, "randomize-weights")

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.responses import success
from app.database.session import get_db
from app.schemas import ReportFilters
from app.services import reports

router = APIRouter(tags=["reports"], prefix="/reports")
DBSession = Annotated[Session, Depends(get_db)]
Filters = Annotated[ReportFilters, Query()]


@router.get("/freeze-dryer-performance")
def freeze_dryer_performance_endpoint(
    db: DBSession, filters: Filters
) -> dict[str, object]:
    return success(reports.freeze_dryer_performance(db, filters))


@router.get("/product-history")
def product_history_endpoint(db: DBSession, filters: Filters) -> dict[str, object]:
    return success(reports.product_history(db, filters))


@router.get("/preparation-history")
def preparation_history_endpoint(db: DBSession, filters: Filters) -> dict[str, object]:
    return success(reports.preparation_history(db, filters))


@router.get("/drying-time")
def drying_time_endpoint(db: DBSession, filters: Filters) -> dict[str, object]:
    return success(reports.drying_time(db, filters))


@router.get("/production-history")
def production_history_endpoint(db: DBSession, filters: Filters) -> dict[str, object]:
    return success(reports.production_history(db, filters))


@router.get("/inventory-summary")
def inventory_summary_endpoint(db: DBSession, filters: Filters) -> dict[str, object]:
    return success(reports.inventory_summary(db, filters))


@router.get("/product-names")
def product_names_endpoint(db: DBSession) -> dict[str, object]:
    return success(reports.list_report_product_names(db))

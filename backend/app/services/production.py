from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    FreezeDryer,
    ProductionBatch,
    ProductionBatchStatus,
    Recipe,
    Tray,
    TrayStatus,
)
from app.repositories import production_batch_repository, tray_repository
from app.schemas import (
    ProductionBatchCreate,
    ProductionBatchUpdate,
    TrayCreate,
    TrayUpdate,
)
from app.services.errors import BusinessRuleError


def list_production_batches(db: Session) -> list[ProductionBatch]:
    return list(
        db.scalars(
            select(ProductionBatch).options(
                selectinload(ProductionBatch.freeze_dryer),
                selectinload(ProductionBatch.trays),
            )
        ).all()
    )


def get_production_batch(db: Session, batch_id: UUID) -> ProductionBatch:
    batch = db.scalar(
        select(ProductionBatch)
        .where(ProductionBatch.id == batch_id)
        .options(
            selectinload(ProductionBatch.freeze_dryer),
            selectinload(ProductionBatch.trays).selectinload(Tray.recipe),
        )
    )
    if batch is None:
        raise BusinessRuleError("Production Batch was not found.", status_code=404)
    return batch


def create_production_batch(
    db: Session,
    data: ProductionBatchCreate,
) -> ProductionBatch:
    freeze_dryer = _get_freeze_dryer(db, data.freeze_dryer_id)
    if freeze_dryer.archived:
        raise BusinessRuleError("Archived Freeze Dryers cannot be selected.")

    batch = production_batch_repository.create(
        db,
        {
            "freeze_dryer_id": data.freeze_dryer_id,
            "batch_number": data.batch_number,
            "notes": data.notes,
            "status": ProductionBatchStatus.DRAFT,
        },
    )
    db.commit()
    return get_production_batch(db, batch.id)


def update_production_batch(
    db: Session,
    batch_id: UUID,
    data: ProductionBatchUpdate,
) -> ProductionBatch:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Only Draft Production Batches may be edited.")

    values: dict[str, object] = {}
    if data.freeze_dryer_id is not None:
        freeze_dryer = _get_freeze_dryer(db, data.freeze_dryer_id)
        if freeze_dryer.archived:
            raise BusinessRuleError("Archived Freeze Dryers cannot be selected.")
        values["freeze_dryer_id"] = data.freeze_dryer_id
    if data.notes is not None:
        values["notes"] = data.notes

    updated = production_batch_repository.update(db, batch, values)
    db.commit()
    return get_production_batch(db, updated.id)


def start_production_batch(db: Session, batch_id: UUID) -> ProductionBatch:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Only Draft Production Batches may be started.")
    if len(batch.trays) == 0:
        raise BusinessRuleError(
            "A Production Batch must contain at least one Tray before it can start."
        )
    if batch.freeze_dryer.archived:
        raise BusinessRuleError("Archived Freeze Dryers cannot start production.")
    if _has_other_running_batch(db, batch.freeze_dryer_id, batch.id):
        raise BusinessRuleError(
            "This Freeze Dryer already has a Running Production Batch."
        )

    batch.status = ProductionBatchStatus.RUNNING
    batch.started_at = datetime.now(UTC)
    for tray in batch.trays:
        if tray.status == TrayStatus.DRAFT:
            tray.status = TrayStatus.RUNNING
    db.add(batch)
    db.commit()
    return get_production_batch(db, batch.id)


def cancel_production_batch(db: Session, batch_id: UUID) -> ProductionBatch:
    batch = get_production_batch(db, batch_id)
    if batch.status == ProductionBatchStatus.COMPLETED:
        raise BusinessRuleError("Completed Production Batches cannot be cancelled.")
    if batch.status == ProductionBatchStatus.CANCELLED:
        raise BusinessRuleError(
            "Cancelled Production Batches cannot be cancelled again."
        )

    batch.status = ProductionBatchStatus.CANCELLED
    db.add(batch)
    db.commit()
    return get_production_batch(db, batch.id)


def add_tray_to_batch(db: Session, batch_id: UUID, data: TrayCreate) -> Tray:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Trays may only be added to Draft Production Batches.")

    if _tray_number_exists(db, batch.id, data.tray_number):
        raise BusinessRuleError("Tray number already exists in this Production Batch.")

    values = _tray_create_values(db, batch.id, data)
    tray = tray_repository.create(db, values)
    db.commit()
    db.refresh(tray)
    return tray


def get_tray(db: Session, tray_id: UUID) -> Tray:
    tray = db.scalar(
        select(Tray)
        .where(Tray.id == tray_id)
        .options(
            selectinload(Tray.production_batch).selectinload(
                ProductionBatch.freeze_dryer
            ),
            selectinload(Tray.recipe),
        )
    )
    if tray is None:
        raise BusinessRuleError("Tray was not found.", status_code=404)
    return tray


def update_tray(db: Session, tray_id: UUID, data: TrayUpdate) -> Tray:
    tray = get_tray(db, tray_id)
    if tray.status != TrayStatus.DRAFT:
        raise BusinessRuleError("Only Draft Trays may be edited.")
    if tray.production_batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Tray setup is locked after Production starts.")

    values: dict[str, object] = {}
    if data.tray_number is not None and data.tray_number != tray.tray_number:
        if _tray_number_exists(
            db, tray.production_batch_id, data.tray_number, current_id=tray.id
        ):
            raise BusinessRuleError(
                "Tray number already exists in this Production Batch."
            )
        values["tray_number"] = data.tray_number
    if data.product_name is not None:
        values["product_name"] = data.product_name
    if data.preparation is not None:
        values["preparation"] = data.preparation
    if data.notes is not None:
        values["notes"] = data.notes

    updated = tray_repository.update(db, tray, values)
    db.commit()
    return get_tray(db, updated.id)


def delete_tray(db: Session, tray_id: UUID) -> None:
    tray = get_tray(db, tray_id)
    if tray.status != TrayStatus.DRAFT:
        raise BusinessRuleError("Only Draft Trays may be deleted.")
    if tray.production_batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Tray setup is locked after Production starts.")

    tray_repository.delete(db, tray)
    db.commit()


def _get_freeze_dryer(db: Session, freeze_dryer_id: UUID) -> FreezeDryer:
    freeze_dryer = db.get(FreezeDryer, freeze_dryer_id)
    if freeze_dryer is None:
        raise BusinessRuleError("Freeze Dryer was not found.", status_code=404)
    return freeze_dryer


def _tray_create_values(
    db: Session,
    batch_id: UUID,
    data: TrayCreate,
) -> dict[str, object]:
    product_name = data.product_name
    preparation = data.preparation

    if data.recipe_id is not None:
        recipe = db.get(Recipe, data.recipe_id)
        if recipe is None:
            raise BusinessRuleError("Recipe was not found.", status_code=404)
        if recipe.archived:
            raise BusinessRuleError(
                "Archived Recipes cannot be selected for new Trays."
            )
        product_name = recipe.product_name
        preparation = recipe.preparation
    elif product_name is None or preparation is None:
        raise BusinessRuleError(
            "Product Name and Preparation are required when no Recipe is selected."
        )

    return {
        "production_batch_id": batch_id,
        "tray_number": data.tray_number,
        "recipe_id": data.recipe_id,
        "product_name": product_name,
        "preparation": preparation,
        "notes": data.notes,
        "status": TrayStatus.DRAFT,
    }


def _tray_number_exists(
    db: Session,
    batch_id: UUID,
    tray_number: int,
    *,
    current_id: UUID | None = None,
) -> bool:
    existing = db.scalar(
        select(Tray).where(
            Tray.production_batch_id == batch_id,
            Tray.tray_number == tray_number,
        )
    )
    return existing is not None and existing.id != current_id


def _has_other_running_batch(
    db: Session,
    freeze_dryer_id: UUID,
    batch_id: UUID,
) -> bool:
    existing = db.scalar(
        select(ProductionBatch).where(
            ProductionBatch.freeze_dryer_id == freeze_dryer_id,
            ProductionBatch.status == ProductionBatchStatus.RUNNING,
            ProductionBatch.id != batch_id,
        )
    )
    return existing is not None

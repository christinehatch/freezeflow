from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    DryingRun,
    DryingRunStatus,
    FreezeDryer,
    Package,
    PackagingOperation,
    PackagingOperationTray,
    PhysicalTray,
    ProductionBatch,
    ProductionBatchStatus,
    Recipe,
    Tray,
    TraySlot,
    TrayStatus,
    WeightCheck,
)
from app.repositories import (
    drying_run_repository,
    production_batch_repository,
    tray_repository,
    weight_check_repository,
)
from app.schemas import (
    DryingRunComplete,
    DryingRunStart,
    DryingRunVoid,
    ProductionBatchCreate,
    ProductionBatchStart,
    ProductionBatchUpdate,
    TrayComplete,
    TrayCreate,
    TrayStartingWeightUpdate,
    TrayUpdate,
    WeightCheckCreate,
)
from app.services.errors import BusinessRuleError


def list_production_batches(db: Session) -> list[ProductionBatch]:
    return list(
        db.scalars(
            select(ProductionBatch).options(
                selectinload(ProductionBatch.freeze_dryer).selectinload(
                    FreezeDryer.tray_slots
                ),
                selectinload(ProductionBatch.trays).selectinload(Tray.recipe),
                selectinload(ProductionBatch.trays).selectinload(Tray.tray_slot),
                selectinload(ProductionBatch.trays).selectinload(Tray.physical_tray),
                selectinload(ProductionBatch.trays).selectinload(Tray.weight_checks),
                selectinload(ProductionBatch.drying_runs),
            )
        ).all()
    )


def get_production_batch(db: Session, batch_id: UUID) -> ProductionBatch:
    batch = db.scalar(
        select(ProductionBatch)
        .where(ProductionBatch.id == batch_id)
        .options(
            selectinload(ProductionBatch.freeze_dryer).selectinload(
                FreezeDryer.tray_slots
            ),
            selectinload(ProductionBatch.trays).selectinload(Tray.recipe),
            selectinload(ProductionBatch.trays).selectinload(Tray.tray_slot),
            selectinload(ProductionBatch.trays).selectinload(Tray.physical_tray),
            selectinload(ProductionBatch.trays).selectinload(Tray.weight_checks),
            selectinload(ProductionBatch.drying_runs),
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
        if batch.trays:
            raise BusinessRuleError(
                "Freeze Dryer cannot be changed after Trays have been selected."
            )
        freeze_dryer = _get_freeze_dryer(db, data.freeze_dryer_id)
        if freeze_dryer.archived:
            raise BusinessRuleError("Archived Freeze Dryers cannot be selected.")
        values["freeze_dryer_id"] = data.freeze_dryer_id
    if data.notes is not None:
        values["notes"] = data.notes

    updated = production_batch_repository.update(db, batch, values)
    db.commit()
    return get_production_batch(db, updated.id)


def start_production_batch(
    db: Session,
    batch_id: UUID,
    data: ProductionBatchStart | None = None,
) -> ProductionBatch:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Only Draft Production Batches may be started.")
    if len(batch.trays) == 0:
        raise BusinessRuleError(
            "A Production Batch must contain at least one Tray before it can start."
        )
    if batch.freeze_dryer.archived:
        raise BusinessRuleError("Archived Freeze Dryers cannot start production.")
    missing_weight_slots = [
        tray.tray_slot.slot_number
        for tray in batch.trays
        if tray.starting_weight_grams is None
    ]
    if missing_weight_slots:
        raise BusinessRuleError(
            "Every Tray must have a Starting Weight before Production can start."
        )
    if _has_other_running_batch(db, batch.freeze_dryer_id, batch.id):
        raise BusinessRuleError(
            "This Freeze Dryer already has a Running Production Batch."
        )

    started_at = data.started_at if data and data.started_at else datetime.now(UTC)
    batch.status = ProductionBatchStatus.RUNNING
    batch.started_at = started_at
    for tray in batch.trays:
        if tray.status == TrayStatus.DRAFT:
            tray.status = TrayStatus.RUNNING
    db.add(batch)
    db.add(
        DryingRun(
            production_batch_id=batch.id,
            status=DryingRunStatus.ACTIVE,
            started_at=started_at,
        )
    )
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


def complete_production_batch(db: Session, batch_id: UUID) -> ProductionBatch:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.RUNNING:
        raise BusinessRuleError("Only Running Production Batches may be completed.")
    if any(tray.status != TrayStatus.COMPLETED for tray in batch.trays):
        raise BusinessRuleError(
            "Every Tray must be Complete before the Production Batch can complete."
        )
    if _active_drying_run(db, batch.id) is not None:
        raise BusinessRuleError(
            "The current Drying Run must be complete before the Batch can complete."
        )

    batch.status = ProductionBatchStatus.COMPLETED
    batch.completed_at = datetime.now(UTC)
    db.add(batch)
    db.commit()
    return get_production_batch(db, batch.id)


def add_tray_to_batch(db: Session, batch_id: UUID, data: TrayCreate) -> Tray:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.DRAFT:
        raise BusinessRuleError("Trays may only be added to Draft Production Batches.")

    _validate_tray_selection(
        db,
        batch,
        data.tray_slot_id,
        data.physical_tray_id,
    )

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
            selectinload(Tray.tray_slot),
            selectinload(Tray.physical_tray),
            selectinload(Tray.weight_checks).selectinload(WeightCheck.drying_run),
            selectinload(Tray.packaging_operation_link)
            .selectinload(PackagingOperationTray.packaging_operation)
            .selectinload(PackagingOperation.packages)
            .selectinload(Package.package_type),
            selectinload(Tray.packaging_operation_link)
            .selectinload(PackagingOperationTray.packaging_operation)
            .selectinload(PackagingOperation.packages)
            .selectinload(Package.storage_location),
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
    if data.tray_slot_id is not None and data.tray_slot_id != tray.tray_slot_id:
        _validate_tray_slot(
            db,
            tray.production_batch,
            data.tray_slot_id,
            current_id=tray.id,
        )
        tray_slot = _get_tray_slot(db, data.tray_slot_id)
        values["tray_slot_id"] = data.tray_slot_id
        values["tray_number"] = tray_slot.slot_number
    if (
        data.physical_tray_id is not None
        and data.physical_tray_id != tray.physical_tray_id
    ):
        _validate_physical_tray(
            db,
            tray.production_batch.id,
            data.physical_tray_id,
            current_id=tray.id,
        )
        values["physical_tray_id"] = data.physical_tray_id
    if data.product_name is not None:
        values["product_name"] = data.product_name
    if data.preparation is not None:
        values["preparation"] = data.preparation
    if data.starting_weight_grams is not None:
        values["starting_weight_grams"] = data.starting_weight_grams
    if data.notes is not None:
        values["notes"] = data.notes

    updated = tray_repository.update(db, tray, values)
    db.commit()
    return get_tray(db, updated.id)


def record_starting_weight(
    db: Session,
    tray_id: UUID,
    data: TrayStartingWeightUpdate,
) -> Tray:
    tray = get_tray(db, tray_id)
    is_draft_setup = (
        tray.status == TrayStatus.DRAFT
        and tray.production_batch.status == ProductionBatchStatus.DRAFT
    )
    is_missing_running_starting_weight = (
        tray.status == TrayStatus.RUNNING
        and tray.production_batch.status == ProductionBatchStatus.RUNNING
        and tray.starting_weight_grams is None
        and len(tray.weight_checks) == 0
    )
    if not is_draft_setup and not is_missing_running_starting_weight:
        raise BusinessRuleError(
            "Starting Weight may only be recorded before Production starts."
        )

    tray.starting_weight_grams = data.starting_weight_grams
    db.add(tray)
    db.commit()
    return get_tray(db, tray.id)


def start_drying_run(
    db: Session,
    batch_id: UUID,
    data: DryingRunStart,
) -> DryingRun:
    batch = get_production_batch(db, batch_id)
    if batch.status != ProductionBatchStatus.RUNNING:
        raise BusinessRuleError("Drying Runs may only start for Running Batches.")
    if _active_drying_run(db, batch.id) is not None:
        raise BusinessRuleError("A Drying Run is already Active for this Batch.")
    running_trays = [
        tray for tray in batch.trays if tray.status == TrayStatus.RUNNING
    ]
    if not running_trays:
        raise BusinessRuleError("At least one Tray must still be Running.")
    if any(tray.starting_weight_grams is None for tray in running_trays):
        raise BusinessRuleError(
            "Every Running Tray must have a Starting Weight before another "
            "Drying Run can start."
        )

    latest_completed_run = _latest_completed_non_voided_run(db, batch.id)
    if latest_completed_run is not None:
        missing_trays = _running_trays_missing_weight_check(
            db,
            running_trays,
            latest_completed_run.id,
        )
        if missing_trays:
            raise BusinessRuleError(
                "Every Running Tray must have a Weight Check before another "
                "Drying Run can start."
            )

    drying_run = drying_run_repository.create(
        db,
        {
            "production_batch_id": batch.id,
            "status": DryingRunStatus.ACTIVE,
            "started_at": data.started_at or datetime.now(UTC),
            "notes": data.notes,
        },
    )
    db.commit()
    return get_drying_run(db, drying_run.id)


def complete_drying_run(
    db: Session,
    drying_run_id: UUID,
    data: DryingRunComplete,
) -> DryingRun:
    drying_run = get_drying_run(db, drying_run_id)
    if drying_run.status != DryingRunStatus.ACTIVE:
        raise BusinessRuleError("Only Active Drying Runs may be completed.")
    if drying_run.production_batch.status != ProductionBatchStatus.RUNNING:
        raise BusinessRuleError("The Production Batch must be Running.")

    drying_run.status = DryingRunStatus.COMPLETE
    drying_run.ended_at = data.ended_at or datetime.now(UTC)
    if data.notes is not None:
        drying_run.notes = data.notes
    db.add(drying_run)
    db.commit()
    return get_drying_run(db, drying_run.id)


def void_drying_run(
    db: Session,
    drying_run_id: UUID,
    data: DryingRunVoid,
) -> DryingRun:
    drying_run = get_drying_run(db, drying_run_id)
    if drying_run.status == DryingRunStatus.VOIDED:
        raise BusinessRuleError("Drying Run is already Voided.")
    if drying_run.weight_checks:
        raise BusinessRuleError("Drying Runs with Weight Checks cannot be Voided.")

    drying_run.status = DryingRunStatus.VOIDED
    drying_run.notes = data.notes
    drying_run.ended_at = drying_run.ended_at or datetime.now(UTC)
    db.add(drying_run)
    db.commit()
    return get_drying_run(db, drying_run.id)


def list_drying_runs(db: Session, batch_id: UUID) -> list[DryingRun]:
    batch = get_production_batch(db, batch_id)
    return sorted(batch.drying_runs, key=lambda run: run.started_at)


def get_drying_run(db: Session, drying_run_id: UUID) -> DryingRun:
    drying_run = db.scalar(
        select(DryingRun)
        .where(DryingRun.id == drying_run_id)
        .options(
            selectinload(DryingRun.production_batch),
            selectinload(DryingRun.weight_checks),
        )
    )
    if drying_run is None:
        raise BusinessRuleError("Drying Run was not found.", status_code=404)
    return drying_run


def record_weight_check(
    db: Session,
    tray_id: UUID,
    data: WeightCheckCreate,
) -> WeightCheck:
    tray = get_tray(db, tray_id)
    if tray.status != TrayStatus.RUNNING:
        raise BusinessRuleError("Weight Checks may only be added to Running Trays.")
    drying_run = get_drying_run(db, data.drying_run_id)
    if drying_run.production_batch_id != tray.production_batch_id:
        raise BusinessRuleError("Drying Run does not belong to this Tray's Batch.")
    if drying_run.status != DryingRunStatus.COMPLETE:
        raise BusinessRuleError(
            "Weight Checks may only be recorded for a completed Drying Run."
        )
    if _active_drying_run(db, tray.production_batch_id) is not None:
        raise BusinessRuleError(
            "Weight Checks cannot be recorded while a Drying Run is Active."
        )
    if _non_voided_run_started_after(db, drying_run):
        raise BusinessRuleError(
            "Weight Checks cannot be recorded after another Drying Run starts."
        )
    if _weight_check_exists(db, tray.id, drying_run.id):
        raise BusinessRuleError(
            "This Tray already has a Weight Check for this Drying Run."
        )

    weight_check = weight_check_repository.create(
        db,
        {
            "tray_id": tray.id,
            "drying_run_id": drying_run.id,
            "weight_grams": data.weight_grams,
            "observed_at": data.observed_at,
            "notes": data.notes,
        },
    )
    db.commit()
    return get_weight_check(db, weight_check.id)


def list_weight_checks(db: Session, tray_id: UUID) -> list[WeightCheck]:
    tray = get_tray(db, tray_id)
    return sorted(tray.weight_checks, key=lambda check: check.observed_at)


def get_weight_check(db: Session, weight_check_id: UUID) -> WeightCheck:
    weight_check = db.scalar(
        select(WeightCheck)
        .where(WeightCheck.id == weight_check_id)
        .options(selectinload(WeightCheck.drying_run))
    )
    if weight_check is None:
        raise BusinessRuleError("Weight Check was not found.", status_code=404)
    return weight_check


def complete_tray(db: Session, tray_id: UUID, data: TrayComplete) -> Tray:
    tray = get_tray(db, tray_id)
    if tray.status != TrayStatus.RUNNING:
        raise BusinessRuleError("Only Running Trays may be completed.")
    if _active_drying_run(db, tray.production_batch_id) is not None:
        raise BusinessRuleError(
            "The current Drying Run must be complete before completing a Tray."
        )
    latest_completed_run = _latest_completed_non_voided_run(
        db,
        tray.production_batch_id,
    )
    if latest_completed_run is None or not _weight_check_exists(
        db,
        tray.id,
        latest_completed_run.id,
    ):
        raise BusinessRuleError(
            "Record a Weight Check for the latest Drying Run before completing "
            "this Tray."
        )

    tray.status = TrayStatus.COMPLETED
    tray.final_dry_weight_grams = data.final_dry_weight_grams
    tray.completed_at = datetime.now(UTC)
    db.add(tray)
    db.commit()
    return get_tray(db, tray.id)


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

    tray_slot = _get_tray_slot(db, data.tray_slot_id)

    return {
        "production_batch_id": batch_id,
        "tray_slot_id": data.tray_slot_id,
        "physical_tray_id": data.physical_tray_id,
        "tray_number": tray_slot.slot_number,
        "recipe_id": data.recipe_id,
        "product_name": product_name,
        "preparation": preparation,
        "starting_weight_grams": data.starting_weight_grams,
        "notes": data.notes,
        "status": TrayStatus.DRAFT,
    }


def _validate_tray_selection(
    db: Session,
    batch: ProductionBatch,
    tray_slot_id: UUID,
    physical_tray_id: UUID,
) -> None:
    active_slot_count = len(
        [slot for slot in batch.freeze_dryer.tray_slots if not slot.archived]
    )
    if len(batch.trays) >= active_slot_count:
        raise BusinessRuleError(
            "A Production Batch cannot contain more Trays than the "
            "Freeze Dryer's Tray Slot count."
        )

    _validate_tray_slot(db, batch, tray_slot_id)
    _validate_physical_tray(db, batch.id, physical_tray_id)


def _validate_tray_slot(
    db: Session,
    batch: ProductionBatch,
    tray_slot_id: UUID,
    *,
    current_id: UUID | None = None,
) -> None:
    tray_slot = _get_tray_slot(db, tray_slot_id)
    if tray_slot.freeze_dryer_id != batch.freeze_dryer_id:
        raise BusinessRuleError(
            "Tray Slot does not belong to this Production Batch's Freeze Dryer."
        )
    if tray_slot.archived:
        raise BusinessRuleError("Archived Tray Slots cannot be selected.")

    existing = db.scalar(
        select(Tray).where(
            Tray.production_batch_id == batch.id,
            Tray.tray_slot_id == tray_slot_id,
        )
    )
    if existing is not None and existing.id != current_id:
        raise BusinessRuleError("Tray Slot already selected in this Production Batch.")


def _validate_physical_tray(
    db: Session,
    batch_id: UUID,
    physical_tray_id: UUID,
    *,
    current_id: UUID | None = None,
) -> None:
    physical_tray = db.get(PhysicalTray, physical_tray_id)
    if physical_tray is None:
        raise BusinessRuleError("Physical Tray was not found.", status_code=404)
    if physical_tray.archived:
        raise BusinessRuleError("Archived Physical Trays cannot be selected.")

    existing = db.scalar(
        select(Tray)
        .join(ProductionBatch)
        .where(
            Tray.physical_tray_id == physical_tray_id,
            ProductionBatch.status.in_(
                [ProductionBatchStatus.DRAFT, ProductionBatchStatus.RUNNING]
            ),
            Tray.id != current_id,
        )
    )
    if existing is not None:
        raise BusinessRuleError(
            "Physical Tray already selected in a Draft or Running Production Batch."
        )


def _get_tray_slot(db: Session, tray_slot_id: UUID) -> TraySlot:
    tray_slot = db.get(TraySlot, tray_slot_id)
    if tray_slot is None:
        raise BusinessRuleError("Tray Slot was not found.", status_code=404)
    return tray_slot


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


def _active_drying_run(db: Session, batch_id: UUID) -> DryingRun | None:
    return db.scalar(
        select(DryingRun).where(
            DryingRun.production_batch_id == batch_id,
            DryingRun.status == DryingRunStatus.ACTIVE,
        )
    )


def _latest_completed_non_voided_run(
    db: Session,
    batch_id: UUID,
) -> DryingRun | None:
    return db.scalar(
        select(DryingRun)
        .where(
            DryingRun.production_batch_id == batch_id,
            DryingRun.status == DryingRunStatus.COMPLETE,
        )
        .order_by(DryingRun.started_at.desc())
        .limit(1)
    )


def _running_trays_missing_weight_check(
    db: Session,
    running_trays: list[Tray],
    drying_run_id: UUID,
) -> list[Tray]:
    missing: list[Tray] = []
    for tray in running_trays:
        if not _weight_check_exists(db, tray.id, drying_run_id):
            missing.append(tray)
    return missing


def _weight_check_exists(db: Session, tray_id: UUID, drying_run_id: UUID) -> bool:
    existing = db.scalar(
        select(WeightCheck).where(
            WeightCheck.tray_id == tray_id,
            WeightCheck.drying_run_id == drying_run_id,
        )
    )
    return existing is not None


def _non_voided_run_started_after(db: Session, drying_run: DryingRun) -> bool:
    existing = db.scalar(
        select(DryingRun).where(
            DryingRun.production_batch_id == drying_run.production_batch_id,
            DryingRun.status != DryingRunStatus.VOIDED,
            DryingRun.started_at > drying_run.started_at,
        )
    )
    return existing is not None

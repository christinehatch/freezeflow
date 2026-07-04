from decimal import Decimal

from app.models import (
    DryingRun,
    DryingRunStatus,
    FreezeDryer,
    PhysicalTray,
    ProductionBatch,
    Tray,
    TraySlot,
    WeightCheck,
)


def tray_slot_data(tray_slot: TraySlot) -> dict[str, object]:
    return {
        "id": tray_slot.id,
        "freeze_dryer_id": tray_slot.freeze_dryer_id,
        "slot_number": tray_slot.slot_number,
        "label": tray_slot.label,
        "archived": tray_slot.archived,
    }


def physical_tray_data(physical_tray: PhysicalTray) -> dict[str, object]:
    return {
        "id": physical_tray.id,
        "label": physical_tray.label,
        "tare_weight_grams": physical_tray.tare_weight_grams,
        "notes": physical_tray.notes,
        "archived": physical_tray.archived,
    }


def freeze_dryer_data(freeze_dryer: FreezeDryer) -> dict[str, object]:
    tray_slots = sorted(freeze_dryer.tray_slots, key=lambda slot: slot.slot_number)
    active_slots = [slot for slot in tray_slots if not slot.archived]
    return {
        "id": freeze_dryer.id,
        "name": freeze_dryer.name,
        "notes": freeze_dryer.notes,
        "archived": freeze_dryer.archived,
        "tray_slot_count": len(active_slots),
        "tray_slots": [tray_slot_data(slot) for slot in tray_slots],
    }


def tray_data(tray: Tray) -> dict[str, object]:
    weight_checks = sorted(tray.weight_checks, key=lambda check: check.observed_at)
    return {
        "id": tray.id,
        "production_batch_id": tray.production_batch_id,
        "tray_slot_id": tray.tray_slot_id,
        "tray_slot": tray_slot_data(tray.tray_slot),
        "physical_tray_id": tray.physical_tray_id,
        "physical_tray": physical_tray_data(tray.physical_tray),
        "recipe_id": tray.recipe_id,
        "recipe_name": tray.recipe.name if tray.recipe is not None else None,
        "product_name": tray.product_name,
        "preparation": tray.preparation,
        "starting_weight_grams": tray.starting_weight_grams,
        "final_dry_weight_grams": tray.final_dry_weight_grams,
        "completed_at": tray.completed_at,
        "notes": tray.notes,
        "status": tray.status,
        "weight_checks": [
            weight_check_data(weight_check) for weight_check in weight_checks
        ],
        "latest_weight_grams": _latest_weight(tray, weight_checks),
        "previous_weight_grams": _previous_weight(tray, weight_checks),
    }


def drying_run_data(drying_run: DryingRun) -> dict[str, object]:
    return {
        "id": drying_run.id,
        "production_batch_id": drying_run.production_batch_id,
        "status": drying_run.status,
        "started_at": drying_run.started_at,
        "ended_at": drying_run.ended_at,
        "notes": drying_run.notes,
        "created_at": drying_run.created_at,
        "updated_at": drying_run.updated_at,
        "duration_seconds": _drying_run_duration_seconds(drying_run),
    }


def weight_check_data(weight_check: WeightCheck) -> dict[str, object]:
    return {
        "id": weight_check.id,
        "tray_id": weight_check.tray_id,
        "drying_run_id": weight_check.drying_run_id,
        "weight_grams": weight_check.weight_grams,
        "observed_at": weight_check.observed_at,
        "recorded_at": weight_check.recorded_at,
        "notes": weight_check.notes,
    }


def production_batch_data(batch: ProductionBatch) -> dict[str, object]:
    drying_runs = sorted(batch.drying_runs, key=lambda run: run.started_at)
    return {
        "id": batch.id,
        "freeze_dryer_id": batch.freeze_dryer_id,
        "freeze_dryer": freeze_dryer_data(batch.freeze_dryer),
        "batch_number": batch.batch_number,
        "status": batch.status,
        "started_at": batch.started_at,
        "completed_at": batch.completed_at,
        "notes": batch.notes,
        "trays": [tray_data(tray) for tray in sorted(batch.trays, key=_tray_sort_key)],
        "drying_runs": [drying_run_data(drying_run) for drying_run in drying_runs],
        "total_drying_seconds": sum(
            duration
            for duration in (
                _drying_run_duration_seconds(drying_run)
                for drying_run in drying_runs
                if drying_run.status != DryingRunStatus.VOIDED
            )
            if duration is not None
        ),
    }


def _tray_sort_key(tray: Tray) -> tuple[int, str]:
    return (tray.tray_slot.slot_number, str(tray.id))


def _latest_weight(
    tray: Tray,
    weight_checks: list[WeightCheck],
) -> Decimal | None:
    if tray.final_dry_weight_grams is not None:
        return tray.final_dry_weight_grams
    if weight_checks:
        return weight_checks[-1].weight_grams
    return tray.starting_weight_grams


def _previous_weight(
    tray: Tray,
    weight_checks: list[WeightCheck],
) -> Decimal | None:
    if len(weight_checks) >= 2:
        return weight_checks[-2].weight_grams
    if len(weight_checks) == 1:
        return tray.starting_weight_grams
    return None


def _drying_run_duration_seconds(drying_run: DryingRun) -> int | None:
    if drying_run.ended_at is None:
        return None
    return int((drying_run.ended_at - drying_run.started_at).total_seconds())

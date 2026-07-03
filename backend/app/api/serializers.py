from app.models import FreezeDryer, PhysicalTray, ProductionBatch, Tray, TraySlot


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
        "notes": tray.notes,
        "status": tray.status,
    }


def production_batch_data(batch: ProductionBatch) -> dict[str, object]:
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
    }


def _tray_sort_key(tray: Tray) -> tuple[int, str]:
    return (tray.tray_slot.slot_number, str(tray.id))

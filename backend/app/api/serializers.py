from app.models import FreezeDryer, ProductionBatch, Tray


def freeze_dryer_data(freeze_dryer: FreezeDryer) -> dict[str, object]:
    return {
        "id": freeze_dryer.id,
        "name": freeze_dryer.name,
        "notes": freeze_dryer.notes,
        "archived": freeze_dryer.archived,
    }


def tray_data(tray: Tray) -> dict[str, object]:
    return {
        "id": tray.id,
        "production_batch_id": tray.production_batch_id,
        "tray_number": tray.tray_number,
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
    return (tray.tray_number, str(tray.id))

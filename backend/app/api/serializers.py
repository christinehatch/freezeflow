from decimal import Decimal

from app.models import (
    DryingRun,
    DryingRunStatus,
    FreezeDryer,
    Package,
    PackageLabel,
    PackageStatusHistory,
    PackageType,
    PackagingAllocation,
    PackagingLoss,
    PackagingOperation,
    PhysicalTray,
    PlannedPackageRow,
    PrintEvent,
    ProductionBatch,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TraySlot,
    TrayStatus,
    WeightCheck,
)
from app.services.packaging import fresh_equivalent_grams


def _fresh_equivalent_display(
    allocation: PackagingAllocation, weight_grams: Decimal | None
) -> str | None:
    if weight_grams is None:
        return None
    fresh = fresh_equivalent_grams(allocation, weight_grams)
    return None if fresh is None else f"{fresh:.1f} g fresh"


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
        "packaging": tray_packaging_data(tray),
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


def package_type_data(package_type: PackageType) -> dict[str, object]:
    return {
        "id": package_type.id,
        "name": package_type.name,
        "default_oxygen_absorber": package_type.default_oxygen_absorber,
        "default_label_template": package_type.default_label_template,
        "notes": package_type.notes,
        "archived": package_type.archived,
    }


def storage_location_data(storage_location: StorageLocation) -> dict[str, object]:
    return {
        "id": storage_location.id,
        "name": storage_location.name,
        "notes": storage_location.notes,
        "archived": storage_location.archived,
    }


def storage_location_history_data(
    entry: StorageLocationHistory,
) -> dict[str, object]:
    return {
        "id": entry.id,
        "package_id": entry.package_id,
        "previous_storage_location_id": entry.previous_storage_location_id,
        "current_storage_location_id": entry.current_storage_location_id,
        "moved_at": entry.moved_at,
        "notes": entry.notes,
    }


def package_status_history_data(entry: PackageStatusHistory) -> dict[str, object]:
    return {
        "id": entry.id,
        "package_id": entry.package_id,
        "previous_status": entry.previous_status,
        "current_status": entry.current_status,
        "effective_at": entry.effective_at,
        "recorded_at": entry.recorded_at,
        "notes": entry.notes,
    }


def packaging_operation_data(operation: PackagingOperation) -> dict[str, object]:
    return {
        "id": operation.id,
        "production_batch_id": operation.production_batch_id,
        "status": operation.status,
        "started_at": operation.started_at,
        "completed_at": operation.completed_at,
        "notes": operation.notes,
        "created_at": operation.created_at,
        "updated_at": operation.updated_at,
        "allocations": [
            packaging_allocation_data(allocation)
            for allocation in sorted(
                operation.allocations,
                key=lambda allocation: allocation.created_at,
            )
        ],
        "packages": [
            package_data(package)
            for package in sorted(
                operation.packages,
                key=lambda package: package.package_identifier,
            )
        ],
    }


def packaging_allocation_data(allocation: PackagingAllocation) -> dict[str, object]:
    source_trays = sorted(
        (link.tray for link in allocation.source_tray_links),
        key=_tray_sort_key,
    )
    return {
        "id": allocation.id,
        "packaging_operation_id": allocation.packaging_operation_id,
        "notes": allocation.notes,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at,
        "selected_weight_grams": allocation.selected_weight_grams,
        "allocated_weight_grams": allocation.allocated_weight_grams,
        "total_recorded_loss_weight_grams": allocation.total_recorded_loss_weight_grams,
        "remaining_weight_grams": allocation.remaining_weight_grams,
        "bagged_weight_grams": allocation.bagged_weight_grams,
        "remaining_to_bag_grams": allocation.remaining_to_bag_grams,
        "source_trays": [source_tray_data(tray) for tray in source_trays],
        "packaging_losses": [
            packaging_loss_data(loss)
            for loss in sorted(
                allocation.packaging_losses,
                key=lambda loss: loss.recorded_at,
            )
        ],
        "planned_packages": [
            planned_package_row_data(row)
            for row in sorted(
                allocation.planned_package_rows,
                key=lambda row: row.created_at,
            )
        ],
        "packages": [
            package_data(package)
            for package in sorted(
                allocation.packages,
                key=lambda package: package.package_identifier,
            )
        ],
    }


def source_tray_data(tray: Tray) -> dict[str, object]:
    return {
        "id": tray.id,
        "production_batch_id": tray.production_batch_id,
        "tray_slot_id": tray.tray_slot_id,
        "slot_number": tray.tray_slot.slot_number,
        "physical_tray_id": tray.physical_tray_id,
        "physical_tray_label": tray.physical_tray.label,
        "product_name": tray.product_name,
        "preparation": tray.preparation,
        "final_dry_weight_grams": tray.final_dry_weight_grams,
        "notes": tray.notes,
        "status": tray.status,
    }


def planned_package_row_data(row: PlannedPackageRow) -> dict[str, object]:
    return {
        "id": row.id,
        "packaging_allocation_id": row.packaging_allocation_id,
        "package_type_id": row.package_type_id,
        "finished_product_weight_grams": row.finished_product_weight_grams,
        "finished_product_weight_unit": row.finished_product_weight_unit,
        "sealed_package_weight_grams": row.sealed_package_weight_grams,
        "sealed_package_weight_unit": row.sealed_package_weight_unit,
        "oxygen_absorber": row.oxygen_absorber,
        "storage_location_id": row.storage_location_id,
        "notes": row.notes,
        "label_status": row.label_status,
        "label_display_name": row.label_display_name,
        "label_description": row.label_description,
        "label_ingredients_summary": row.label_ingredients_summary,
        "label_preparation_summary": row.label_preparation_summary,
        "label_rehydration_instructions": row.label_rehydration_instructions,
        "label_serving_notes": row.label_serving_notes,
        "label_net_weight_display": row.label_net_weight_display,
        "label_fresh_equivalent_display": _fresh_equivalent_display(
            row.packaging_allocation, row.finished_product_weight_grams
        ),
        "recorded_package_id": row.recorded_package_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def packaging_loss_data(loss: PackagingLoss) -> dict[str, object]:
    return {
        "id": loss.id,
        "packaging_allocation_id": loss.packaging_allocation_id,
        "weight_grams": loss.weight_grams,
        "reason": loss.reason,
        "reason_detail": loss.reason_detail,
        "recorded_at": loss.recorded_at,
    }


def package_data(package: Package) -> dict[str, object]:
    allocation = package.packaging_allocation
    return {
        "id": package.id,
        "packaging_allocation_id": package.packaging_allocation_id,
        "packaging_operation_id": allocation.packaging_operation_id,
        "package_type_id": package.package_type_id,
        "package_type": package_type_data(package.package_type),
        "package_identifier": package.package_identifier,
        "packaged_at": package.packaged_at,
        "package_weight_grams": package.package_weight_grams,
        "finished_product_weight_grams": package.finished_product_weight_grams,
        "oxygen_absorber": package.oxygen_absorber,
        "storage_location_id": package.storage_location_id,
        "storage_location": storage_location_data(package.storage_location),
        "status": package.status,
        "notes": package.notes,
        "label": package_label_data(package.label),
    }


def package_eligible_for_print_data(package: Package) -> dict[str, object]:
    batch = package.packaging_allocation.packaging_operation.production_batch
    return {
        **package_data(package),
        "production_batch_id": batch.id,
        "batch_number": batch.batch_number,
    }


def packaging_worksheet_data(batches: list[ProductionBatch]) -> list[dict[str, object]]:
    worksheet: list[dict[str, object]] = []
    for batch in batches:
        eligible_trays = [
            tray
            for tray in sorted(batch.trays, key=_tray_sort_key)
            if tray.status == TrayStatus.COMPLETED
            and not tray.packaging_allocation_links
        ]
        if not eligible_trays:
            continue
        worksheet.append(
            {
                "production_batch": production_batch_data(batch),
                "eligible_trays": [tray_data(tray) for tray in eligible_trays],
                "source_weight_grams": sum(
                    (
                        tray.final_dry_weight_grams
                        for tray in eligible_trays
                        if tray.final_dry_weight_grams is not None
                    ),
                    Decimal("0"),
                ),
            }
        )
    return worksheet


def package_label_data(label: PackageLabel) -> dict[str, object]:
    return {
        "id": label.id,
        "package_id": label.package_id,
        "status": label.status,
        "display_name": label.display_name,
        "description": label.description,
        "ingredients_summary": label.ingredients_summary,
        "preparation_summary": label.preparation_summary,
        "rehydration_instructions": label.rehydration_instructions,
        "serving_notes": label.serving_notes,
        "net_weight_display": label.net_weight_display,
        "fresh_equivalent_display": _fresh_equivalent_display(
            label.package.packaging_allocation,
            label.package.finished_product_weight_grams,
        ),
        "created_at": label.created_at,
        "updated_at": label.updated_at,
        "print_events": [
            print_event_data(event)
            for event in sorted(label.print_events, key=lambda event: event.printed_at)
        ],
    }


def print_event_data(event: PrintEvent) -> dict[str, object]:
    return {
        "id": event.id,
        "package_label_id": event.package_label_id,
        "printed_at": event.printed_at,
        "recorded_at": event.recorded_at,
        "template": event.template,
        "print_job_id": event.print_job_id,
        "notes": event.notes,
    }


def tray_packaging_data(tray: Tray) -> dict[str, object] | None:
    if not tray.packaging_allocation_links:
        return None
    source_link = tray.packaging_allocation_links[0]
    allocation = source_link.packaging_allocation
    operation = allocation.packaging_operation
    return {
        "packaging_operation_id": operation.id,
        "packaging_allocation_id": allocation.id,
        "packaging_operation_status": operation.status,
        "started_at": operation.started_at,
        "completed_at": operation.completed_at,
        "batch_number": tray.production_batch.batch_number,
        "freeze_dryer": tray.production_batch.freeze_dryer.name,
        "packages": [
            {
                "id": package.id,
                "package_identifier": package.package_identifier,
                "package_type": package.package_type.name,
                "package_weight_grams": package.package_weight_grams,
                "finished_product_weight_grams": package.finished_product_weight_grams,
                "oxygen_absorber": package.oxygen_absorber,
                "storage_location": package.storage_location.name,
                "status": package.status,
                "notes": package.notes,
            }
            for package in sorted(
                allocation.packages,
                key=lambda package: package.package_identifier,
            )
        ],
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

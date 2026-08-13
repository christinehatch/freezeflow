from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    FreezeDryer,
    Package,
    PackageLabel,
    PackageLabelStatus,
    PackageType,
    PackagingAllocation,
    PackagingAllocationSourceTray,
    PackagingLoss,
    PackagingLossReason,
    PackagingOperation,
    PackagingOperationStatus,
    PlannedPackageRow,
    PrintEvent,
    ProductionBatch,
    ProductionBatchStatus,
    StorageLocation,
    Tray,
    TrayStatus,
)
from app.repositories import (
    package_repository,
    package_type_repository,
    packaging_allocation_repository,
    packaging_loss_repository,
    packaging_operation_repository,
    planned_package_row_repository,
)
from app.schemas import (
    PackageCreate,
    PackageLabelSelection,
    PackageLabelUpdate,
    PackageLineCreate,
    PackageTypeCreate,
    PackageTypeUpdate,
    PackagingAllocationCreateRequest,
    PackagingAllocationUpdateRequest,
    PackagingLossCreate,
    PackagingOperationCreate,
    PackagingOperationStart,
    PlannedPackageInput,
    RecordAllocationPackages,
    RecordPackagingLoss,
)
from app.services.errors import BusinessRuleError

UNASSIGNED_STORAGE_LOCATION_NAME = "Unassigned"
ALLOCATION_TOLERANCE_GRAMS = Decimal("0.001")


def list_package_types(
    db: Session, *, include_archived: bool = False
) -> list[PackageType]:
    statement = select(PackageType).order_by(PackageType.name)
    if not include_archived:
        statement = statement.where(PackageType.archived.is_(False))
    return list(db.scalars(statement).all())


def create_package_type(db: Session, data: PackageTypeCreate) -> PackageType:
    if not data.name.strip():
        raise BusinessRuleError("Package Type name is required.")
    package_type = package_type_repository.create(
        db,
        {
            "name": data.name.strip(),
            "default_oxygen_absorber": _clean_optional_text(
                data.default_oxygen_absorber
            ),
            "default_label_template": _clean_optional_text(data.default_label_template),
            "notes": _clean_optional_text(data.notes),
            "archived": False,
        },
    )
    db.commit()
    return package_type


def update_package_type(
    db: Session, package_type_id: UUID, data: PackageTypeUpdate
) -> PackageType:
    package_type = _get_package_type(db, package_type_id, allow_archived=True)
    values = data.model_dump(exclude_unset=True)
    if "name" in values:
        if not values["name"] or not values["name"].strip():
            raise BusinessRuleError("Package Type name is required.")
        values["name"] = values["name"].strip()
    for key in ("default_oxygen_absorber", "default_label_template", "notes"):
        if key in values:
            values[key] = _clean_optional_text(values[key])
    updated = package_type_repository.update(db, package_type, values)
    db.commit()
    return updated


def list_storage_locations(db: Session) -> list[StorageLocation]:
    _get_or_create_unassigned_storage_location(db)
    db.commit()
    return list(
        db.scalars(
            select(StorageLocation)
            .where(StorageLocation.archived.is_(False))
            .order_by(StorageLocation.name)
        ).all()
    )


def get_packaging_worksheet(db: Session) -> list[ProductionBatch]:
    return list(
        db.scalars(
            select(ProductionBatch)
            .join(ProductionBatch.trays)
            .where(Tray.status == TrayStatus.COMPLETED)
            .where(~Tray.packaging_allocation_links.any())
            .options(
                selectinload(ProductionBatch.freeze_dryer).selectinload(
                    FreezeDryer.tray_slots
                ),
                selectinload(ProductionBatch.trays).selectinload(Tray.tray_slot),
                selectinload(ProductionBatch.trays).selectinload(Tray.physical_tray),
                selectinload(ProductionBatch.trays).selectinload(Tray.recipe),
                selectinload(ProductionBatch.trays).selectinload(Tray.weight_checks),
            )
            .distinct()
            .order_by(ProductionBatch.completed_at.desc().nullslast())
        ).all()
    )


def start_or_resume_packaging_operation(
    db: Session,
    batch_id: UUID,
    data: PackagingOperationStart,
) -> PackagingOperation:
    batch = db.get(ProductionBatch, batch_id)
    if batch is None:
        raise BusinessRuleError("Production Batch does not exist.")
    if batch.status != ProductionBatchStatus.COMPLETED:
        raise BusinessRuleError("Only a Completed Production Batch may be packaged.")
    existing = db.scalar(
        select(PackagingOperation).where(
            PackagingOperation.production_batch_id == batch_id,
            PackagingOperation.status == PackagingOperationStatus.OPEN,
        )
    )
    if existing is not None:
        return get_packaging_operation(db, existing.id)
    operation = packaging_operation_repository.create(
        db,
        PackagingOperationCreate(
            production_batch_id=batch_id,
            started_at=data.started_at or datetime.now(UTC),
            notes=_clean_optional_text(data.notes),
        ),
    )
    db.commit()
    return get_packaging_operation(db, operation.id)


def get_batch_packaging_operation(db: Session, batch_id: UUID) -> PackagingOperation:
    operation = db.scalar(
        select(PackagingOperation)
        .where(PackagingOperation.production_batch_id == batch_id)
        .order_by(PackagingOperation.started_at.desc())
    )
    if operation is None:
        raise BusinessRuleError(
            "Production Batch has no Packaging Operation.",
            status_code=404,
        )
    return get_packaging_operation(db, operation.id)


def get_packaging_operation(db: Session, operation_id: UUID) -> PackagingOperation:
    operation = db.scalar(
        select(PackagingOperation)
        .where(PackagingOperation.id == operation_id)
        .options(
            selectinload(PackagingOperation.production_batch).selectinload(
                ProductionBatch.freeze_dryer
            ),
            selectinload(PackagingOperation.allocations)
            .selectinload(PackagingAllocation.source_tray_links)
            .selectinload(PackagingAllocationSourceTray.tray)
            .selectinload(Tray.tray_slot),
            selectinload(PackagingOperation.allocations)
            .selectinload(PackagingAllocation.source_tray_links)
            .selectinload(PackagingAllocationSourceTray.tray)
            .selectinload(Tray.physical_tray),
            selectinload(PackagingOperation.allocations).selectinload(
                PackagingAllocation.planned_package_rows
            ),
            selectinload(PackagingOperation.allocations).selectinload(
                PackagingAllocation.packaging_losses
            ),
            selectinload(PackagingOperation.allocations)
            .selectinload(PackagingAllocation.packages)
            .selectinload(Package.label)
            .selectinload(PackageLabel.print_events),
            selectinload(PackagingOperation.allocations)
            .selectinload(PackagingAllocation.packages)
            .selectinload(Package.package_type),
            selectinload(PackagingOperation.allocations)
            .selectinload(PackagingAllocation.packages)
            .selectinload(Package.storage_location),
        )
    )
    if operation is None:
        raise BusinessRuleError("Packaging Operation does not exist.")
    return operation


def create_packaging_allocation(
    db: Session,
    operation_id: UUID,
    data: PackagingAllocationCreateRequest,
) -> PackagingAllocation:
    try:
        allocation = packaging_allocation_repository.create_with_sources(
            db,
            packaging_operation_id=operation_id,
            tray_ids=data.tray_ids,
            notes=_clean_optional_text(data.notes),
        )
        db.commit()
        return get_packaging_allocation(db, allocation.id)
    except ValueError as exc:
        db.rollback()
        raise BusinessRuleError(str(exc)) from exc


def get_packaging_allocation(db: Session, allocation_id: UUID) -> PackagingAllocation:
    allocation = db.scalar(
        select(PackagingAllocation)
        .where(PackagingAllocation.id == allocation_id)
        .options(
            selectinload(PackagingAllocation.packaging_operation),
            selectinload(PackagingAllocation.source_tray_links)
            .selectinload(PackagingAllocationSourceTray.tray)
            .selectinload(Tray.tray_slot),
            selectinload(PackagingAllocation.source_tray_links)
            .selectinload(PackagingAllocationSourceTray.tray)
            .selectinload(Tray.physical_tray),
            selectinload(PackagingAllocation.planned_package_rows),
            selectinload(PackagingAllocation.packaging_losses),
            selectinload(PackagingAllocation.packages).selectinload(Package.label),
        )
    )
    if allocation is None:
        raise BusinessRuleError("Packaging Allocation does not exist.")
    return allocation


def update_packaging_allocation(
    db: Session,
    operation_id: UUID,
    allocation_id: UUID,
    data: PackagingAllocationUpdateRequest,
) -> PackagingAllocation:
    allocation = _open_allocation(db, operation_id, allocation_id)
    if data.tray_ids is not None:
        if allocation.packages or allocation.planned_package_rows:
            raise BusinessRuleError(
                "Source Trays cannot change after package planning begins."
            )
        _replace_allocation_sources(db, allocation, data.tray_ids)
    if "notes" in data.model_fields_set:
        allocation.notes = _clean_optional_text(data.notes)
    if data.planned_packages is not None:
        _reconcile_planned_rows(db, allocation, data.planned_packages)
    db.flush()
    db.expire(allocation, ["planned_package_rows"])
    if allocation.remaining_weight_grams < -ALLOCATION_TOLERANCE_GRAMS:
        db.rollback()
        raise BusinessRuleError(
            "Planned Packages cannot exceed the selected product weight."
        )
    db.commit()
    return get_packaging_allocation(db, allocation.id)


def record_allocation_packages(
    db: Session,
    operation_id: UUID,
    allocation_id: UUID,
    data: RecordAllocationPackages,
) -> list[Package]:
    allocation = _open_allocation(db, operation_id, allocation_id)
    created: list[Package] = []
    current_allocated = allocation.allocated_weight_grams
    try:
        for line in data.packages:
            values, planned = _resolve_package_line(db, allocation, line)
            finished_weight = values["finished_product_weight_grams"]
            planned_weight = (
                planned.finished_product_weight_grams
                if planned is not None and planned.recorded_package_id is None
                else Decimal("0")
            ) or Decimal("0")
            projected = current_allocated - planned_weight + finished_weight
            if (
                projected - allocation.selected_weight_grams
                > ALLOCATION_TOLERANCE_GRAMS
            ):
                raise BusinessRuleError(
                    "Packages cannot exceed the selected product weight."
                )
            package_type = _get_package_type(db, values["package_type_id"])
            storage_id = values.get("storage_location_id")
            if storage_id is not None:
                _get_storage_location(db, storage_id)
            label_values = _default_label_values(allocation, values, line, planned)
            package = package_repository.create(
                db,
                PackageCreate(
                    packaging_allocation_id=allocation.id,
                    package_type_id=package_type.id,
                    package_identifier=_next_package_identifier(
                        db, values["packaged_at"]
                    ),
                    packaged_at=values["packaged_at"],
                    storage_location_id=storage_id,
                    package_weight_grams=values["sealed_package_weight_grams"],
                    finished_product_weight_grams=finished_weight,
                    oxygen_absorber=values.get("oxygen_absorber")
                    or package_type.default_oxygen_absorber,
                    notes=_clean_optional_text(values.get("notes")),
                    label=label_values,
                ),
            )
            if planned is not None:
                planned.recorded_package_id = package.id
                db.add(planned)
            created.append(package)
            current_allocated = projected
        db.commit()
    except (BusinessRuleError, ValueError):
        db.rollback()
        raise
    return [get_package(db, package.id) for package in created]


def record_packaging_loss(
    db: Session,
    operation_id: UUID,
    allocation_id: UUID,
    data: RecordPackagingLoss,
) -> PackagingLoss:
    allocation = _open_allocation(db, operation_id, allocation_id)
    reason_detail = _clean_optional_text(data.reason_detail)
    if data.reason != PackagingLossReason.OTHER and reason_detail is not None:
        raise BusinessRuleError("Reason detail is only accepted when reason is Other.")
    excess = data.weight_grams - allocation.remaining_weight_grams
    if excess > ALLOCATION_TOLERANCE_GRAMS:
        raise BusinessRuleError(
            "Packaging Loss cannot exceed the Allocation's Remaining Weight."
        )
    loss = packaging_loss_repository.create(
        db,
        PackagingLossCreate(
            packaging_allocation_id=allocation.id,
            weight_grams=data.weight_grams,
            reason=data.reason,
            reason_detail=reason_detail,
        ),
    )
    db.commit()
    return loss


def complete_packaging_operation(
    db: Session,
    operation_id: UUID,
    *,
    completed_at: datetime | None = None,
) -> PackagingOperation:
    operation = get_packaging_operation(db, operation_id)
    if operation.status != PackagingOperationStatus.OPEN:
        raise BusinessRuleError("Only an Open Packaging Operation may be completed.")
    if not operation.allocations:
        raise BusinessRuleError(
            "A Packaging Operation requires at least one Allocation."
        )
    for allocation in operation.allocations:
        if not allocation.packages and not allocation.packaging_losses:
            raise BusinessRuleError(
                "Every Allocation requires at least one Package or Packaging Loss."
            )
        if any(
            row.recorded_package_id is None for row in allocation.planned_package_rows
        ):
            raise BusinessRuleError(
                "Every planned Package must be recorded before completion."
            )
        if abs(allocation.remaining_weight_grams) > ALLOCATION_TOLERANCE_GRAMS:
            raise BusinessRuleError(
                "All selected product must be allocated before completion."
            )
        if any(
            package.label.status == PackageLabelStatus.DRAFT
            for package in allocation.packages
        ):
            raise BusinessRuleError(
                "Every Package Label must be Ready before completion."
            )
    for allocation in operation.allocations:
        for source in allocation.source_tray_links:
            source.tray.status = TrayStatus.PACKAGED
            db.add(source.tray)
    try:
        packaging_operation_repository.complete(
            db, operation, completed_at=completed_at
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise BusinessRuleError(str(exc)) from exc
    return get_packaging_operation(db, operation_id)


def get_package(db: Session, package_id: UUID) -> Package:
    package = db.scalar(
        select(Package)
        .where(Package.id == package_id)
        .options(
            selectinload(Package.packaging_allocation)
            .selectinload(PackagingAllocation.packaging_operation)
            .selectinload(PackagingOperation.production_batch)
            .selectinload(ProductionBatch.freeze_dryer),
            selectinload(Package.packaging_allocation)
            .selectinload(PackagingAllocation.source_tray_links)
            .selectinload(PackagingAllocationSourceTray.tray),
            selectinload(Package.package_type),
            selectinload(Package.storage_location),
            selectinload(Package.label).selectinload(PackageLabel.print_events),
            selectinload(Package.storage_location_history),
            selectinload(Package.status_history),
        )
    )
    if package is None:
        raise BusinessRuleError("Package does not exist.")
    return package


def get_package_label(db: Session, package_id: UUID) -> PackageLabel:
    package = get_package(db, package_id)
    return package.label


def update_package_label(
    db: Session, package_id: UUID, data: PackageLabelUpdate
) -> PackageLabel:
    label = get_package_label(db, package_id)
    if (
        label.package.packaging_allocation.packaging_operation.status
        != PackagingOperationStatus.OPEN
    ):
        raise BusinessRuleError("Completed Packaging Operations cannot be changed.")
    values = data.model_dump(exclude_unset=True, exclude={"status"})
    for field, value in values.items():
        setattr(
            label,
            field,
            _clean_optional_text(value) if isinstance(value, str) else value,
        )
    if not label.display_name or not label.display_name.strip():
        raise BusinessRuleError("Package Label display name is required.")
    label.status = (
        PackageLabelStatus.NEEDS_REPRINT
        if label.print_events
        else PackageLabelStatus.READY
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


def preview_package_labels(
    db: Session, data: PackageLabelSelection
) -> list[PackageLabel]:
    return _selected_labels(db, data.package_label_ids, require_printable=False)


def print_package_labels(db: Session, data: PackageLabelSelection) -> dict[str, object]:
    labels = _selected_labels(db, data.package_label_ids, require_printable=True)
    print_job_id = uuid4()
    printed_at = data.printed_at or datetime.now(UTC)
    for label in labels:
        db.add(
            PrintEvent(
                package_label_id=label.id,
                printed_at=printed_at,
                template=data.template,
                print_job_id=print_job_id,
                notes=_clean_optional_text(data.notes),
            )
        )
        label.status = PackageLabelStatus.READY
        db.add(label)
    db.commit()
    return {"print_job_id": print_job_id, "labels": labels}


def _open_allocation(
    db: Session, operation_id: UUID, allocation_id: UUID
) -> PackagingAllocation:
    allocation = get_packaging_allocation(db, allocation_id)
    if allocation.packaging_operation_id != operation_id:
        raise BusinessRuleError(
            "Allocation does not belong to this Packaging Operation."
        )
    if allocation.packaging_operation.status != PackagingOperationStatus.OPEN:
        raise BusinessRuleError("Completed Packaging Operations cannot be changed.")
    return allocation


def _replace_allocation_sources(
    db: Session, allocation: PackagingAllocation, tray_ids: list[UUID]
) -> None:
    if not tray_ids or len(tray_ids) != len(set(tray_ids)):
        raise BusinessRuleError("Select one or more unique source Trays.")
    trays = list(db.scalars(select(Tray).where(Tray.id.in_(tray_ids))).all())
    if len(trays) != len(tray_ids):
        raise BusinessRuleError("Every source Tray must exist.")
    occupied = set(
        db.scalars(
            select(PackagingAllocationSourceTray.tray_id).where(
                PackagingAllocationSourceTray.tray_id.in_(tray_ids),
                PackagingAllocationSourceTray.packaging_allocation_id != allocation.id,
            )
        ).all()
    )
    for tray in trays:
        if tray.id in occupied:
            raise BusinessRuleError(
                "A completed Tray may only belong to one Packaging Allocation."
            )
        if tray.status != TrayStatus.COMPLETED:
            raise BusinessRuleError("Only Completed Trays may supply an Allocation.")
        if (
            tray.production_batch_id
            != allocation.packaging_operation.production_batch_id
        ):
            raise BusinessRuleError(
                "Source Trays must belong to the operation's Production Batch."
            )
    allocation.source_tray_links.clear()
    db.flush()
    allocation.source_tray_links.extend(
        PackagingAllocationSourceTray(tray_id=tray_id) for tray_id in tray_ids
    )


def _reconcile_planned_rows(
    db: Session, allocation: PackagingAllocation, inputs: list[PlannedPackageInput]
) -> None:
    # Recorded rows are immutable historical records and are excluded from
    # reconciliation entirely: they are never deleted for being omitted, and
    # never edited for being included. Only unrecorded rows are editable.
    editable = {
        row.id: row
        for row in allocation.planned_package_rows
        if row.recorded_package_id is None
    }
    recorded_ids = {
        row.id
        for row in allocation.planned_package_rows
        if row.recorded_package_id is not None
    }
    requested_ids = {item.id for item in inputs if item.id is not None}
    for row_id, row in list(editable.items()):
        if row_id not in requested_ids:
            db.delete(row)
    for item in inputs:
        if item.id is not None and item.id in recorded_ids:
            continue
        values = item.model_dump(exclude={"id"}, exclude_unset=True)
        _validate_plan_references(db, values)
        if item.id is None:
            planned_package_row_repository.create(
                db,
                {"packaging_allocation_id": allocation.id, **values},
            )
        else:
            row = editable.get(item.id)
            if row is None:
                raise BusinessRuleError(
                    "Planned Package does not belong to this Allocation."
                )
            planned_package_row_repository.update(db, row, values)
    db.flush()


def _validate_plan_references(db: Session, values: dict[str, object]) -> None:
    package_type_id = values.get("package_type_id")
    if package_type_id is not None:
        _get_package_type(db, package_type_id)
    storage_location_id = values.get("storage_location_id")
    if storage_location_id is not None:
        _get_storage_location(db, storage_location_id)


def _resolve_package_line(
    db: Session,
    allocation: PackagingAllocation,
    line: PackageLineCreate,
) -> tuple[dict[str, object], PlannedPackageRow | None]:
    planned = None
    values = line.model_dump(
        exclude={"planned_package_row_id", "label"}, exclude_none=True
    )
    if line.planned_package_row_id is not None:
        planned = db.get(PlannedPackageRow, line.planned_package_row_id)
        if planned is None or planned.packaging_allocation_id != allocation.id:
            raise BusinessRuleError(
                "Planned Package does not belong to this Allocation."
            )
        if planned.recorded_package_id is not None:
            raise BusinessRuleError("Planned Package has already been recorded.")
        planned_values = {
            "package_type_id": planned.package_type_id,
            "finished_product_weight_grams": planned.finished_product_weight_grams,
            "sealed_package_weight_grams": planned.sealed_package_weight_grams,
            "oxygen_absorber": planned.oxygen_absorber,
            "storage_location_id": planned.storage_location_id,
            "notes": planned.notes,
        }
        planned_values.update(values)
        values = planned_values
    required = (
        "package_type_id",
        "finished_product_weight_grams",
        "sealed_package_weight_grams",
    )
    if any(values.get(field) is None for field in required):
        raise BusinessRuleError("Package Type and both Package weights are required.")
    values["packaged_at"] = values.get("packaged_at") or datetime.now(UTC)
    return values, planned


def _default_label_values(
    allocation: PackagingAllocation,
    values: dict[str, object],
    line: PackageLineCreate,
    planned: PlannedPackageRow | None,
):
    from app.schemas import PackageLabelCreate

    trays = [link.tray for link in allocation.source_tray_links]
    products = list(dict.fromkeys(tray.product_name for tray in trays))
    display_name = products[0] if len(products) == 1 else "Mixed Product"
    preparation = (
        "; ".join(dict.fromkeys(filter(None, (tray.preparation for tray in trays))))
        or None
    )
    label_values = line.label.model_dump(exclude_none=True) if line.label else {}
    if planned is not None:
        planned_labels = {
            "display_name": planned.label_display_name,
            "description": planned.label_description,
            "ingredients_summary": planned.label_ingredients_summary,
            "preparation_summary": planned.label_preparation_summary,
            "rehydration_instructions": planned.label_rehydration_instructions,
            "serving_notes": planned.label_serving_notes,
            "net_weight_display": planned.label_net_weight_display,
        }
        label_values = {
            **{k: v for k, v in planned_labels.items() if v is not None},
            **label_values,
        }
    label_values.setdefault("display_name", display_name)
    label_values.setdefault("preparation_summary", preparation)
    label_values.setdefault(
        "net_weight_display",
        f'{Decimal(values["finished_product_weight_grams"]):.1f} g',
    )
    return PackageLabelCreate(status=PackageLabelStatus.READY, **label_values)


def fresh_equivalent_grams(
    allocation: PackagingAllocation, package_weight: Decimal
) -> Decimal | None:
    dry = allocation.selected_weight_grams
    if dry <= 0:
        return None
    fresh = sum(
        (
            link.tray.starting_weight_grams or Decimal("0")
            for link in allocation.source_tray_links
        ),
        start=Decimal("0"),
    )
    return package_weight * fresh / dry if fresh > 0 else None


def _selected_labels(
    db: Session, ids: list[UUID], *, require_printable: bool
) -> list[PackageLabel]:
    if len(ids) != len(set(ids)):
        raise BusinessRuleError("Select each Package Label only once.")
    labels = list(
        db.scalars(
            select(PackageLabel)
            .where(PackageLabel.id.in_(ids))
            .options(
                selectinload(PackageLabel.package).selectinload(Package.package_type),
                selectinload(PackageLabel.package).selectinload(
                    Package.storage_location
                ),
                selectinload(PackageLabel.package)
                .selectinload(Package.packaging_allocation)
                .selectinload(PackagingAllocation.source_tray_links)
                .selectinload(PackagingAllocationSourceTray.tray),
                selectinload(PackageLabel.print_events),
            )
        ).all()
    )
    if len(labels) != len(ids):
        raise BusinessRuleError("Every selected Package Label must exist.")
    if require_printable and any(
        label.status == PackageLabelStatus.DRAFT for label in labels
    ):
        raise BusinessRuleError(
            "Draft Package Labels must be made Ready before printing."
        )
    labels_by_id = {label.id: label for label in labels}
    return [labels_by_id[label_id] for label_id in ids]


def _get_package_type(
    db: Session, package_type_id: UUID, *, allow_archived: bool = False
) -> PackageType:
    package_type = db.get(PackageType, package_type_id)
    if package_type is None:
        raise BusinessRuleError("Package Type does not exist.")
    if package_type.archived and not allow_archived:
        raise BusinessRuleError("Archived Package Types cannot be used.")
    return package_type


def _get_storage_location(db: Session, storage_location_id: UUID) -> StorageLocation:
    location = db.get(StorageLocation, storage_location_id)
    if location is None or location.archived:
        raise BusinessRuleError("Storage Location is not available.")
    return location


def _get_or_create_unassigned_storage_location(db: Session) -> StorageLocation:
    location = db.scalar(
        select(StorageLocation).where(
            StorageLocation.name == UNASSIGNED_STORAGE_LOCATION_NAME
        )
    )
    if location is None:
        location = StorageLocation(
            name=UNASSIGNED_STORAGE_LOCATION_NAME,
            notes="System-provided location for Packages not yet assigned.",
            archived=False,
        )
        db.add(location)
        db.flush()
    return location


def _next_package_identifier(db: Session, packaged_at: datetime) -> str:
    year = packaged_at.year
    prefix = f"PKG-{year}-"
    count = (
        db.scalar(
            select(func.count())
            .select_from(Package)
            .where(Package.package_identifier.like(f"{prefix}%"))
        )
        or 0
    )
    candidate = count + 1
    while (
        db.scalar(
            select(Package.id).where(
                Package.package_identifier == f"{prefix}{candidate:06d}"
            )
        )
        is not None
    ):
        candidate += 1
    return f"{prefix}{candidate:06d}"


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None

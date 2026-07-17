from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    FreezeDryer,
    InventoryStatus,
    Package,
    PackageType,
    PackagingOperation,
    PackagingOperationTray,
    ProductionBatch,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TrayStatus,
    WeightCheck,
)
from app.repositories import package_type_repository
from app.schemas import (
    PackageLabelRequest,
    PackageSelectedTrays,
    PackageTypeCreate,
    PackageTypeUpdate,
)
from app.services.errors import BusinessRuleError

UNASSIGNED_STORAGE_LOCATION_NAME = "Unassigned"
ALLOCATION_TOLERANCE_GRAMS = Decimal("0.001")


def list_package_types(
    db: Session,
    *,
    include_archived: bool = False,
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
    db.refresh(package_type)
    return package_type


def update_package_type(
    db: Session,
    package_type_id: UUID,
    data: PackageTypeUpdate,
) -> PackageType:
    package_type = _get_package_type(db, package_type_id, allow_archived=True)
    values: dict[str, object | None] = {}
    if data.name is not None:
        if not data.name.strip():
            raise BusinessRuleError("Package Type name is required.")
        values["name"] = data.name.strip()
    if data.default_oxygen_absorber is not None:
        values["default_oxygen_absorber"] = _clean_optional_text(
            data.default_oxygen_absorber
        )
    if data.default_label_template is not None:
        values["default_label_template"] = _clean_optional_text(
            data.default_label_template
        )
    if data.notes is not None:
        values["notes"] = _clean_optional_text(data.notes)
    if data.archived is not None:
        values["archived"] = data.archived

    updated = package_type_repository.update(db, package_type, values)
    db.commit()
    db.refresh(updated)
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
            .where(~Tray.packaging_operation_link.has())
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


def package_selected_trays(
    db: Session,
    data: PackageSelectedTrays,
) -> dict[str, object]:
    trays = _get_eligible_trays(db, data.tray_ids)
    if len({tray.production_batch_id for tray in trays}) != 1:
        raise BusinessRuleError(
            "A Packaging Session may only include Trays from one Production Batch."
        )

    packaged_at = data.packaged_at or datetime.now(UTC)
    package_types = {
        package_type.id: package_type
        for package_type in db.scalars(
            select(PackageType).where(
                PackageType.id.in_([line.package_type_id for line in data.packages])
            )
        ).all()
    }
    storage_locations = _storage_locations_for_package_lines(db, data)
    _validate_package_lines(data, package_types, storage_locations)

    source_weight_grams = sum(
        (tray.final_dry_weight_grams for tray in trays),
        Decimal("0"),
    )
    allocated_finished_product_weight_grams = sum(
        (line.finished_product_weight_grams for line in data.packages),
        Decimal("0"),
    )
    _validate_complete_source_allocation(
        source_weight_grams,
        allocated_finished_product_weight_grams,
    )
    package_weight_grams = sum(
        (line.package_weight_grams for line in data.packages),
        Decimal("0"),
    )
    warnings = _packaging_warnings(source_weight_grams, package_weight_grams)

    operation = PackagingOperation(
        packaged_at=packaged_at,
        notes=_clean_optional_text(data.notes),
    )
    db.add(operation)
    db.flush()

    for tray in trays:
        db.add(
            PackagingOperationTray(
                packaging_operation_id=operation.id,
                tray_id=tray.id,
            )
        )
        tray.status = TrayStatus.PACKAGED
        db.add(tray)

    created_packages: list[Package] = []
    for line in data.packages:
        package_type = package_types[line.package_type_id]
        storage_location = _storage_location_for_line(
            line.storage_location_id,
            storage_locations,
        )
        package = Package(
            packaging_operation_id=operation.id,
            package_type_id=package_type.id,
            package_identifier=_next_package_identifier(db, packaged_at),
            package_weight_grams=line.package_weight_grams,
            finished_product_weight_grams=line.finished_product_weight_grams,
            oxygen_absorber=_effective_oxygen_absorber(
                line.oxygen_absorber,
                package_type,
            ),
            storage_location_id=storage_location.id,
            status=InventoryStatus.IN_STORAGE,
            notes=_clean_optional_text(line.notes),
        )
        db.add(package)
        db.flush()
        db.add(
            StorageLocationHistory(
                package_id=package.id,
                previous_storage_location_id=None,
                current_storage_location_id=storage_location.id,
                moved_at=packaged_at,
                notes="Initial placement during Packaging.",
            )
        )
        created_packages.append(package)

    db.commit()
    return {
        "packaging_operation": _get_packaging_operation(db, operation.id),
        "packages": [_get_package(db, package.id) for package in created_packages],
        "warnings": warnings,
        "source_weight_grams": source_weight_grams,
        "package_weight_grams": package_weight_grams,
        "labels": labels_for_packages(
            db,
            PackageLabelRequest(
                package_ids=[package.id for package in created_packages],
            ),
        ),
    }


def _validate_complete_source_allocation(
    source_weight_grams: Decimal,
    allocated_weight_grams: Decimal,
) -> None:
    difference = allocated_weight_grams - source_weight_grams
    if abs(difference) <= ALLOCATION_TOLERANCE_GRAMS:
        return

    if difference < 0:
        detail = f"{abs(difference)} g remain unallocated."
    else:
        detail = f"{difference} g are over allocated."
    raise BusinessRuleError(
        "Package Finished Product Weights must allocate the complete source "
        f"Finished Product Weight before Packaging can finish. {detail}"
    )


def labels_for_packages(
    db: Session,
    data: PackageLabelRequest,
) -> list[dict[str, object]]:
    packages = [_get_package(db, package_id) for package_id in data.package_ids]
    return [_label_data(package) for package in packages]


def get_package(db: Session, package_id: UUID) -> Package:
    return _get_package(db, package_id)


def _get_package_type(
    db: Session,
    package_type_id: UUID,
    *,
    allow_archived: bool = False,
) -> PackageType:
    package_type = db.get(PackageType, package_type_id)
    if package_type is None:
        raise BusinessRuleError("Package Type was not found.", status_code=404)
    if package_type.archived and not allow_archived:
        raise BusinessRuleError("Archived Package Types cannot be used for Packaging.")
    return package_type


def _get_package(db: Session, package_id: UUID) -> Package:
    package = db.scalar(
        select(Package)
        .where(Package.id == package_id)
        .options(
            selectinload(Package.package_type),
            selectinload(Package.storage_location),
            selectinload(Package.packaging_operation)
            .selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.production_batch)
            .selectinload(ProductionBatch.freeze_dryer),
            selectinload(Package.packaging_operation)
            .selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.weight_checks)
            .selectinload(WeightCheck.drying_run),
            selectinload(Package.packaging_operation)
            .selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.tray_slot),
            selectinload(Package.packaging_operation)
            .selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.physical_tray),
        )
    )
    if package is None:
        raise BusinessRuleError("Package was not found.", status_code=404)
    return package


def _get_packaging_operation(db: Session, operation_id: UUID) -> PackagingOperation:
    operation = db.scalar(
        select(PackagingOperation)
        .where(PackagingOperation.id == operation_id)
        .options(
            selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.production_batch)
            .selectinload(ProductionBatch.freeze_dryer),
            selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.tray_slot),
            selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.physical_tray),
            selectinload(PackagingOperation.tray_links)
            .selectinload(PackagingOperationTray.tray)
            .selectinload(Tray.weight_checks),
            selectinload(PackagingOperation.packages).selectinload(
                Package.package_type
            ),
            selectinload(PackagingOperation.packages).selectinload(
                Package.storage_location
            ),
        )
    )
    if operation is None:
        raise BusinessRuleError("Packaging Operation was not found.", status_code=404)
    return operation


def _get_eligible_trays(db: Session, tray_ids: list[UUID]) -> list[Tray]:
    unique_ids = list(dict.fromkeys(tray_ids))
    if len(unique_ids) != len(tray_ids):
        raise BusinessRuleError("A Tray can only be selected once for Packaging.")

    trays = list(
        db.scalars(
            select(Tray)
            .where(Tray.id.in_(unique_ids))
            .options(
                selectinload(Tray.production_batch).selectinload(
                    ProductionBatch.freeze_dryer
                ),
                selectinload(Tray.tray_slot),
                selectinload(Tray.physical_tray),
                selectinload(Tray.weight_checks),
                selectinload(Tray.packaging_operation_link),
            )
        ).all()
    )
    if len(trays) != len(unique_ids):
        raise BusinessRuleError(
            "One or more selected Trays were not found.",
            status_code=404,
        )
    for tray in trays:
        if tray.packaging_operation_link is not None:
            raise BusinessRuleError("Completed Trays can only be packaged once.")
        if tray.status != TrayStatus.COMPLETED:
            raise BusinessRuleError("Only Completed Trays are eligible for Packaging.")
        if tray.final_dry_weight_grams is None:
            raise BusinessRuleError(
                "Every selected Tray must have a Final Dry Weight before Packaging."
            )
    return sorted(trays, key=lambda tray: tray.tray_slot.slot_number)


def _validate_package_lines(
    data: PackageSelectedTrays,
    package_types: dict[UUID, PackageType],
    storage_locations: dict[UUID, StorageLocation],
) -> None:
    for line in data.packages:
        package_type = package_types.get(line.package_type_id)
        if package_type is None:
            raise BusinessRuleError("Package Type was not found.", status_code=404)
        if package_type.archived:
            raise BusinessRuleError(
                "Archived Package Types cannot be used for Packaging."
            )
        if line.package_weight_grams <= 0:
            raise BusinessRuleError("Sealed Package Weight must be greater than zero.")
        if line.finished_product_weight_grams <= 0:
            raise BusinessRuleError(
                "Finished Product Weight must be greater than zero."
            )
        if (
            line.storage_location_id is not None
            and line.storage_location_id not in storage_locations
        ):
            raise BusinessRuleError("Storage Location was not found.", status_code=404)
        if (
            line.storage_location_id is not None
            and storage_locations[line.storage_location_id].archived
        ):
            raise BusinessRuleError("Archived Storage Locations cannot be selected.")


def _storage_locations_for_package_lines(
    db: Session,
    data: PackageSelectedTrays,
) -> dict[UUID, StorageLocation]:
    storage_ids = {
        line.storage_location_id
        for line in data.packages
        if line.storage_location_id is not None
    }
    storage_locations = {
        location.id: location
        for location in db.scalars(
            select(StorageLocation).where(StorageLocation.id.in_(storage_ids))
        ).all()
    }
    unassigned = _get_or_create_unassigned_storage_location(db)
    storage_locations[unassigned.id] = unassigned
    return storage_locations


def _storage_location_for_line(
    storage_location_id: UUID | None,
    storage_locations: dict[UUID, StorageLocation],
) -> StorageLocation:
    if storage_location_id is None:
        return next(
            location
            for location in storage_locations.values()
            if location.name == UNASSIGNED_STORAGE_LOCATION_NAME
        )
    return storage_locations[storage_location_id]


def _get_or_create_unassigned_storage_location(db: Session) -> StorageLocation:
    location = db.scalar(
        select(StorageLocation).where(
            StorageLocation.name == UNASSIGNED_STORAGE_LOCATION_NAME
        )
    )
    if location is not None:
        if location.archived:
            location.archived = False
            db.add(location)
            db.flush()
        return location

    location = StorageLocation(
        name=UNASSIGNED_STORAGE_LOCATION_NAME,
        notes=(
            "System location for Packages created before a Storage Location "
            "is assigned."
        ),
        archived=False,
    )
    db.add(location)
    db.flush()
    return location


def _next_package_identifier(db: Session, packaged_at: datetime) -> str:
    year = packaged_at.year
    prefix = f"PKG-{year}-"
    existing_count = db.scalar(
        select(func.count(Package.id)).where(
            Package.package_identifier.like(f"{prefix}%")
        )
    )
    next_number = int(existing_count or 0) + 1
    while True:
        identifier = f"{prefix}{next_number:06d}"
        exists = db.scalar(
            select(Package.id).where(Package.package_identifier == identifier)
        )
        if exists is None:
            return identifier
        next_number += 1


def _effective_oxygen_absorber(
    override: str | None,
    package_type: PackageType,
) -> str | None:
    return _clean_optional_text(override) or package_type.default_oxygen_absorber


def _packaging_warnings(
    source_weight_grams: Decimal,
    package_weight_grams: Decimal,
) -> list[str]:
    if source_weight_grams == package_weight_grams:
        return []
    difference = package_weight_grams - source_weight_grams
    return [
        (
            "Package weights differ from the selected Tray Final Dry Weight total "
            f"by {difference} g. Review before sealing; this warning does not "
            "block Packaging."
        )
    ]


def _label_data(package: Package) -> dict[str, object]:
    trays = [link.tray for link in package.packaging_operation.tray_links]
    production_batch = trays[0].production_batch
    products = sorted({tray.product_name for tray in trays})
    product_summary = (
        products[0] if len(products) == 1 else "Mixed: " + ", ".join(products)
    )
    preparations = sorted(
        {
            tray.preparation.strip()
            for tray in trays
            if tray.preparation and tray.preparation.strip()
        }
    )
    preparation_summary = "; ".join(preparations) or "No preparation recorded"
    return {
        "package_id": package.id,
        "package_identifier": package.package_identifier,
        "batch_number": production_batch.batch_number,
        "freeze_dryer": production_batch.freeze_dryer.name,
        "product_summary": product_summary,
        "package_type": package.package_type.name,
        "finished_product_weight_grams": package.finished_product_weight_grams,
        "package_weight_grams": package.package_weight_grams,
        "fresh_equivalent_grams": _fresh_equivalent_grams(package, trays),
        "preparation_summary": preparation_summary,
        "oxygen_absorber": package.oxygen_absorber,
        "packaged_at": package.packaging_operation.packaged_at,
        "label_template": package.package_type.default_label_template,
    }


def _fresh_equivalent_grams(
    package: Package,
    trays: list[Tray],
) -> Decimal | None:
    finished_weight = package.finished_product_weight_grams
    if finished_weight is None:
        return None
    if any(
        tray.starting_weight_grams is None
        or tray.starting_weight_grams <= 0
        or tray.final_dry_weight_grams is None
        or tray.final_dry_weight_grams <= 0
        for tray in trays
    ):
        return None
    total_final = sum(
        (tray.final_dry_weight_grams for tray in trays),
        Decimal("0"),
    )
    total_starting = sum(
        (tray.starting_weight_grams for tray in trays),
        Decimal("0"),
    )
    return total_starting * (finished_weight / total_final)


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None

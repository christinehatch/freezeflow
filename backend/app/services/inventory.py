from uuid import UUID

from sqlalchemy import Subquery, func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    InventoryStatus,
    Package,
    PackageLabel,
    PackageStatusHistory,
    PackageType,
    PackagingAllocationSourceTray,
    StorageLocation,
    StorageLocationHistory,
    Tray,
)
from app.models.mixins import utc_now
from app.repositories import (
    package_status_history_repository,
    storage_location_history_repository,
    storage_location_repository,
)
from app.schemas import (
    PackageDeplete,
    PackageGiveAway,
    PackageMove,
    StorageLocationCreate,
    StorageLocationUpdate,
)
from app.services._naming import normalize_name
from app.services.errors import BusinessRuleError

UNASSIGNED_STORAGE_LOCATION_NAME = "Unassigned"
DEFAULT_SEARCH_LIMIT = 50
MAX_SEARCH_LIMIT = 100


def list_storage_locations(
    db: Session, *, include_archived: bool = False
) -> list[StorageLocation]:
    _get_or_create_unassigned_storage_location(db)
    db.commit()
    statement = select(StorageLocation).order_by(StorageLocation.name)
    if not include_archived:
        statement = statement.where(StorageLocation.archived.is_(False))
    return list(db.scalars(statement).all())


def get_storage_location(db: Session, storage_location_id: UUID) -> StorageLocation:
    location = db.get(StorageLocation, storage_location_id)
    if location is None:
        raise BusinessRuleError("Storage Location does not exist.")
    return location


def create_storage_location(
    db: Session, data: StorageLocationCreate
) -> StorageLocation:
    name = _normalize_name(data.name)
    _ensure_name_valid_and_available(db, name)
    location = storage_location_repository.create(
        db,
        {
            "name": name,
            "notes": _clean_optional_text(data.notes),
            "archived": False,
        },
    )
    db.commit()
    return location


def update_storage_location(
    db: Session, storage_location_id: UUID, data: StorageLocationUpdate
) -> StorageLocation:
    location = get_storage_location(db, storage_location_id)
    values = data.model_dump(exclude_unset=True)
    values.pop("archived", None)
    if "name" in values:
        if location.name == UNASSIGNED_STORAGE_LOCATION_NAME:
            raise BusinessRuleError(
                "The Unassigned Storage Location cannot be renamed."
            )
        name = _normalize_name(values["name"])
        _ensure_name_valid_and_available(db, name, exclude_id=location.id)
        values["name"] = name
    if "notes" in values:
        values["notes"] = _clean_optional_text(values["notes"])
    updated = storage_location_repository.update(db, location, values)
    db.commit()
    return updated


def archive_storage_location(db: Session, storage_location_id: UUID) -> StorageLocation:
    location = get_storage_location(db, storage_location_id)
    if location.name == UNASSIGNED_STORAGE_LOCATION_NAME:
        raise BusinessRuleError("The Unassigned Storage Location cannot be archived.")
    if location.archived:
        raise BusinessRuleError("Storage Location is already archived.")
    updated = storage_location_repository.update(db, location, {"archived": True})
    db.commit()
    return updated


def restore_storage_location(db: Session, storage_location_id: UUID) -> StorageLocation:
    location = get_storage_location(db, storage_location_id)
    if not location.archived:
        raise BusinessRuleError("Storage Location is not archived.")
    _ensure_name_valid_and_available(db, location.name, exclude_id=location.id)
    updated = storage_location_repository.update(db, location, {"archived": False})
    db.commit()
    return updated


def move_package(db: Session, package_id: UUID, data: PackageMove) -> Package:
    package = _get_package(db, package_id)
    _ensure_in_storage(package, "moved")
    destination = get_storage_location(db, data.storage_location_id)
    if destination.archived:
        raise BusinessRuleError("Archived Storage Locations cannot receive Packages.")
    if destination.id == package.storage_location_id:
        raise BusinessRuleError("Package is already in that Storage Location.")
    try:
        previous_location_id = package.storage_location_id
        moved_at = data.moved_at or utc_now()
        package.storage_location_id = destination.id
        db.flush()
        storage_location_history_repository.create(
            db,
            {
                "package_id": package.id,
                "previous_storage_location_id": previous_location_id,
                "current_storage_location_id": destination.id,
                "moved_at": moved_at,
                "notes": _clean_optional_text(data.notes),
            },
        )
        db.commit()
    except (BusinessRuleError, ValueError):
        db.rollback()
        raise
    db.refresh(package)
    return package


def give_away_package(db: Session, package_id: UUID, data: PackageGiveAway) -> Package:
    return _transition_package_status(
        db, package_id, InventoryStatus.GIVEN_AWAY, "given away", data
    )


def deplete_package(db: Session, package_id: UUID, data: PackageDeplete) -> Package:
    return _transition_package_status(
        db, package_id, InventoryStatus.DEPLETED, "depleted", data
    )


def get_package_storage_history(
    db: Session, package_id: UUID
) -> list[StorageLocationHistory]:
    _get_package(db, package_id)
    return list(
        db.scalars(
            select(StorageLocationHistory)
            .where(StorageLocationHistory.package_id == package_id)
            .order_by(StorageLocationHistory.moved_at, StorageLocationHistory.id)
        ).all()
    )


def get_package_status_history(
    db: Session, package_id: UUID
) -> list[PackageStatusHistory]:
    _get_package(db, package_id)
    return list(
        db.scalars(
            select(PackageStatusHistory)
            .where(PackageStatusHistory.package_id == package_id)
            .order_by(
                PackageStatusHistory.effective_at, PackageStatusHistory.recorded_at
            )
        ).all()
    )


def search_inventory(
    db: Session,
    *,
    query: str | None = None,
    statuses: list[InventoryStatus] | None = None,
    storage_location_id: UUID | None = None,
    product_name: str | None = None,
    package_type_id: UUID | None = None,
    limit: int = DEFAULT_SEARCH_LIMIT,
    offset: int = 0,
) -> dict[str, object]:
    limit = min(max(limit, 1), MAX_SEARCH_LIMIT)
    offset = max(offset, 0)

    product_name_subquery = _product_name_subquery()
    product_name_column = product_name_subquery.c.product_name

    statement = (
        select(Package)
        .join(PackageLabel, PackageLabel.package_id == Package.id)
        .join(StorageLocation, StorageLocation.id == Package.storage_location_id)
        .join(PackageType, PackageType.id == Package.package_type_id)
        .join(
            product_name_subquery,
            product_name_subquery.c.packaging_allocation_id
            == Package.packaging_allocation_id,
        )
        .where(Package.status.in_(statuses or [InventoryStatus.IN_STORAGE]))
    )

    if storage_location_id is not None:
        statement = statement.where(Package.storage_location_id == storage_location_id)
    if product_name is not None:
        statement = statement.where(
            func.lower(product_name_column) == product_name.strip().lower()
        )
    if package_type_id is not None:
        statement = statement.where(Package.package_type_id == package_type_id)

    trimmed_query = (query or "").strip()
    if trimmed_query:
        pattern = f"%{trimmed_query}%"
        statement = statement.where(
            or_(
                product_name_column.ilike(pattern),
                Package.package_identifier.ilike(pattern),
                PackageLabel.display_name.ilike(pattern),
                Package.notes.ilike(pattern),
                PackageLabel.preparation_summary.ilike(pattern),
                StorageLocation.name.ilike(pattern),
                PackageType.name.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    page_statement = (
        statement.order_by(product_name_column, Package.packaged_at)
        .limit(limit)
        .offset(offset)
    )
    packages = list(db.scalars(page_statement).all())
    return {"packages": packages, "total": total, "limit": limit, "offset": offset}


def list_product_groups(db: Session) -> list[dict[str, object]]:
    product_name_subquery = _product_name_subquery()
    product_name_column = product_name_subquery.c.product_name

    aggregate_statement = (
        select(
            product_name_column,
            func.count(Package.id).label("available_package_count"),
            func.min(Package.packaged_at).label("oldest_packaged_at"),
            func.max(Package.packaged_at).label("newest_packaged_at"),
        )
        .join(
            product_name_subquery,
            product_name_subquery.c.packaging_allocation_id
            == Package.packaging_allocation_id,
        )
        .where(Package.status == InventoryStatus.IN_STORAGE)
        .group_by(product_name_column)
        .order_by(product_name_column)
    )
    rows = db.execute(aggregate_statement).all()

    locations_subquery = _product_name_subquery()
    locations_statement = (
        select(locations_subquery.c.product_name, StorageLocation.name)
        .join(
            Package,
            Package.packaging_allocation_id
            == locations_subquery.c.packaging_allocation_id,
        )
        .join(StorageLocation, StorageLocation.id == Package.storage_location_id)
        .where(Package.status == InventoryStatus.IN_STORAGE)
        .distinct()
    )
    locations_by_product: dict[str, list[str]] = {}
    for row_product_name, location_name in db.execute(locations_statement).all():
        locations_by_product.setdefault(row_product_name, []).append(location_name)

    return [
        {
            "product_name": row.product_name,
            "available_package_count": row.available_package_count,
            "storage_locations": sorted(locations_by_product.get(row.product_name, [])),
            "oldest_packaged_at": row.oldest_packaged_at,
            "newest_packaged_at": row.newest_packaged_at,
        }
        for row in rows
    ]


def _product_name_subquery() -> Subquery:
    return (
        select(
            PackagingAllocationSourceTray.packaging_allocation_id.label(
                "packaging_allocation_id"
            ),
            func.min(Tray.product_name).label("product_name"),
        )
        .join(Tray, Tray.id == PackagingAllocationSourceTray.tray_id)
        .group_by(PackagingAllocationSourceTray.packaging_allocation_id)
        .subquery()
    )


def _transition_package_status(
    db: Session,
    package_id: UUID,
    new_status: InventoryStatus,
    action: str,
    data: PackageGiveAway | PackageDeplete,
) -> Package:
    package = _get_package(db, package_id)
    _ensure_in_storage(package, action)
    try:
        previous_status = package.status
        package.status = new_status
        db.flush()
        package_status_history_repository.create(
            db,
            {
                "package_id": package.id,
                "previous_status": previous_status,
                "current_status": new_status,
                "effective_at": data.effective_at or utc_now(),
                "notes": _clean_optional_text(data.notes),
            },
        )
        db.commit()
    except (BusinessRuleError, ValueError):
        db.rollback()
        raise
    db.refresh(package)
    return package


def _get_package(db: Session, package_id: UUID) -> Package:
    package = db.get(Package, package_id)
    if package is None:
        raise BusinessRuleError("Package does not exist.")
    return package


def _ensure_in_storage(package: Package, action: str) -> None:
    if package.status != InventoryStatus.IN_STORAGE:
        raise BusinessRuleError(f"Only an In Storage Package can be {action}.")


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


def _normalize_name(name: str) -> str:
    return normalize_name(name, label="Storage Location")


def _ensure_name_valid_and_available(
    db: Session, name: str, *, exclude_id: UUID | None = None
) -> None:
    if name.lower() == UNASSIGNED_STORAGE_LOCATION_NAME.lower():
        raise BusinessRuleError(
            'The name "Unassigned" is reserved for the system-provided '
            "Storage Location."
        )
    statement = select(StorageLocation).where(
        func.lower(StorageLocation.name) == name.lower()
    )
    if exclude_id is not None:
        statement = statement.where(StorageLocation.id != exclude_id)
    existing = db.scalar(statement)
    if existing is not None:
        raise BusinessRuleError(f'A Storage Location named "{name}" already exists.')


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None

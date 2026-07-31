from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    InventoryStatus,
    Package,
    PackageLabel,
    PackageStatusHistory,
    StorageLocation,
    StorageLocationHistory,
)
from app.models.mixins import utc_now
from app.repositories.base import Repository
from app.schemas import PackageCreate, PackageUpdate


class PackageRepository(Repository[Package, PackageCreate, PackageUpdate]):
    def __init__(self) -> None:
        super().__init__(Package)

    def create(
        self,
        db: Session,
        data: PackageCreate | dict[str, Any],
    ) -> Package:
        values = self._to_dict(data, exclude_none=False, exclude_unset=False)
        label_values = values.pop("label", None)
        if values.get("storage_location_id") is None:
            values["storage_location_id"] = self._get_unassigned_location(db).id
        values["status"] = InventoryStatus.IN_STORAGE
        package = Package(**values)
        db.add(package)
        db.flush()

        recorded_at = utc_now()
        db.add(
            PackageStatusHistory(
                package_id=package.id,
                previous_status=None,
                current_status=package.status,
                effective_at=package.packaged_at,
                recorded_at=recorded_at,
                notes="Initial package inventory status.",
            )
        )
        db.add(
            StorageLocationHistory(
                package_id=package.id,
                previous_storage_location_id=None,
                current_storage_location_id=package.storage_location_id,
                moved_at=package.packaged_at,
                notes="Initial package storage location.",
            )
        )

        label_values = label_values or {
            "display_name": package.package_identifier,
        }
        db.add(PackageLabel(package_id=package.id, **label_values))
        db.flush()
        db.refresh(package)
        return package

    def _get_unassigned_location(self, db: Session) -> StorageLocation:
        location = db.scalar(
            select(StorageLocation)
            .where(StorageLocation.name == "Unassigned")
            .order_by(StorageLocation.id)
        )
        if location is None:
            location = StorageLocation(
                name="Unassigned",
                notes="System-provided location for Packages not yet assigned.",
                archived=False,
            )
            db.add(location)
            db.flush()
        return location


package_repository = PackageRepository()

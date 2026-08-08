from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    PackagingAllocation,
    PackagingAllocationSourceTray,
    PackagingLoss,
    PackagingOperation,
    PackagingOperationStatus,
    PlannedPackageRow,
    Tray,
    TrayStatus,
)
from app.repositories.base import Repository
from app.repositories.package_history import AppendOnlyRepository
from app.schemas import (
    PackagingAllocationCreate,
    PackagingAllocationSourceTrayCreate,
    PackagingAllocationUpdate,
    PackagingOperationCreate,
    PackagingOperationUpdate,
    PlannedPackageRowCreate,
    PlannedPackageRowUpdate,
)


class PackagingOperationRepository(
    Repository[PackagingOperation, PackagingOperationCreate, PackagingOperationUpdate]
):
    def __init__(self) -> None:
        super().__init__(PackagingOperation)

    def complete(
        self,
        db: Session,
        operation: PackagingOperation,
        *,
        completed_at: datetime | None = None,
    ) -> PackagingOperation:
        if operation.status != PackagingOperationStatus.OPEN:
            raise ValueError("Only an Open Packaging Operation may be completed.")

        operation.status = PackagingOperationStatus.COMPLETED
        operation.completed_at = completed_at or datetime.now(UTC)
        db.add(operation)
        db.flush()
        db.refresh(operation)
        return operation


class PackagingAllocationRepository(
    Repository[
        PackagingAllocation,
        PackagingAllocationCreate,
        PackagingAllocationUpdate,
    ]
):
    def __init__(self) -> None:
        super().__init__(PackagingAllocation)

    def create_with_sources(
        self,
        db: Session,
        *,
        packaging_operation_id: UUID,
        tray_ids: list[UUID],
        notes: str | None = None,
    ) -> PackagingAllocation:
        if not tray_ids:
            raise ValueError(
                "A Packaging Allocation requires at least one source Tray."
            )
        if len(set(tray_ids)) != len(tray_ids):
            raise ValueError("A source Tray may only appear once in an Allocation.")

        operation = db.get(PackagingOperation, packaging_operation_id)
        if operation is None:
            raise ValueError("Packaging Operation does not exist.")
        if operation.status != PackagingOperationStatus.OPEN:
            raise ValueError("Allocations may only be added to an Open operation.")

        trays = list(db.scalars(select(Tray).where(Tray.id.in_(tray_ids))).all())
        if len(trays) != len(tray_ids):
            raise ValueError("Every source Tray must exist.")

        linked_tray_ids = set(
            db.scalars(
                select(PackagingAllocationSourceTray.tray_id).where(
                    PackagingAllocationSourceTray.tray_id.in_(tray_ids)
                )
            ).all()
        )
        if linked_tray_ids:
            raise ValueError(
                "A completed Tray may only belong to one Packaging Allocation."
            )

        for tray in trays:
            if tray.status != TrayStatus.COMPLETED:
                raise ValueError("Only Completed Trays may supply an Allocation.")
            if tray.production_batch_id != operation.production_batch_id:
                raise ValueError(
                    "Every source Tray must belong to the operation's Production Batch."
                )

        allocation = PackagingAllocation(
            packaging_operation_id=operation.id,
            notes=notes,
        )
        db.add(allocation)
        db.flush()
        db.add_all(
            PackagingAllocationSourceTray(
                packaging_allocation_id=allocation.id,
                tray_id=tray_id,
            )
            for tray_id in tray_ids
        )
        db.flush()
        db.refresh(allocation)
        return allocation


class PackagingAllocationSourceTrayRepository:
    """Source links are explicit and immutable once recorded."""

    def create(
        self,
        db: Session,
        data: PackagingAllocationSourceTrayCreate | dict[str, Any],
    ) -> PackagingAllocationSourceTray:
        values = data.model_dump() if isinstance(data, BaseModel) else data
        source = PackagingAllocationSourceTray(**values)
        db.add(source)
        db.flush()
        db.refresh(source)
        return source

    def get(self, db: Session, id: UUID) -> PackagingAllocationSourceTray | None:
        return db.get(PackagingAllocationSourceTray, id)

    def list(self, db: Session) -> list[PackagingAllocationSourceTray]:
        return list(db.scalars(select(PackagingAllocationSourceTray)).all())


class PlannedPackageRowRepository(
    Repository[PlannedPackageRow, PlannedPackageRowCreate, PlannedPackageRowUpdate]
):
    def __init__(self) -> None:
        super().__init__(PlannedPackageRow)


packaging_operation_repository = PackagingOperationRepository()
packaging_allocation_repository = PackagingAllocationRepository()
packaging_allocation_source_tray_repository = PackagingAllocationSourceTrayRepository()
planned_package_row_repository = PlannedPackageRowRepository()
packaging_loss_repository = AppendOnlyRepository[PackagingLoss](PackagingLoss)

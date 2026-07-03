from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TraySlot
from app.repositories.base import Repository
from app.schemas import TraySlotCreate, TraySlotUpdate


class TraySlotRepository(Repository[TraySlot, TraySlotCreate, TraySlotUpdate]):
    def __init__(self) -> None:
        super().__init__(TraySlot)

    def list_for_freeze_dryer(
        self,
        db: Session,
        freeze_dryer_id: UUID,
    ) -> list[TraySlot]:
        return list(
            db.scalars(
                select(TraySlot)
                .where(TraySlot.freeze_dryer_id == freeze_dryer_id)
                .order_by(TraySlot.slot_number)
            ).all()
        )


tray_slot_repository = TraySlotRepository()

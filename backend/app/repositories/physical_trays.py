from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PhysicalTray
from app.repositories.base import Repository
from app.schemas import PhysicalTrayCreate, PhysicalTrayUpdate


class PhysicalTrayRepository(
    Repository[PhysicalTray, PhysicalTrayCreate, PhysicalTrayUpdate]
):
    def __init__(self) -> None:
        super().__init__(PhysicalTray)

    def get_by_label(self, db: Session, label: str) -> PhysicalTray | None:
        return db.scalar(select(PhysicalTray).where(PhysicalTray.label == label))


physical_tray_repository = PhysicalTrayRepository()

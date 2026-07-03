from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FreezeDryer
from app.repositories.base import Repository
from app.schemas import FreezeDryerCreate, FreezeDryerUpdate


class FreezeDryerRepository(
    Repository[FreezeDryer, FreezeDryerCreate, FreezeDryerUpdate]
):
    def __init__(self) -> None:
        super().__init__(FreezeDryer)

    def get_by_name(self, db: Session, name: str) -> FreezeDryer | None:
        return db.scalar(select(FreezeDryer).where(FreezeDryer.name == name))

    def create(
        self,
        db: Session,
        data: FreezeDryerCreate | dict[str, object],
    ) -> FreezeDryer:
        values = self._to_dict(data, exclude_none=True, exclude_unset=False)
        values.pop("tray_slot_count", None)
        return super().create(db, values)

    def update(
        self,
        db: Session,
        db_obj: FreezeDryer,
        data: FreezeDryerUpdate | dict[str, object],
    ) -> FreezeDryer:
        values = self._to_dict(data, exclude_none=False, exclude_unset=True)
        values.pop("tray_slot_count", None)
        return super().update(db, db_obj, values)


freeze_dryer_repository = FreezeDryerRepository()

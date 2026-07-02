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


freeze_dryer_repository = FreezeDryerRepository()

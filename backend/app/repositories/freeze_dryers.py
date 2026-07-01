from app.models import FreezeDryer
from app.repositories.base import Repository
from app.schemas import FreezeDryerCreate, FreezeDryerUpdate


class FreezeDryerRepository(
    Repository[FreezeDryer, FreezeDryerCreate, FreezeDryerUpdate]
):
    def __init__(self) -> None:
        super().__init__(FreezeDryer)


freeze_dryer_repository = FreezeDryerRepository()

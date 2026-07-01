from app.models import WeightCheck
from app.repositories.base import Repository
from app.schemas import WeightCheckCreate, WeightCheckUpdate


class WeightCheckRepository(
    Repository[WeightCheck, WeightCheckCreate, WeightCheckUpdate]
):
    def __init__(self) -> None:
        super().__init__(WeightCheck)


weight_check_repository = WeightCheckRepository()

from app.models import DryingRun
from app.repositories.base import Repository
from app.schemas import DryingRunCreate, DryingRunUpdate


class DryingRunRepository(Repository[DryingRun, DryingRunCreate, DryingRunUpdate]):
    def __init__(self) -> None:
        super().__init__(DryingRun)


drying_run_repository = DryingRunRepository()

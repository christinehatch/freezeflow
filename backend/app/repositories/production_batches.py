from app.models import ProductionBatch
from app.repositories.base import Repository
from app.schemas import ProductionBatchCreate, ProductionBatchUpdate


class ProductionBatchRepository(
    Repository[ProductionBatch, ProductionBatchCreate, ProductionBatchUpdate]
):
    def __init__(self) -> None:
        super().__init__(ProductionBatch)


production_batch_repository = ProductionBatchRepository()

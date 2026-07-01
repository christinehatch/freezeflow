from app.models import StorageLocation, StorageLocationHistory
from app.repositories.base import Repository
from app.schemas import (
    StorageLocationCreate,
    StorageLocationHistoryCreate,
    StorageLocationHistoryUpdate,
    StorageLocationUpdate,
)


class StorageLocationRepository(
    Repository[StorageLocation, StorageLocationCreate, StorageLocationUpdate]
):
    def __init__(self) -> None:
        super().__init__(StorageLocation)


class StorageLocationHistoryRepository(
    Repository[
        StorageLocationHistory,
        StorageLocationHistoryCreate,
        StorageLocationHistoryUpdate,
    ]
):
    def __init__(self) -> None:
        super().__init__(StorageLocationHistory)


storage_location_repository = StorageLocationRepository()
storage_location_history_repository = StorageLocationHistoryRepository()

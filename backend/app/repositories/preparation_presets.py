from app.models import PreparationPreset
from app.repositories.base import Repository
from app.schemas import PreparationPresetCreate, PreparationPresetUpdate


class PreparationPresetRepository(
    Repository[PreparationPreset, PreparationPresetCreate, PreparationPresetUpdate]
):
    def __init__(self) -> None:
        super().__init__(PreparationPreset)


preparation_preset_repository = PreparationPresetRepository()

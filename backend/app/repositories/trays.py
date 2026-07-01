from app.models import Tray
from app.repositories.base import Repository
from app.schemas import TrayCreate, TrayUpdate


class TrayRepository(Repository[Tray, TrayCreate, TrayUpdate]):
    def __init__(self) -> None:
        super().__init__(Tray)


tray_repository = TrayRepository()

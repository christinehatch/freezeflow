from app.models import PackagingOperation, PackagingOperationTray
from app.repositories.base import Repository
from app.schemas import (
    PackagingOperationCreate,
    PackagingOperationTrayCreate,
    PackagingOperationTrayUpdate,
    PackagingOperationUpdate,
)


class PackagingOperationRepository(
    Repository[PackagingOperation, PackagingOperationCreate, PackagingOperationUpdate]
):
    def __init__(self) -> None:
        super().__init__(PackagingOperation)


class PackagingOperationTrayRepository(
    Repository[
        PackagingOperationTray,
        PackagingOperationTrayCreate,
        PackagingOperationTrayUpdate,
    ]
):
    def __init__(self) -> None:
        super().__init__(PackagingOperationTray)


packaging_operation_repository = PackagingOperationRepository()
packaging_operation_tray_repository = PackagingOperationTrayRepository()

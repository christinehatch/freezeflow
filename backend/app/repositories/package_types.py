from app.models import PackageType
from app.repositories.base import Repository
from app.schemas import PackageTypeCreate, PackageTypeUpdate


class PackageTypeRepository(
    Repository[PackageType, PackageTypeCreate, PackageTypeUpdate]
):
    def __init__(self) -> None:
        super().__init__(PackageType)


package_type_repository = PackageTypeRepository()

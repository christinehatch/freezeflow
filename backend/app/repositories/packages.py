from app.models import Package
from app.repositories.base import Repository
from app.schemas import PackageCreate, PackageUpdate


class PackageRepository(Repository[Package, PackageCreate, PackageUpdate]):
    def __init__(self) -> None:
        super().__init__(Package)


package_repository = PackageRepository()

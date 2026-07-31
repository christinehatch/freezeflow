from app.models import PackageLabel
from app.repositories.base import Repository
from app.schemas import PackageLabelCreate, PackageLabelUpdate


class PackageLabelRepository(
    Repository[PackageLabel, PackageLabelCreate, PackageLabelUpdate]
):
    def __init__(self) -> None:
        super().__init__(PackageLabel)


package_label_repository = PackageLabelRepository()

from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PackageStatusHistory, PackagingLoss, PrintEvent


class AppendOnlyRepository[ModelT: PackageStatusHistory | PrintEvent | PackagingLoss]:
    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    def create(self, db: Session, data: BaseModel | dict[str, Any]) -> ModelT:
        values = (
            data.model_dump(exclude_none=False) if isinstance(data, BaseModel) else data
        )
        record = self.model(**values)
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    def get(self, db: Session, id: UUID) -> ModelT | None:
        return db.get(self.model, id)

    def list(self, db: Session) -> list[ModelT]:
        return list(db.scalars(select(self.model)).all())


package_status_history_repository = AppendOnlyRepository[PackageStatusHistory](
    PackageStatusHistory
)
print_event_repository = AppendOnlyRepository[PrintEvent](PrintEvent)

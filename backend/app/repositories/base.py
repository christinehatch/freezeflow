from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.base import Base


class Repository[ModelT: Base, CreateSchemaT: BaseModel, UpdateSchemaT: BaseModel]:
    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    def create(self, db: Session, data: CreateSchemaT | dict[str, Any]) -> ModelT:
        values = self._to_dict(data, exclude_none=True, exclude_unset=False)
        db_obj = self.model(**values)
        db.add(db_obj)
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def get(self, db: Session, id: UUID) -> ModelT | None:
        return db.get(self.model, id)

    def list(self, db: Session) -> list[ModelT]:
        return list(db.scalars(select(self.model)).all())

    def delete(self, db: Session, db_obj: ModelT) -> None:
        db.delete(db_obj)
        db.flush()

    def update(
        self,
        db: Session,
        db_obj: ModelT,
        data: UpdateSchemaT | dict[str, Any],
    ) -> ModelT:
        values = self._to_dict(data, exclude_none=False, exclude_unset=True)
        for field, value in values.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def _to_dict(
        self,
        data: BaseModel | dict[str, Any],
        *,
        exclude_none: bool,
        exclude_unset: bool,
    ) -> dict[str, Any]:
        if isinstance(data, BaseModel):
            return data.model_dump(
                exclude_none=exclude_none,
                exclude_unset=exclude_unset,
            )
        return data

from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class FreezeDryerCreate(BaseModel):
    name: str
    notes: str | None = None
    archived: bool = False


class FreezeDryerUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    archived: bool | None = None


class FreezeDryerRead(FreezeDryerCreate, ReadSchema):
    id: UUID

from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PhysicalTrayCreate(BaseModel):
    label: str
    notes: str | None = None
    archived: bool = False


class PhysicalTrayUpdate(BaseModel):
    label: str | None = None
    notes: str | None = None
    archived: bool | None = None


class PhysicalTrayRead(PhysicalTrayCreate, ReadSchema):
    id: UUID

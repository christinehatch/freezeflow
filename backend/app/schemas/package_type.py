from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PackageTypeCreate(BaseModel):
    name: str
    default_oxygen_absorber: str | None = None
    default_label_template: str | None = None
    notes: str | None = None


class PackageTypeUpdate(BaseModel):
    name: str | None = None
    default_oxygen_absorber: str | None = None
    default_label_template: str | None = None
    notes: str | None = None
    archived: bool | None = None


class PackageTypeRead(PackageTypeCreate, ReadSchema):
    id: UUID
    archived: bool

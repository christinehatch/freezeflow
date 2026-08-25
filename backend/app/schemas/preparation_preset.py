from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PreparationPresetCreate(BaseModel):
    name: str
    product_name: str
    ingredients: list[str] = []
    preparation_methods: list[str] = []
    notes: str | None = None
    archived: bool = False


class PreparationPresetUpdate(BaseModel):
    name: str | None = None
    product_name: str | None = None
    ingredients: list[str] | None = None
    preparation_methods: list[str] | None = None
    notes: str | None = None
    archived: bool | None = None


class PreparationPresetRead(PreparationPresetCreate, ReadSchema):
    id: UUID

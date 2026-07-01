from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class RecipeCreate(BaseModel):
    name: str
    product_name: str
    preparation: str
    notes: str | None = None
    archived: bool = False


class RecipeUpdate(BaseModel):
    name: str | None = None
    product_name: str | None = None
    preparation: str | None = None
    notes: str | None = None
    archived: bool | None = None


class RecipeRead(RecipeCreate, ReadSchema):
    id: UUID

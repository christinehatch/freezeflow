from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import RecipeStatus
from app.schemas.base import ReadSchema


class RecipeCreate(BaseModel):
    name: str
    product: str
    preparation: str
    notes: str | None = None
    status: RecipeStatus = RecipeStatus.ACTIVE


class RecipeUpdate(BaseModel):
    name: str | None = None
    product: str | None = None
    preparation: str | None = None
    notes: str | None = None
    status: RecipeStatus | None = None


class RecipeRead(RecipeCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime

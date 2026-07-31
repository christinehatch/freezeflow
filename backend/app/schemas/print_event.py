from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class PrintEventCreate(BaseModel):
    package_label_id: UUID
    printed_at: datetime
    template: str
    print_job_id: UUID
    notes: str | None = None


class PrintEventRead(PrintEventCreate, ReadSchema):
    id: UUID
    recorded_at: datetime

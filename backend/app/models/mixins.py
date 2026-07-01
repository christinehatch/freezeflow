from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy.orm import Mapped, mapped_column

from app.database.types import GUID


def utc_now() -> datetime:
    return datetime.now(UTC)


class IdMixin:
    id: Mapped[UUID] = mapped_column(GUID(), primary_key=True, default=uuid4)

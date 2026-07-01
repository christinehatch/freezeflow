from app.models import AuditEntry
from app.repositories.base import Repository
from app.schemas import AuditEntryCreate, AuditEntryUpdate


class AuditEntryRepository(Repository[AuditEntry, AuditEntryCreate, AuditEntryUpdate]):
    def __init__(self) -> None:
        super().__init__(AuditEntry)


audit_entry_repository = AuditEntryRepository()

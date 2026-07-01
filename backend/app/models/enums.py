from enum import StrEnum


class InventoryStatus(StrEnum):
    IN_STORAGE = "in_storage"
    DEPLETED = "depleted"


class ProductionBatchStatus(StrEnum):
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RecipeStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class TrayStatus(StrEnum):
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    PACKAGED = "packaged"
    CANCELLED = "cancelled"


def enum_values(enum_class: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_class]

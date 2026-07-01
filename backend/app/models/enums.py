from enum import StrEnum


class InventoryStatus(StrEnum):
    IN_STORAGE = "In Storage"
    DEPLETED = "Depleted"


class ProductionBatchStatus(StrEnum):
    DRAFT = "Draft"
    RUNNING = "Running"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class TrayStatus(StrEnum):
    DRAFT = "Draft"
    RUNNING = "Running"
    COMPLETED = "Completed"
    PACKAGED = "Packaged"
    CANCELLED = "Cancelled"


def enum_values(enum_class: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_class]

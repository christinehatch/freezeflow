from enum import StrEnum


class InventoryStatus(StrEnum):
    IN_STORAGE = "In Storage"
    GIVEN_AWAY = "Given Away"
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


class DryingRunStatus(StrEnum):
    ACTIVE = "Active"
    COMPLETE = "Complete"
    VOIDED = "Voided"


class PackagingOperationStatus(StrEnum):
    OPEN = "Open"
    COMPLETED = "Completed"


class PackageLabelStatus(StrEnum):
    DRAFT = "Draft"
    READY = "Ready"
    NEEDS_REPRINT = "Needs Reprint"


class PackagingLossReason(StrEnum):
    SAMPLED = "Sampled"
    SPILLED = "Spilled"
    CRUMBS = "Crumbs"
    OTHER = "Other"


class FeedbackCategory(StrEnum):
    BUG = "Bug"
    CONFUSING = "Confusing"
    IMPROVEMENT = "Improvement"
    FEATURE_REQUEST = "Feature Request"
    QUESTION = "Question"


class FeedbackStatus(StrEnum):
    NEW = "New"
    REVIEWED = "Reviewed"
    FIXED = "Fixed"
    CLOSED = "Closed"


def enum_values(enum_class: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_class]

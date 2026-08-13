# Planned Package Row

## Purpose

A Planned Package Row is durable working state inside an Open Packaging
Allocation. It preserves package and label preparation across reloads without
creating a Package or inventory.

# Fields

| Field | Required | Notes |
| --- | --- | --- |
| id | Yes | Stable UUID |
| packagingAllocationId | Yes | Owning Allocation |
| packageTypeId | No | Current package plan |
| finishedProductWeight | No | Amount allocated to this planned row |
| sealedPackageWeight | No | Optional measured sealed weight |
| oxygenAbsorber | No | Suggested or overridden value |
| storageLocationId | No | Selected location; null resolves to Unassigned on record |
| notes | No | Package notes |
| labelDraft | Yes | Structured draft Package Label fields |
| recordedPackageId | No | Set when intentionally recorded as a Package |
| createdAt | Yes | Record timestamp |
| updatedAt | Yes | Last update timestamp |

# Behavior

Planned rows may be added, edited, or removed while the Operation is Open, but
only while unrecorded. They are not Packages, do not receive Package
Identifiers, and do not create inventory or history. Recording a row
atomically creates the Package, Package Label, initial `In Storage` Package
Status History, and initial Storage Location History.

From that point, the row is an immutable historical record: it is permanently
excluded from the add/edit/remove reconciliation used to save planned Package
rows, regardless of whether a later request includes or omits it. Reconciling
planned Package rows only ever describes the Allocation's current unrecorded
rows.

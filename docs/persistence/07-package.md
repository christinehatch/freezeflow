# Package

## Purpose

A Package represents one sealed unit of finished freeze-dried product.

Packages are the primary inventory objects managed by Freezeflow.

Users search for, store, move, and deplete Packages throughout their lifecycle.

Packages preserve the connection between inventory and historical production through their Packaging Operation.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| packagingAllocationId | Yes | No | Source Packaging Allocation |
| packageTypeId | Yes | Yes* | Selected Package Type |
| packageIdentifier | Yes | No | System-generated human-readable identifier |
| packagedAt | Yes | Yes* | Effective date/time the Package was recorded |
| storageLocationId | Yes | Yes* | Current Storage Location |
| packageWeightGrams | Yes | Yes* | Total sealed package weight |
| finishedProductWeightGrams | No** | Yes* | Freeze-dried food placed in the Package |
| oxygenAbsorber | No | Yes | Optional oxygen absorber information |
| notes | No | Yes*** | Optional package notes |
| status | Yes | System | Inventory lifecycle state |

\* Corrections follow the Audit History model defined in ADR-0005.

\*** Editable in principle under ADR-0005, but Milestone 5 does not ship a
notes-editing endpoint or UI. Package notes are read-only in Inventory through
Milestone 5; editing and correction history follow in Milestone 8.

\** Nullable for historical Packages; required by the current Packaging workflow.

---

# Relationships

A Package:

- belongs to one Packaging Allocation
- is traceable through that Allocation to one Packaging Operation and exact source Trays
- belongs to one Package Type
- belongs to one current Storage Location
- has many Storage Location History records
- has many Package Status History records
- owns exactly one Package Label

A Package does not own a Tray. Production traceability is preserved through the
Allocation's explicit source-Tray relationships.

---

# Historical Behavior

Packages are historical inventory records.

Moving a Package does not change its production history.

Changing a Storage Location does not affect production traceability.

Packages are never deleted.

Creating a Package automatically creates its initial In Storage Package Status History record.

Every later Inventory Status transition updates the Package's current status and appends a Package Status History record in the same transaction.

Creating a Package creates its one persistent Package Label from shared
Allocation defaults and Package-level overrides. Planned Package rows are
durable Open-operation work but are not inventory and never use a Draft Package
status.

Each Package records its effective `packagedAt` because a resumable operation may
record Packages at different times. The value defaults to now and may be entered
to reflect the real event time.

Package Fresh Equivalent is derived from Package Finished Product Weight and
the Packaging Allocation's source Tray weights. It is not persisted. Existing
`packageWeightGrams` values remain Sealed Package Weights.

---

# Lifecycle

Packages follow the lifecycle defined in ADR-0004.

Typical progression:

```text
In Storage
      ├── Given Away
      └── Depleted
```

Version 1 does not support:

- partially used Packages
- reopened Packages
- merged Packages
- split Packages

---

# Storage

Every Package has one current Storage Location.

If the user does not select a Storage Location during Packaging, the Package references the implicit Unassigned Storage Location.

Changing the Storage Location creates a Storage Location History record.

The current Storage Location always reflects the Package's present location.

---

# Inventory

Packages represent the smallest inventory unit in Version 1.

Inventory searches return Packages.

Users answer one question:

> "Do I still have this Package?"

Package-level inventory is defined in ADR-0007. The default Inventory browsing
view presents Packages grouped by Product; see ADR-0018.

---

# Business Rules

PA-001

Every Package belongs to exactly one Packaging Allocation.
The Allocation preserves the exact relationship between source Trays and the Package.

---

PA-002

A Package records the effective date/time at which the operator intentionally recorded it.

---

PA-003

Every Package belongs to exactly one Package Type.

---

PA-004

Every Package belongs to exactly one current Storage Location.

Packages created without a selected Storage Location belong to the implicit Unassigned Storage Location.

---

PA-005

A Package represents one sealed unit.

---

PA-006

Packages cannot be split after creation.

---

PA-007

Packages cannot be merged together.

---

PA-008

Moving a Package preserves its production history.

---

PA-009

Packages are never deleted.

---

PA-010

Inventory is tracked at the Package level.

---

PA-011

Marking a Package as Depleted removes it from active inventory but preserves its historical record.

---

PA-012

Marking a Package as Given Away removes it from active inventory counts but preserves its historical record.

Given Away means the Package left the user's inventory as a gift or transfer.

---

PA-013

Every Package has a system-generated Package identifier suitable for human-readable labels.

---

PA-014

Every Package has one current Inventory Status and an append-only Package Status History.

The Package's current Inventory Status must match its most recently recorded Package Status History event.

---

PA-015

Every Package owns exactly one editable Package Label.

Package Label edits and reprints never rewrite Production History, Package Identifier, Packaging Date, Package weights, or Inventory History.

---

PA-016

Package notes are read-only through Milestone 5. Editing Package notes and preserving prior values as append-only correction history are introduced in Milestone 8 (ADR-0005).

---

# Notes

Packages represent finished inventory.

Production history is preserved through the Packaging Operation, while inventory management is handled directly through the Package.

This separation allows production reporting and inventory management to evolve independently while maintaining complete traceability.

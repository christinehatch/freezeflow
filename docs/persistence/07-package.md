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
| packagingOperationId | Yes | No | Parent Packaging Operation |
| packageTypeId | Yes | Yes* | Selected Package Type |
| packageIdentifier | Yes | No | System-generated human-readable identifier |
| storageLocationId | Yes | Yes* | Current Storage Location |
| packageWeightGrams | Yes | Yes* | Total sealed package weight |
| oxygenAbsorber | No | Yes | Optional oxygen absorber information |
| notes | No | Yes | Optional package notes |
| status | Yes | System | Inventory lifecycle state |

\* Corrections follow the Audit History model defined in ADR-0005.

---

# Relationships

A Package:

- belongs to one Packaging Operation
- belongs to one Package Type
- belongs to one current Storage Location
- has many Storage Location History records

A Package does not belong directly to any Tray.

Production traceability is preserved through its Packaging Operation.

---

# Historical Behavior

Packages are historical inventory records.

Moving a Package does not change its production history.

Changing a Storage Location does not affect production traceability.

Packages are never deleted.

Packages do not store an independent packaging date.

The packaging date is inherited from the parent Packaging Operation.

All Packages created during the same Packaging Operation share the same `packagedAt` timestamp.

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

Package-level inventory is defined in ADR-0007.

---

# Business Rules

PA-001

Every Package belongs to exactly one Packaging Operation.
The Packaging Operation provides the historical packaging date and preserves the relationship between source Trays and resulting Packages.

---

PA-002

A Package inherits its packaging date from its parent Packaging Operation.

Packages created during the same Packaging Operation share the same packaging timestamp.

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

# Notes

Packages represent finished inventory.

Production history is preserved through the Packaging Operation, while inventory management is handled directly through the Package.

This separation allows production reporting and inventory management to evolve independently while maintaining complete traceability.

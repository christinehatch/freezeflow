# Storage Location History

## Purpose

A Storage Location History record represents a single movement of a Package from one Storage Location to another.

Storage Location History preserves the complete movement history of every Package while allowing the Package itself to reference only its current Storage Location.

Storage Location History records are historical and are never deleted.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| packageId | Yes | No | Package being moved |
| previousStorageLocationId | No | No | Previous Storage Location (null for the initial placement) |
| currentStorageLocationId | Yes | No | New Storage Location |
| movedAt | Yes | Yes* | Date and time of the movement |
| notes | No | Yes | Optional movement notes |

\* Corrections follow the Audit History model defined in ADR-0005.

---

# Relationships

A Storage Location History record:

- belongs to exactly one Package
- references one current Storage Location
- may reference one previous Storage Location

A Package:

- has many Storage Location History records

---

# Historical Behavior

Storage Location History records preserve the movement history of a Package.

Once created:

- the Package's current Storage Location is updated
- the historical movement is preserved permanently

Storage Location History records are append-only.

They are never deleted.

---

# Initial Placement

Creating a Package automatically creates its first Storage Location History record.

For the initial placement:

- previousStorageLocationId is null
- currentStorageLocationId is the Package's initial Storage Location or the implicit Unassigned Storage Location

No special handling is required.

The initial placement is simply the first historical movement.

---

# Package Movement

Whenever a Package is moved:

- a new Storage Location History record is created
- the Package's current Storage Location is updated

Previous Storage Location History records are never modified.

---

# Business Rules

SLH-001

Every Storage Location History record belongs to exactly one Package.

---

SLH-002

Every movement records the current Storage Location.

---

SLH-003

The initial placement of a Package is represented by a Storage Location History record with no previous Storage Location.

---

SLH-004

Storage Location History records are append-only.

---

SLH-005

Moving a Package never modifies previous Storage Location History records.

---

SLH-006

A Package's current Storage Location should always match the most recent Storage Location History record.

---

# Notes

Storage Location History exists to preserve historical inventory movement.

The Package represents the current state of inventory.

Storage Location History explains how the Package reached its current location.

This separation keeps current inventory simple while preserving complete historical traceability.

# Persistence Notes

Some relationships are implemented using association tables.

These tables exist to support the persistence layer and are not considered first-class business entities.

Current association tables include:

- PackagingOperationTray

# Storage Location

## Purpose

A Storage Location represents a physical place where Packages are stored.

Examples include:

- Pantry
- Freezer Shelf A
- Basement Bin
- Emergency Storage
- Unassigned

Storage Locations organize inventory but are not part of the production process.

Unassigned is a system-provided Storage Location used when the user does not select a specific Storage Location during Packaging.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| name | Yes | Yes | User-friendly location name |
| notes | No | Yes | Optional location notes |
| archived | Yes | Yes | Indicates whether the location may receive new Packages |

---

# Relationships

A Storage Location:

- contains zero or more current Packages
- has many historical Storage Location History records

A Package:

- belongs to exactly one current Storage Location

Historical movements are preserved separately.

---

# Historical Behavior

Storage Locations represent physical places.

Renaming a Storage Location updates its display name throughout the application.

Renaming a Storage Location does not create a Storage Location History record.

Packages preserve their movement history independently of the Storage Location.

---

# Lifecycle

Storage Locations may be:

- Active
- Archived
- System

Archived Storage Locations:

- cannot receive new Packages
- remain visible in historical records
- preserve historical traceability

Storage Locations should normally be archived rather than deleted.

The Unassigned Storage Location is a System location.

It should always be available during Packaging and should not be deleted or archived.

---

# Package Movement

Moving a Package does not modify the Storage Location.

Instead, the system creates a Storage Location History record describing the movement.

The Storage Location simply represents the current destination.

---

# Business Rules

SL-001

Every Package belongs to exactly one current Storage Location.

---

SL-002

Storage Locations may contain any number of Packages.

---

SL-003

Storage Locations should normally be archived rather than deleted.

---

SL-004

Archived Storage Locations cannot receive new Packages.

---

SL-004A

The Unassigned Storage Location receives Packages when no specific Storage Location is selected during Packaging.

---

SL-005

Renaming a Storage Location does not alter historical Package movement.

---

SL-006

Storage Locations are organizational records and are not part of the production history.

---

# Notes

Storage Locations organize inventory.

Historical movement is preserved through Storage Location History rather than by modifying the Storage Location itself.

This separation keeps inventory organization independent from historical traceability.

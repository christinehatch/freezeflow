# 08 - Data Model

# Purpose

This document defines the logical data model used by Freezeflow.

The data model describes the information that must be stored by the system and the relationships between entities.

This document intentionally avoids implementation details such as SQL, ORM frameworks, or programming languages.

It serves as the foundation for database design, API development, and application logic.

---

# Entity Relationship Overview

```text
Freeze Dryer ──< Tray Slot
Freeze Dryer ──< Production Batch ──< Tray >── Recipe
Production Batch ──< Drying Run
Physical Tray ───────────────────────> Tray
Tray ──< Weight Check >── Drying Run
Tray ──< Packaging Operation Tray >── Packaging Operation ──< Package >── Storage Location
Package Type ───────────────────────────────────────────────> Package
```

A Packaging Operation may contain one or more completed Trays.

A Packaging Operation may produce one or more Packages.

A Tray may participate in only one Packaging Operation.

---

# Recipe

Represents a reusable preparation template.

## Fields

| Field       | Type     | Notes                    |
| ----------- | -------- | ------------------------ |
| id          | UUID     | Primary identifier       |
| name        | String   | Display name             |
| product     | String   | Base product             |
| preparation | Text     | Preparation instructions |
| notes       | Text     | Optional                 |
| createdAt   | DateTime |                          |
| updatedAt   | DateTime |                          |

Recipes are templates.

Historical preparation information is stored on Trays.

---

# Freeze Dryer

Represents one physical freeze dryer.

## Fields

| Field        | Type              |
| ------------ | ----------------- |
| id           | UUID              |
| name         | String            |
| notes        | Text              |
| archived     | Boolean           |

---

# Tray Slot

Represents one position inside a Freeze Dryer.

## Fields

| Field         | Type    |
| ------------- | ------- |
| id            | UUID    |
| freezeDryerId | UUID    |
| slotNumber    | Integer |
| label         | String  |
| archived      | Boolean |

Tray Slots define Freeze Dryer capacity.

A Tray Slot does not represent a reusable Physical Tray.

---

# Physical Tray

Represents one reusable removable tray owned by the user.

## Fields

| Field     | Type    |
| --------- | ------- |
| id        | UUID    |
| label     | String  |
| tareWeightGrams | Decimal |
| notes     | Text    |
| archived  | Boolean |

Physical Trays exist independently from Freeze Dryers and Production Batches.

Physical Trays may store an optional tare weight in grams for reusable tray setup.

Future versions may add calibration notes or other physical characteristics.

---

# Production Batch

Represents one complete freeze-drying production session for one Freeze Dryer load.

## Fields

| Field         | Type                |
| ------------- | ------------------- |
| id            | UUID                |
| freezeDryerId | UUID                |
| batchNumber   | String              |
| startedAt     | DateTime (optional) |
| completedAt   | DateTime (optional) |
| notes         | Text                |

`startedAt` is unset while the Batch is in Draft and is set when the Batch transitions to Running.

`completedAt` is unset until every Tray has completed and the user explicitly completes the Batch.

The system should suggest the next Batch Number when creating a Draft Production Batch.

Users may edit the suggested Batch Number before saving the Draft.

---

# Tray

Represents one tray within a Production Batch.

## Fields

| Field             | Type               |
| ----------------- | ------------------ |
| id                | UUID               |
| productionBatchId | UUID               |
| physicalTrayId    | UUID               |
| traySlotId        | UUID               |
| recipeId          | UUID (optional)    |
| productName       | String             |
| preparation       | Text               |
| startingWeight    | Decimal (optional) |
| finalDryWeight    | Decimal (optional) |
| status            | Enum               |
| notes             | Text               |

The Recipe relationship is optional.

The product name and preparation fields preserve the historical preparation information used for the Tray.

Editing a Recipe does not update existing Trays.

The Physical Tray and Tray Slot preserve which reusable tray was placed in which Freeze Dryer position for that Production Batch.

---

# Drying Run

Represents one freeze dryer cycle or timer interval within a Running Production Batch.

## Fields

| Field             | Type                |
| ----------------- | ------------------- |
| id                | UUID                |
| productionBatchId | UUID                |
| status            | Enum                |
| startedAt         | DateTime            |
| endedAt           | DateTime (optional) |
| notes             | Text                |
| createdAt         | DateTime            |
| updatedAt         | DateTime            |

Drying Run status values:

* Active
* Complete
* Voided

Starting a Production Batch automatically creates the first Drying Run.

Only one Active Drying Run may exist for a Production Batch at a time.

Total drying time is derived from the sum of non-voided Drying Run durations.

---

# Weight Check

Represents one recorded weight during drying.

## Fields

| Field        | Type     |
| ------------ | -------- |
| id           | UUID     |
| trayId       | UUID     |
| dryingRunId  | UUID     |
| observedAt   | DateTime |
| recordedAt   | DateTime |
| weight       | Decimal  |
| notes        | Text     |

Weight Checks are append-only.

Every Weight Check belongs to exactly one Tray and exactly one Drying Run.

---

# Packaging Operation

Represents one packaging action.

The system creates a Packaging Operation when the user packages one or more completed Trays.

## Fields

| Field             | Type     |
| ----------------- | -------- |
| id                | UUID     |
| packagedAt        | DateTime |
| totalSourceWeight | Decimal  |
| notes             | Text     |
| createdAt         | DateTime |
| updatedAt         | DateTime |

---

# Packaging Operation Tray

Represents the relationship between completed Trays and a Packaging Operation.

This entity preserves traceability from Packages back to their source Trays.

## Fields

| Field                | Type |
| -------------------- | ---- |
| id                   | UUID |
| packagingOperationId | UUID |
| trayId               | UUID |

Business Rules:

* A Tray may appear in only one Packaging Operation.
* A Packaging Operation must reference one or more completed Trays.

---

# Package Type

Represents one reusable packaging format.

Package Types provide defaults during Packaging while allowing per-Package overrides.

## Fields

| Field | Type |
| ----- | ---- |
| id | UUID |
| name | String |
| defaultOxygenAbsorber | String |
| defaultLabelTemplate | Text |
| notes | Text |
| archived | Boolean |
| createdAt | DateTime |
| updatedAt | DateTime |

Examples:

* Pint Jar
* 1 qt Mylar
* 2 qt Mylar
* 2 gallon Mylar

---

# Package

Represents one sealed storage package.

## Fields

| Field                | Type     |
| -------------------- | -------- |
| id                   | UUID     |
| packagingOperationId | UUID     |
| packageTypeId        | UUID     |
| packageIdentifier    | String   |
| packageWeight        | Decimal  |
| finishedProductWeight | Decimal, nullable |
| oxygenAbsorber       | String   |
| storageLocationId    | UUID     |
| inventoryStatus      | Enum     |
| notes                | Text     |
| createdAt            | DateTime |
| updatedAt            | DateTime |

---

Packages do not store an independent package date.

The packaging date is inherited from the parent Packaging Operation's `packagedAt`.

Packages created without a selected Storage Location reference the implicit Unassigned Storage Location.

Package identifiers are generated by the system.

`packageWeight` is the Sealed Package Weight. `finishedProductWeight` is the
freeze-dried food placed into that Package. Historical records may leave the
latter null; existing sealed weights are not reinterpreted.

Package Fresh Equivalent is derived from `finishedProductWeight` and the
combined source Tray Starting and Final Dry Weights. It is not persisted.

# Storage Location

Represents where Packages are physically stored.

Unassigned is a system-provided Storage Location used when no specific Storage Location is selected during Packaging.

## Fields

| Field       | Type     |
| ----------- | -------- |
| id          | UUID     |
| name        | String   |
| description | Text     |
| createdAt   | DateTime |
| updatedAt   | DateTime |

---

# Enumerations

## Tray Status

```text
Draft

Running

Completed

Packaged
```

---

## Inventory Status

```text
In Storage

Given Away

Depleted
```

---

# Relationship Summary

## Recipe

1 Recipe

↓

Many Trays

The relationship is optional.

---

## Freeze Dryer

1 Freeze Dryer

↓

Many Production Batches

---

## Production Batch

1 Production Batch

↓

Many Trays

---

## Tray

1 Tray

↓

Many Weight Checks

---

## Packaging Operation

1 Packaging Operation

↓

Many Trays

(via Packaging Operation Tray)

↓

Many Packages

---

## Package Type

1 Package Type

↓

Many Packages

The relationship preserves which package format was selected while allowing Package-level details such as oxygen absorber and sealed weight to remain part of the Package record.

---

## Package

1 Package

↓

1 Packaging Operation

---

## Storage Location

1 Storage Location

↓

Many Packages

---

# Data Integrity Requirements

The following constraints must always be enforced.

* Every Tray belongs to one Production Batch.
* Every Tray records historical product and preparation information.
* A Tray may optionally reference the Recipe it was created from.
* Every Weight Check belongs to one Tray.
* Every Weight Check belongs to one Drying Run.
* Every Packaging Operation references one or more completed Trays.
* Every Package has a Package Type.
* Every Package belongs to one Storage Location.
* Every Package belongs to one Packaging Operation.
* A Tray may only appear in one Packaging Operation.
* A Packaging Operation may only reference Trays from one Production Batch.
* Historical records are never deleted.

---

# Future Expansion

The data model is intentionally designed for future growth.

Possible future entities include:

* Users
* Organizations
* Cost Tracking
* Suppliers
* Ingredients
* Label Templates
* QR Codes
* Attachments
* Photos
* Audit History

These entities should extend the existing model without changing the core relationships between Production Batches, Trays, Weight Checks, Packages, and Inventory.

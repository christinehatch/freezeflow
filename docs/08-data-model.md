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
Freeze Dryer ──< Production Batch ──< Tray >── Preparation Preset
Production Batch ──< Drying Run
Physical Tray ───────────────────────> Tray
Tray ──< Weight Check >── Drying Run
Production Batch ── Packaging Operation ──< Packaging Allocation
Tray ──< Packaging Allocation Tray >── Packaging Allocation ──< Package >── Storage Location
Package Type ─────────────────────────────────────────────────> Package ── Package Label ──< Print Event
```

A Packaging Operation may contain one or more Packaging Allocations that
reference completed Trays from its Production Batch.

A Packaging Operation may produce one or more Packages.

Completed product may participate in only one active Packaging Allocation at a
time.

---

# Preparation Preset

Represents an optional reusable combination of Preparation Metadata.

## Fields

| Field       | Type     | Notes                    |
| ----------- | -------- | ------------------------ |
| id          | UUID     | Primary identifier       |
| name        | String   | Display name             |
| product     | String   | Default Product          |
| ingredients | List     | Default Ingredients      |
| preparationMethods | List | Default Preparation Methods |
| notes       | Text     | Default processing Notes |
| createdAt   | DateTime |                          |
| updatedAt   | DateTime |                          |

Preparation Presets are data-entry conveniences.

Selecting a Preparation Preset copies its values into the Tray's immutable Preparation Metadata snapshot. A Tray does not require a preset.

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
| preparationPresetId | UUID (optional)  |
| productName       | String             |
| ingredients       | List               |
| preparationMethods | List              |
| startingWeight    | Decimal (optional) |
| finalDryWeight    | Decimal (optional) |
| status            | Enum               |
| notes             | Text               |

The Preparation Preset relationship is optional.

The Product, Ingredients, Preparation Methods, and Notes preserve the historical Preparation Metadata used for the Tray.

Editing a Preparation Preset does not update existing Trays.

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

Represents the resumable aggregate root for Packaging one Production Batch.

## Fields

| Field             | Type     |
| ----------------- | -------- |
| id                | UUID     |
| productionBatchId | UUID     |
| status            | Enum: Open, Completed |
| completedAt       | DateTime, nullable |
| notes             | Text     |
| createdAt         | DateTime |
| updatedAt         | DateTime |

---

# Packaging Allocation

Represents one identified product allocation inside a Packaging Operation.

It references the exact completed Trays supplying one or more Packages.

## Fields

| Field                | Type |
| -------------------- | ---- |
| id                   | UUID |
| packagingOperationId | UUID |
| notes                | Text, nullable |
| createdAt            | DateTime |
| updatedAt            | DateTime |

Business Rules:

* An Allocation belongs to exactly one Packaging Operation.
* An Allocation may exist before Packages are recorded.
* Source, allocated, and remaining weights are derived.

---

# Packaging Allocation Tray

Represents the source-Tray relationship owned by a Packaging Allocation.

| Field | Type |
| ----- | ---- |
| id | UUID |
| packagingAllocationId | UUID |
| trayId | UUID |

The same completed product may not belong to competing active Allocations.

---

# Planned Package Row

Represents durable planning data within an Open Packaging Allocation before a
Package is intentionally recorded.

| Field | Type |
| ----- | ---- |
| id | UUID |
| packagingAllocationId | UUID |
| packageTypeId | UUID, nullable |
| labelDraftData | JSON/Text, nullable |
| notes | Text, nullable |
| createdAt | DateTime |
| updatedAt | DateTime |

A Planned Package Row has no Package Identifier and is not inventory.

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
| packagingAllocationId | UUID     |
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

Packages record the effective Packaging Date used for the physical Package and
label presentation.

Packages created without a selected Storage Location reference the implicit Unassigned Storage Location.

Package identifiers are generated by the system.

`packageWeight` is the Sealed Package Weight. `finishedProductWeight` is the
freeze-dried food placed into that Package. Historical records may leave the
latter null; existing sealed weights are not reinterpreted.

Package Fresh Equivalent is derived from `finishedProductWeight` and the
combined source Tray Starting and Final Dry Weights. It is not persisted.

---

# Package Label

Represents the editable human-readable presentation printed for one Package.

## Fields

| Field | Type |
| ----- | ---- |
| id | UUID |
| packageId | UUID |
| displayName | String |
| subtitle | String, nullable |
| ingredientsSummary | Text, nullable |
| netWeightDisplay | String, nullable |
| freshEquivalentDisplay | String, nullable |
| preparationSummary | Text, nullable |
| servingNotes | Text, nullable |
| rehydrationInstructions | Text, nullable |
| status | Enum: Draft, Ready, Needs Reprint |
| createdAt | DateTime |
| updatedAt | DateTime |

Every Package owns exactly one Package Label.

Package Identifier and Packaging Date are rendered from the related Package.

Package Label edits overwrite the current label until Milestone 8 introduces revision history through Audit History. Label edits never modify Production History.

---

# Print Event

Represents one append-only label print or reprint event.

| Field | Type |
| ----- | ---- |
| id | UUID |
| packageLabelId | UUID |
| printedAt | DateTime |
| template | String |
| notes | Text, nullable |
| createdAt | DateTime |

Printing does not modify Production History or inventory lifecycle state.

---

# Package Status History

Represents one append-only Inventory lifecycle event for a Package.

## Fields

| Field          | Type              |
| -------------- | ----------------- |
| id             | UUID              |
| packageId      | UUID              |
| previousStatus | Enum, nullable    |
| currentStatus  | Enum              |
| effectiveAt    | DateTime          |
| recordedAt     | DateTime          |
| notes          | Text, nullable    |

---

Creating a Package automatically creates its initial In Storage Package Status History record.

Every later Inventory Status transition appends a new record. Existing Package Status History records are never edited or deleted.

# Storage Location

Represents where Packages are physically stored.

Unassigned is a system-provided Storage Location used when no specific Storage Location is selected during Packaging.

## Fields

| Field       | Type     |
| ----------- | -------- |
| id          | UUID     |
| name        | String   |
| description | Text     |
| archived    | Boolean  |
| createdAt   | DateTime |
| updatedAt   | DateTime |

Storage Location names are trimmed and case-insensitively unique across active
and archived locations. `Unassigned` is reserved and cannot be renamed,
archived, or restored (ADR business rules ST-004 through ST-006).

---

# Storage Location History

Represents one append-only movement of a Package between Storage Locations.

## Fields

| Field                     | Type              |
| ------------------------- | ----------------- |
| id                        | UUID              |
| packageId                 | UUID              |
| previousStorageLocationId | UUID, nullable    |
| currentStorageLocationId  | UUID              |
| movedAt                   | DateTime          |
| notes                     | Text, nullable    |

Creating a Package automatically creates its initial Storage Location History
record with a null `previousStorageLocationId`. Every later move appends a new
record; existing records are never edited or deleted (ADR-0006).

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

## Preparation Preset

1 Preparation Preset

↓

Many Trays

The relationship is optional. Trays preserve an immutable Preparation Metadata snapshot.

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

Many Packaging Allocations

Each Packaging Allocation references one or more completed source Trays and may
exist before any Packages are recorded.

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

1 Packaging Operation

↓

Many Packages

1 Package

↓

Many Package Status History records

1 Package

↓

1 Package Label

---

## Storage Location

1 Storage Location

↓

Many Packages

---

# Data Integrity Requirements

The following constraints must always be enforced.

* Every Tray belongs to one Production Batch.
* Every Tray records an immutable historical Preparation Metadata snapshot.
* A Tray may optionally reference the Preparation Preset it was created from.
* Every Weight Check belongs to one Tray.
* Every Weight Check belongs to one Drying Run.
* Every Packaging Operation references one or more completed Trays.
* Every Package has a Package Type.
* Every Package belongs to one Storage Location.
* Every Package belongs to one Packaging Operation.
* Every Package has one current Inventory Status.
* Every Package has one or more append-only Package Status History records.
* Every Package has exactly one editable Package Label.
* A Package's current Inventory Status matches its most recently recorded Package Status History event.
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
* Additional printable label layout and style definitions
* QR Codes
* Attachments
* Photos
* Audit History

These entities should extend the existing model without changing the core relationships between Production Batches, Trays, Weight Checks, Packages, and Inventory.

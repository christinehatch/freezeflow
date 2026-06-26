# 08 - Data Model

# Purpose

This document defines the logical data model used by Freezeflow.

The data model describes the information that must be stored by the system and the relationships between entities.

This document intentionally avoids implementation details such as SQL, ORM frameworks, or programming languages.

It serves as the foundation for database design, API development, and application logic.

---

# Entity Relationship Overview

```text
Freeze Dryer
    │
    ▼
Production Batch
    │
    ▼
Tray ◄── Recipe
    │
    ├──────────────────┐
    ▼                  ▼
Weight Check     Packaging Operation Tray
                         │
                         ▼
                 Packaging Operation
                         │
                         ▼
                     Package
                         │
                         ▼
                 Storage Location
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
| manufacturer | String            |
| model        | String            |
| serialNumber | String (optional) |
| trayCount    | Integer           |
| notes        | Text              |
| createdAt    | DateTime          |
| updatedAt    | DateTime          |

---

# Production Batch

Represents one complete freeze dryer run.

## Fields

| Field         | Type                |
| ------------- | ------------------- |
| id            | UUID                |
| freezeDryerId | UUID                |
| name          | String              |
| startedAt     | DateTime            |
| completedAt   | DateTime (optional) |
| notes         | Text                |
| createdAt     | DateTime            |
| updatedAt     | DateTime            |

---

# Tray

Represents one tray within a Production Batch.

## Fields

| Field             | Type               |
| ----------------- | ------------------ |
| id                | UUID               |
| productionBatchId | UUID               |
| recipeId          | UUID (optional)    |
| trayNumber        | Integer            |
| productName       | String             |
| preparation       | Text               |
| startingWeight    | Decimal            |
| finalDryWeight    | Decimal (optional) |
| status            | Enum               |
| notes             | Text               |
| createdAt         | DateTime           |
| updatedAt         | DateTime           |

The Recipe relationship is optional.

The product name and preparation fields preserve the historical preparation information used for the Tray.

Editing a Recipe does not update existing Trays.

---

# Weight Check

Represents one recorded weight during drying.

## Fields

| Field        | Type     |
| ------------ | -------- |
| id           | UUID     |
| trayId       | UUID     |
| recordedAt   | DateTime |
| elapsedHours | Decimal  |
| weight       | Decimal  |
| notes        | Text     |

Weight Checks are append-only.

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

# Package

Represents one sealed storage package.

## Fields

| Field                | Type     |
| -------------------- | -------- |
| id                   | UUID     |
| packagingOperationId | UUID     |
| packageDate          | DateTime |
| packageWeight        | Decimal  |
| oxygenAbsorber       | String   |
| storageLocationId    | UUID     |
| inventoryStatus      | Enum     |
| notes                | Text     |
| createdAt            | DateTime |
| updatedAt            | DateTime |

---

# Storage Location

Represents where Packages are physically stored.

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
* Every Packaging Operation references one or more completed Trays.
* Every Package belongs to one Storage Location.
* Every Package belongs to one Packaging Operation.
* A Tray may only appear in one Packaging Operation.
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

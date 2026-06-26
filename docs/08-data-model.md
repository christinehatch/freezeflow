# 08 - Data Model

# Purpose

This document defines the logical data model used by Freezeflow.

The data model describes the information that must be stored by the system and the relationships between entities.

This document intentionally avoids implementation details such as SQL, ORM frameworks, or programming languages.

It serves as the foundation for database design, API development, and application logic.

---

# Entity Relationship Overview

```text
Recipe
    │
    │ 1
    │
    └───────────────∞
                    │
             Production Batch
                    │
                    │ 1
                    │
                    └───────────────∞
                                    │
                                   Tray
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     │1                           │∞
                     ▼                             ▼
              Weight Check                  Package
                                                   │
                                                   │∞
                                                   ▼
                                            Storage Location
```

A Package may contain product from one or more completed Trays.

A Tray may contribute to only one Package.

---

# Recipe

Represents how a product is prepared.

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
| recipeId      | UUID (optional)     |
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
| trayNumber        | Integer            |
| product           | String             |
| startingWeight    | Decimal            |
| finalDryWeight    | Decimal (optional) |
| status            | Enum               |
| notes             | Text               |
| createdAt         | DateTime           |
| updatedAt         | DateTime           |

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

# Package

Represents one sealed storage package.

## Fields

| Field             | Type     |
| ----------------- | -------- |
| id                | UUID     |
| packageDate       | DateTime |
| packageWeight     | Decimal  |
| oxygenAbsorber    | String   |
| storageLocationId | UUID     |
| inventoryStatus   | Enum     |
| notes             | Text     |
| createdAt         | DateTime |
| updatedAt         | DateTime |

---

# Package Contents

Represents the relationship between completed Trays and Packages.

This entity preserves traceability.

## Fields

| Field     | Type |
| --------- | ---- |
| id        | UUID |
| packageId | UUID |
| trayId    | UUID |

Business Rules:

* A Tray may appear only once.
* A Package may reference multiple Trays.

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

Many Production Batches

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

## Package

1 Package

↓

Many Trays

(via Package Contents)

---

## Storage Location

1 Storage Location

↓

Many Packages

---

# Data Integrity Requirements

The following constraints must always be enforced.

* Every Tray belongs to one Production Batch.
* Every Weight Check belongs to one Tray.
* Every Package belongs to one Storage Location.
* Every Package references one or more completed Trays.
* A Tray may only appear in one Package.
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


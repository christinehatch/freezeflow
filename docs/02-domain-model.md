# 02 - Domain Model

# Purpose

This document defines the core objects (domain entities) that exist within Freezeflow.

These entities represent real-world concepts in the freeze-drying workflow rather than database tables or user interface components.

The domain model serves as the foundation for the application's architecture. All database models, API endpoints, business logic, and user interface screens should be based on these concepts.

---

# Domain Overview

```text
Recipe
    │
    ▼
Production Batch
    │
    ├──────────────┐
    ▼              ▼
Freeze Dryer     Tray
                    │
                    ▼
              Weight Check
                    │
                    ▼
           Packaging Batch
                    │
                    ▼
                Package
                    │
                    ▼
               Storage Bin
                    │
                    ▼
            Inventory Status
```

---

# Recipe

A Recipe describes how a product is prepared before freeze drying.

Recipes exist to reduce repetitive data entry and ensure preparation methods are recorded consistently.

A recipe may include:

* Product name
* Preparation method
* Ingredients
* Notes
* Default settings

Examples:

* Costco Grilled Chicken
* Taco Chicken
* Fresh Strawberries
* Skittles

Recipes may be reused across many production batches.

---

# Freeze Dryer

A Freeze Dryer represents one physical machine.

Examples:

* Freeze Dryer #1
* Freeze Dryer #2

Each freeze dryer may produce many production batches over its lifetime.

The system uses freeze dryer information to generate performance statistics.

---

# Production Batch

A Production Batch represents one complete freeze-drying run.

It begins when trays are loaded into a freeze dryer.

It ends when every tray in that batch has completed drying.

A production batch contains:

* Date
* Freeze dryer
* Operator (future)
* Notes
* One or more trays

A production batch is never deleted.

---

# Tray

A Tray represents one shelf inside a production batch.

Each tray contains a single prepared product.

A tray records:

* Product
* Starting weight
* Final dry weight
* Tray number
* Notes

Each tray belongs to exactly one production batch.

Each tray produces one finished dry product.

---

# Weight Check

A Weight Check records one measurement during the drying process.

Each weight check contains:

* Timestamp
* Elapsed drying time
* Recorded weight
* Optional notes

A tray may have many weight checks.

Weight checks preserve the complete drying history.

---

# Consolidated Lot

A Consolidated Lot represents one or more completed trays that are combined together after drying.

Only compatible trays should be combined.

Examples:

* Six trays of Taco Chicken
* Four trays of Strawberries

Important:

A tray may belong to only one consolidated lot.

Once assigned, it cannot be assigned again.

The consolidated lot becomes the source for packaging.

---

# Package

A Package represents one sealed storage bag.

A package records:

* Package date
* Package weight
* Oxygen absorber
* Notes

Packages are the primary inventory units.

Each package belongs to exactly one consolidated lot.

---

# Storage Bin

A Storage Bin represents the physical location where packages are stored.

Examples:

* Bin A
* Bin B
* Pantry
* Shelf 3

A storage bin may contain many packages.

Packages may be moved between storage bins while preserving history.

---

# Inventory Status

Inventory Status describes the current lifecycle state of a package.

Examples:

* In Storage
* Depleted

Inventory status allows users to keep historical production records while accurately representing current inventory.

Packages are never deleted when depleted.

---

# Relationships

The following relationships define the domain.

## Recipe

A Recipe may be used by many Production Batches.

---

## Freeze Dryer

A Freeze Dryer may perform many Production Batches.

---

## Production Batch

A Production Batch belongs to one Freeze Dryer.

A Production Batch contains one or more Trays.

---

## Tray

A Tray belongs to one Production Batch.

A Tray has many Weight Checks.

A Tray belongs to exactly one Consolidated Lot.

---

## Weight Check

A Weight Check belongs to one Tray.

---

## Consolidated Lot

A Consolidated Lot contains one or more Trays.

A Consolidated Lot produces one or more Packages.

---

## Package

A Package belongs to one Consolidated Lot.

A Package occupies one Storage Bin.

A Package has one Inventory Status.

---

## Storage Bin

A Storage Bin contains many Packages.

---

# Design Notes

The domain model intentionally separates production from inventory.

Inventory is considered the final stage of production rather than the primary purpose of the system.

Maintaining this separation allows Freezeflow to preserve complete traceability from finished inventory back to the original freeze-drying process.

Every production decision should remain connected to the finished package throughout the lifetime of the product.


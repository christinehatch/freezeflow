# 02 - Domain Model

# Purpose

This document defines the core objects (domain entities) that exist within Freezeflow.

These entities represent real-world concepts in the freeze-drying workflow rather than database tables or user interface components.

The domain model serves as the foundation for the application's architecture. All database models, API endpoints, business logic, and user interface screens should be based on these concepts.

---

# Domain Overview

```text
Freeze Dryer
    │
    ▼
Production Batch
    │
    ▼
Tray ◄── Recipe
    │
    ├───────────────┐
    ▼               ▼
Weight Check   Packaging Operation
                       │
                       ▼
                   Package
                       │
                       ▼
               Storage Location
                       │
                       ▼
               Inventory Status
```

---

# Recipe

A Recipe describes a reusable way to prepare a product before freeze drying.

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

Recipes are templates.

When a Tray is created from a Recipe, the relevant recipe information is copied onto the Tray as historical preparation data.

After the Tray is created, it no longer depends on the current state of the Recipe.

Recipes may be reused across many Trays.

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
* Recipe reference (optional)
* Historical preparation data
* Starting weight
* Final dry weight
* Tray number
* Notes

Each tray belongs to exactly one production batch.

Each tray produces one finished dry product.

Each tray owns the historical preparation information used for that tray.

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

# Packaging Operation

A Packaging Operation represents the act of converting one or more completed trays into one or more sealed packages.

Packaging Operations are internal records created automatically when the user packages selected trays.

Users do not manage Packaging Operations directly.

Only compatible trays should be included in the same Packaging Operation.

Examples:

* Six trays of Taco Chicken
* Four trays of Strawberries

Important:

A tray may belong to only one Packaging Operation.

Once assigned to a Packaging Operation, it cannot be assigned again.

The Packaging Operation preserves which trays were packaged together and becomes the source for one or more Packages.

A Packaging Operation may record the total source weight from all included trays.

---

# Package

A Package represents one sealed storage bag.

A package records:

* Package date
* Package weight
* Oxygen absorber
* Notes

Packages are the primary inventory units.

Each package belongs to exactly one Packaging Operation.

---

# Storage Location

A Storage Location represents the physical location where packages are stored.

Examples:

* Bin A
* Bin B
* Pantry
* Shelf 3

A storage location may contain many packages.

Packages may be moved between storage locations while preserving history.

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

A Recipe may be used by many Trays.

The Recipe relationship is optional.

Trays preserve their own historical preparation data even when they were created from a Recipe.

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

A completed Tray may belong to one Packaging Operation.

---

## Weight Check

A Weight Check belongs to one Tray.

---

## Packaging Operation

A Packaging Operation contains one or more completed Trays.

A Packaging Operation produces one or more Packages.

---

## Package

A Package belongs to one Packaging Operation.

A Package occupies one Storage Location.

A Package has one Inventory Status.

---

## Storage Location

A Storage Location contains many Packages.

---

# Design Notes

The domain model intentionally separates production from inventory.

Inventory is considered the final stage of production rather than the primary purpose of the system.

Maintaining this separation allows Freezeflow to preserve complete traceability from finished inventory back to the original freeze-drying process.

Every production decision should remain connected to the finished package throughout the lifetime of the product.

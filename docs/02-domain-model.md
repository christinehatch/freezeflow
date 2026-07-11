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
    ├───────────────┐
    ▼               ▼
Tray          Drying Run
    │               │
    ▼
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

# Domain Discovery Principles

Freezeflow models the user's real-world workflow.

The domain is not centered on inventory first.

It starts with food preparation and production history, then becomes inventory only after Packaging.

Many Freezeflow concepts have both:

* a current state used for daily workflow
* historical records that explain how that state was reached

ADR-0008 defines this event-oriented production history principle.

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

Recipes should reduce repeated typing, not replace the user's actual production notes.

Tray Preparation is the source of truth for what was actually made.

---

# Freeze Dryer

A Freeze Dryer represents one physical machine.

Examples:

* Freeze Dryer #1
* Freeze Dryer #2

Each freeze dryer may produce many production batches over its lifetime.

The system uses freeze dryer information to generate performance statistics.

Freeze Dryers are first-class domain objects because users reason about machines by identity, nickname, reliability, and performance.

Examples from the user's workflow may include machines named Black or White.

Detailed maintenance history is a future enhancement.

---

# Production Batch

A Production Batch represents one complete freeze-drying production session for one Freeze Dryer load.

It begins when the user starts production.

It ends when the user explicitly completes the Batch after every Tray in that Batch has completed drying.

A production batch contains:

* Freeze dryer
* Started date (`startedAt`, set when production begins)
* Completed date (`completedAt`, set when the user completes the Batch)
* Operator (future)
* Notes
* One or more trays
* One or more Drying Runs

A production batch is never deleted.

---

# Tray Slot

A Tray Slot represents one position inside a Freeze Dryer.

Tray Slots define Freeze Dryer capacity.

For example, a Freeze Dryer may have four Tray Slots while the user owns twelve reusable Physical Trays.

Tray Slots belong to the Freeze Dryer configuration.

Tray Slots are not historical production records.

---

# Physical Tray

A Physical Tray is a reusable removable tray owned by the user.

A Physical Tray may be placed into a Tray Slot during a Production Batch.

A Physical Tray may eventually store:

* tray identifier
* tare weight
* calibration notes
* physical or heat-behavior notes
* archived status

Physical Tray identity is distinct from the historical Tray record in a Production Batch.

---

# Tray

A Tray represents one loaded tray record inside a production batch.

Each tray contains a single prepared product.

A tray records:

* Tray Slot
* Physical Tray
* Product
* Recipe reference (optional)
* Historical preparation data
* Starting weight
* Final dry weight
* Notes

Freeform notes are first-class production history.

They may include shorthand, corrections, calculations, observations, and imperfect records.

Preparation should remain flexible and notebook-like.

Examples may include source, cut, seasoning, cooking method, whether the food was store-bought or home-processed, whether it was blanched or pre-frozen, and any other detail the user considers relevant.

Freezeflow should not force preparation into many required structured fields.

Starting weight is recorded when drying begins (Milestone 3), not during Milestone 2 tray setup.

Each tray belongs to exactly one production batch.

Each tray produces one finished dry product.

Each tray owns the historical preparation information used for that tray.

---

# Drying Run

A Drying Run represents one freeze dryer cycle or timer interval within a Running Production Batch.

A Production Batch may contain multiple Drying Runs.

Starting a Production Batch automatically creates the first Drying Run.

Each Drying Run contains:

* Production Batch
* Status
* Started time (`startedAt`)
* Ended time (`endedAt`, recorded by Current Run Complete)
* Optional notes

A Drying Run is not the same thing as a Production Batch.

A Drying Run is not the same thing as Tray completion.

Drying Runs preserve machine-cycle history and provide context for Weight Checks.

If a Drying Run was started by mistake, it may be marked Voided with notes rather than deleted.

Total drying time is derived from non-voided Drying Run durations.

---

# Weight Check

A Weight Check records one measurement during the drying process.

Each weight check contains:

* Tray
* Drying Run
* Observation timestamp
* Recorded timestamp
* Recorded weight
* Optional notes

A tray may have many weight checks.

A Drying Run may have many Weight Checks.

Weight checks preserve the complete drying history.

Weight Checks are historical observations.

They are part of the production timeline, not merely edits to a current weight field.

---

# Packaging Operation

A Packaging Operation represents the act of converting one or more completed trays into one or more sealed packages.

Packaging Operations are internal records created automatically when the user packages selected trays.

Users do not manage Packaging Operations directly.

Only compatible trays should be included in the same Packaging Operation.

For Version 1, compatible trays must come from the same Production Batch.

Because a Production Batch belongs to exactly one Freeze Dryer, this also preserves same-Freeze-Dryer packaging history.

The user may still decide which eligible trays should be packaged together.

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

* Package identifier
* Package Type
* Package weight
* Oxygen absorber
* Storage Location or Unassigned
* Notes

The Package inherits its packaging date from the parent Packaging Operation's `packagedAt`.

Packages are the primary inventory units.

Each package belongs to exactly one Packaging Operation.

Packages are preservation records before they are inventory search results.

They may carry notes such as rerun history, trust warnings, or special handling observations.

Package Types are reusable packaging formats such as Pint, Quart, 1 qt Mylar, or 2 gallon Mylar.

A Package Type may provide defaults such as oxygen absorber size and printable label template.

Milestone 4 Package Type defaults are limited to oxygen absorber and printable label template.

Package Types are not part of Milestone 2.

---

# Supplies

Supplies are materials used during Packaging.

Examples include:

* Mylar bags
* Oxygen absorbers
* Labels

Supplies are distinct from food inventory.

They may become first-class records in a future version to support package defaults, stock counts, and reorder reminders.

Supply tracking is not part of Version 1 unless explicitly added through updated roadmap and persistence documentation.

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
* Given Away
* Depleted

Inventory status allows users to keep historical production records while accurately representing current inventory.

Packages are never deleted when depleted.

Packages are also never deleted when given away.

Given Away indicates that the Package left the user's inventory as a gift or transfer.

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

A Freeze Dryer has one or more Tray Slots.

---

## Physical Tray

A Physical Tray may be used by many Trays over time.

A Physical Tray is selected for a Tray Slot during Production Batch setup.

---

## Production Batch

A Production Batch belongs to one Freeze Dryer.

A Production Batch contains one or more Trays.

A Production Batch has one or more Drying Runs after Production starts.

---

## Tray

A Tray belongs to one Production Batch.

A Tray has many Weight Checks.

A completed Tray may belong to one Packaging Operation.

---

## Weight Check

A Weight Check belongs to one Tray.

A Weight Check belongs to one Drying Run.

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

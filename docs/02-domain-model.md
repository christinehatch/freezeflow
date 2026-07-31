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

# Preparation Metadata

Preparation Metadata describes what was freeze dried and how it was prepared.

It may include:

* primary Product
* Ingredients and seasonings
* Preparation Methods
* processing Notes

Preparation Metadata is production history, not cooking instructions. A Tray owns
an immutable snapshot of the metadata recorded for that production use.

Users may enter one-off values directly. Reusable Ingredient and Preparation
Method suggestions should emerge naturally from prior entry and must not require
administrative setup before Production can continue.

# Preparation Preset

A Preparation Preset is an optional reusable combination of Product,
Ingredients, Preparation Methods, and default Notes.

Applying a Preparation Preset copies its values into the Tray's Preparation
Metadata snapshot. Later changes to the preset or reusable suggestions never
rewrite historical Trays. Production never requires a saved preset.

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
* Preparation Preset reference (optional)
* immutable Preparation Metadata snapshot
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

A Packaging Operation is the aggregate root and resumable workspace for converting
completed product from one Production Batch into labeled inventory.

It has an `Open` or `Completed` lifecycle. One Production Batch may have at most
one Open Packaging Operation. Users start, resume, and explicitly complete this
workspace without managing its internal entities directly.

An Open Packaging Operation durably preserves allocations, planned package rows,
draft label information, recorded Packages, notes, and progress. Closing the
application must not discard this work.

---

# Packaging Allocation

A Packaging Allocation is an identified child entity within one Packaging
Operation. It references the exact completed Trays that supply product for one
or more Packages.

Separate combinations of product use separate Packaging Allocations. For
example, three chicken Trays may supply one Allocation while a strawberry Tray
supplies another Allocation in the same Packaging Operation.

An Allocation has stable identity and may exist before any Package is recorded,
but it never exists independently of its Packaging Operation. It is not an
aggregate root and is not a separately managed user concept.

Selected source weight, allocated weight, and remaining weight are derived from
the Allocation's source Trays and Package Finished Product Weights. Remaining
weight is never an independently editable or persisted total.

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

Each Package belongs to exactly one Packaging Allocation and is therefore part
of exactly one Packaging Operation.

A Package is created when the operator intentionally records a Package in
Freezeflow. Freezeflow does not attempt to infer when a physical bag came into
exist and does not introduce a Draft Package inventory state.

Every Package owns exactly one editable Package Label. Package Label content is
presentation data for the physical bag and is separate from immutable Production
History. Editing a Package Label never changes its source Trays, Weight Checks,
or Packaging Operation.

# Package Label

A Package Label is the persistent, human-readable presentation owned by one
Package. It may include a Display Name, Description, Ingredients Summary,
Preparation Summary, Rehydration Instructions, Serving Notes, Net Weight display,
Fresh Equivalent display, and Packaging Date presentation.

Package Label state is `Draft`, `Ready`, or `Needs Reprint`. Printing is an
append-only Print Event rather than a Package Label state. Editing a previously
printed Package Label makes it `Needs Reprint` without changing inventory or
Production History.

Package Identifier and Packaging Date are rendered from the Package and its
Packaging Operation rather than duplicated as editable production facts.

Before Milestone 8, Package Label edits replace the current label content. The
Package remains traceable to unchanged Production History. Milestone 8 adds
label-edit history through the Audit system.

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

## Preparation Preset

A Preparation Preset may be applied to many Trays.

The Preparation Preset relationship is optional.

Trays preserve their own immutable Preparation Metadata snapshots even when a
preset supplied the defaults.

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

A Package has many Package Status History records.

A Package owns exactly one Package Label.

---

## Storage Location

A Storage Location contains many Packages.

---

## Package Status History

A Package Status History record belongs to one Package.

It preserves one append-only Inventory Status lifecycle event with its Effective Time, Recorded Time, and optional Notes.

---

# Design Notes

The domain model intentionally separates production from inventory.

Inventory is considered the final stage of production rather than the primary purpose of the system.

Maintaining this separation allows Freezeflow to preserve complete traceability from finished inventory back to the original freeze-drying process.

Every production decision should remain connected to the finished package throughout the lifetime of the product.

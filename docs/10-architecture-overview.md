# 10 - Architecture Overview

# Purpose

This document provides a high-level overview of the Freezeflow architecture.

It explains how the major domain concepts relate to one another and how information flows through the system.

This document is intended to help new contributors quickly understand the overall design before reading the more detailed documentation.

For detailed behavior, refer to the Domain Model, Workflow, Business Rules, and Architecture Decision Records (ADRs).

---

# System Philosophy

Freezeflow models the real-world freeze-drying workflow.

The application is organized around the lifecycle of food as it moves through production, packaging, storage, and historical reporting.

Historical information is considered more valuable than convenience.

The architecture is designed to preserve complete traceability from raw product to finished Package.

The architecture is also event-oriented.

Primary entities keep the current state needed for daily use, while historical records preserve the observations and actions that explain how that state was reached.

ADR-0008 defines this principle.

---

# High-Level Flow

```text
Preparation Presets (Optional)
            │
            │ prefill
            ▼
 Preparation Metadata
            │
            ▼
         Tray(s)
            │
            ▼
      Drying Run(s)
            │
            ▼
     Weight Checks
            │
            ▼
      Completed Trays
            │
            ▼
  Packaging Operation
            │
            ▼
 Packaging Allocation(s)
            │
            ▼
       Package(s)
            │
            ├──── Package Label
            │
            ▼
   Storage Location
            │
            ▼
        Inventory
            │
            ▼
         Reports
```

---

# Domain Relationships

## Preparation Metadata and Presets

Preparation Metadata records what was freeze dried: Product, Ingredients,
Preparation Methods, and processing Notes.

Users may enter this information directly. Reusable Preparation Presets reduce
repetitive entry but are never required.

When a Preparation Preset is used, its values are copied into the Tray's
immutable Preparation Metadata snapshot.

Editing a Preparation Preset never changes historical Production.

---

## Production Batches

A Production Batch represents one freeze-drying production session for one Freeze Dryer load.

Each Production Batch:

* belongs to one Freeze Dryer
* contains one or more Trays
* tracks the overall production session
* contains one or more Drying Runs

Production Batches organize production but do not directly contain inventory.

---

## Trays

A Tray represents one loaded tray record inside a Production Batch.

Each Tray:

* contains one prepared product
* records the Tray Slot and Physical Tray used for the Batch
* records its own Weight Checks
* progresses independently through production
* preserves its own historical preparation information

The Tray is the core production record in Freezeflow.

Physical Trays are reusable equipment records.

Tray Slots are Freeze Dryer positions.

Physical Trays may store optional tare weight.

Future versions may add calibration notes to Physical Trays.

---

## Weight Checks

Weight Checks record drying progress over time.

They are append-only historical observations.

Weight Checks help the user determine when a Tray has reached its Finished Product Weight.

## Drying Runs

Drying Runs record freeze dryer machine-cycle intervals within a Running Production Batch.

A Drying Run provides the cycle context for Weight Checks.

Starting a Production Batch automatically creates the first Drying Run.

Current Run Complete records the end of the active Drying Run and opens the Weight Check workflow.

Total drying time is derived from non-voided Drying Run durations.

---

## Packaging Operations

A Packaging Operation is the aggregate root and resumable workspace that
converts completed product from one Production Batch into labeled inventory.
Its lifecycle is Open to Completed, and a Production Batch may have at most one
Open operation. The operator explicitly completes it after all selected product
has been allocated to recorded Packages.

Packaging Operations are internal workflow records. Users work in a task-focused
Packaging workspace rather than administering operations as CRUD records.

## Packaging Allocations

A Packaging Allocation is an identified child of one Packaging Operation. It
references one or more completed Trays as its exact product source and connects
that product to planned rows, Package Labels, and Packages. It may exist before
any Package is recorded, but never independently of its parent operation.

Separate product combinations use separate Allocations. Selected Source Weight
comes from the source Trays, Allocated Weight comes from Package Finished Product
Weight, and Remaining Weight is derived from their difference.

---

## Package Types

Package Types represent reusable packaging formats.

Examples include Pint Jar, 1 qt Mylar, and 2 gallon Mylar.

Package Types provide defaults such as oxygen absorber size and printable label template while allowing Package-level values to remain editable.

They support the Packaging workflow without becoming food inventory.

---

## Packages

Packages are the inventory units managed by Freezeflow.

Each Package:

* originates from one Packaging Allocation within a Packaging Operation
* records one Package Type
* belongs to one current Storage Location
* has one Inventory Status
* owns one editable Package Label

Packages are the primary objects users search for after production is complete.

A Package is created when the operator intentionally records it. Freezeflow does
not infer when the physical bag began to exist or prescribe whether recording,
filling, weighing, labeling, printing, and storage happen in a fixed order.

## Package Labels

A Package Label is the persistent, editable human-facing presentation owned by
one Package. Planned Package rows and draft label information are durable child
work within an Open Packaging Operation and Allocation; they are not Packages
and do not create inventory.

Package Label states are Draft, Ready, and Needs Reprint. Printing and reprinting
append Print Events rather than changing inventory or Production History.

Package Label content may summarize Production History, but editing it never
rewrites the Tray's immutable Preparation Metadata or other Production records.
Before Milestone 8, editing replaces the current Package Label. Milestone 8
adds correction and audit history.

## Workflow Flexibility

Freezeflow validates the required final state without forcing physical tasks into
one sequence. Open Packaging work survives application closure. Operators may
record Packages and print labels before, during, or after filling bags. See
ADR-0015.

---

## Storage Locations

Storage Locations represent physical places where Packages are stored.

Examples include:

* Bin A
* Pantry Shelf
* Freezer
* Emergency Storage

Storage history is preserved whenever a Package is moved.

---

## Reports

Reports are generated from historical production data.

Reports answer practical questions such as:

* Which Freeze Dryer performs better?
* How long does chicken usually take?
* How much inventory has been produced?

Reports use historical production records rather than current Preparation Preset definitions.

---

# Traceability

Every Package can be traced back through the complete production process.

```text
Package
    │
    ▼
Packaging Operation
    │
    ▼
Tray(s)
    │
    ▼
Weight Checks
    │
    ▼
Production Batch
    │
    ▼
Freeze Dryer
    │
    ▼
Preparation Preset (if used)
```

This traceability is one of the primary architectural goals of Freezeflow.

---

# Separation of Responsibilities

The architecture intentionally separates different responsibilities.

| Responsibility        | Primary Entity      |
| --------------------- | ------------------- |
| Production Description | Preparation Metadata |
| Reusable Preparation   | Preparation Preset |
| Production Session    | Production Batch    |
| Production History    | Tray                |
| Reusable Tray Setup   | Physical Tray       |
| Freeze Dryer Capacity | Tray Slot           |
| Machine Cycle Context | Drying Run          |
| Drying Progress       | Weight Check        |
| Packaging Event       | Packaging Operation |
| Packaging Defaults    | Package Type        |
| Inventory             | Package             |
| Package Presentation  | Package Label       |
| Physical Storage      | Storage Location    |
| Historical Analysis   | Reports             |

Future architecture may add Supply records.

Those concepts should be introduced through documentation before implementation.

Each entity has one primary purpose.

Avoid combining responsibilities across entities.

---

# Architectural Principles

Freezeflow follows several core architectural principles:

* Preserve historical information.
* Prefer explicit relationships over inferred relationships.
* Build around real-world workflows.
* Track inventory at the Package level.
* Treat Preparation Presets as optional conveniences, not historical records.
* Keep Production History separate from editable Package presentation.
* Derive calculated values whenever practical.
* Record corrections without destroying history.

These principles should guide future architectural decisions.

---

# Current State vs Historical Records

Freezeflow separates the application's **current state** from its **historical records**.

Primary entities store the current state of the system.

Historical entities preserve how that state was reached.

Examples:

| Current State | Historical Record |
|---------------|-------------------|
| Tray | Weight Checks |
| Package | Storage Location History |
| Any Correctable Entity | Audit Entries |

This design keeps common operations simple while preserving complete historical traceability.

Users typically interact with the current state.

Historical records remain available for reporting, auditing, and understanding how production evolved over time.

This separation is one of the core architectural principles of Freezeflow and should be preserved throughout the application.

---

# Documentation Roadmap

This document serves as the entry point to the architecture.

For additional detail, refer to:

1. Domain Model
2. Workflow
3. Business Rules
4. Data Model
5. API Design
6. Architecture Decision Records (ADRs)
7. Wireframes

Together, these documents define the complete Version 1 architecture of Freezeflow.

---

# Developer Tools

Freezeflow may expose a development-only API and interface for creating realistic
demo and test data. Developer Tools use the same persisted domain entities and
relationships as the application; they must not create a parallel demo model or
bypass database constraints.

Developer Tools are intentionally destructive because they operate on a local
development database. They must:

* be unavailable when the backend environment is `production`
* be hidden from production frontend builds
* clearly identify replacement and mutation actions
* require confirmation before destructive actions
* create lifecycle-consistent, traceable records
* report the resulting entity counts

Scenario seeds are deterministic unless their name explicitly indicates random
data. Random tools remain bounded so they are useful for UI and performance
testing without creating an uncontrolled dataset.

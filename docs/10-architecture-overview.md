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
Recipes (Optional Templates)
            │
            │ copied onto
            ▼
    Production Batch
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
       Package(s)
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

## Recipes

Recipes are reusable preparation templates.

Recipes reduce repetitive data entry but are not historical records.

When a Recipe is used, its preparation information is copied onto the Tray.

Editing a Recipe never changes historical Production.

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

A Packaging Operation represents the act of converting one or more completed Trays into one or more finished Packages.

Packaging Operations exist primarily to preserve traceability.

They are internal system records and are not a primary user-facing concept.

For Version 1, a Packaging Operation may combine eligible Trays from the same Production Batch and Freeze Dryer.

Packaging Operations should not mix Trays from different Freeze Dryers or different Production Batches.

---

## Package Types

Package Types represent reusable packaging formats.

Examples include Pint Jar, 1 qt Mylar, and 2 gallon Mylar.

Package Types provide defaults such as oxygen absorber size while allowing Package-level values to remain editable.

They support the Packaging workflow without becoming food inventory.

---

## Packages

Packages are the inventory units managed by Freezeflow.

Each Package:

* originates from one Packaging Operation
* records one Package Type
* belongs to one current Storage Location
* has one Inventory Status

Packages are the primary objects users search for after production is complete.

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

Reports use historical production records rather than current Recipe definitions.

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
Recipe (if used)
```

This traceability is one of the primary architectural goals of Freezeflow.

---

# Separation of Responsibilities

The architecture intentionally separates different responsibilities.

| Responsibility        | Primary Entity      |
| --------------------- | ------------------- |
| Preparation Templates | Recipe              |
| Production Session    | Production Batch    |
| Production History    | Tray                |
| Reusable Tray Setup   | Physical Tray       |
| Freeze Dryer Capacity | Tray Slot           |
| Machine Cycle Context | Drying Run          |
| Drying Progress       | Weight Check        |
| Packaging Event       | Packaging Operation |
| Packaging Defaults    | Package Type        |
| Inventory             | Package             |
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
* Treat Recipes as reusable templates, not historical records.
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

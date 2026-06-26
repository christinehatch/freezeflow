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

A Production Batch represents one freeze-dryer run.

Each Production Batch:

* belongs to one Freeze Dryer
* contains one or more Trays
* tracks the overall production session

Production Batches organize production but do not directly contain inventory.

---

## Trays

A Tray represents one physical tray inside a Freeze Dryer.

Each Tray:

* contains one prepared product
* records its own Weight Checks
* progresses independently through production
* preserves its own historical preparation information

The Tray is the core production record in Freezeflow.

---

## Weight Checks

Weight Checks record drying progress over time.

They are append-only historical observations.

Weight Checks determine when a Tray has reached its Final Dry Weight.

---

## Packaging Operations

A Packaging Operation represents the act of converting one or more completed Trays into one or more finished Packages.

Packaging Operations exist primarily to preserve traceability.

They are internal system records and are not a primary user-facing concept.

---

## Packages

Packages are the inventory units managed by Freezeflow.

Each Package:

* originates from one Packaging Operation
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
| Drying Progress       | Weight Check        |
| Packaging Event       | Packaging Operation |
| Inventory             | Package             |
| Physical Storage      | Storage Location    |
| Historical Analysis   | Reports             |

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


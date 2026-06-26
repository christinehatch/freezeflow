# 03 - Workflow

# Purpose

This document describes the complete user workflow within Freezeflow.

Unlike the Domain Model, which defines the objects in the system, this document explains how a user interacts with those objects from beginning to end.

The workflow is written from the user's perspective and should guide user interface design, navigation, and feature development.

The goal is for Freezeflow to support the user's existing process rather than requiring the user to adapt to the software.

---

# Overview

Every freeze-dried product follows the same high-level lifecycle.

```text
Prepare Food
      ↓
Create Production Batch
      ↓
Load Freeze Dryer
      ↓
Record Weight Checks
      ↓
Complete Drying
      ↓
(Optional) Combine Compatible Trays
      ↓
Package Product
      ↓
Assign Storage Location
      ↓
Manage Inventory
```

Each step builds upon the previous one while preserving the complete production history.

---

# Workflow 1 — Create a Production Batch

The user begins by creating a new production batch.

The batch represents one freeze-dryer run.

The user records information such as:

* Freeze dryer
* Date
* Batch notes

Once the production batch has been created, trays can be loaded.

---

# Workflow 2 — Load Trays

The user assigns products to individual trays.

Each tray contains one prepared product.

The user records:

* Tray number
* Product
* Recipe (optional)
* Preparation details
* Starting (fresh) weight

Each tray becomes independently trackable throughout the drying process.

If the user chooses a Recipe, Freezeflow copies the Recipe information onto the Tray.

The copied preparation information becomes part of the Tray's permanent production history.

---

# Workflow 3 — Start Freeze Drying

After loading all trays, the production batch enters the drying phase.

At this point no additional production setup is required.

The user simply waits until the next weight check.

---

# Workflow 4 — Record Weight Checks

At each inspection the user weighs every tray.

For each tray the user records:

* Current weight
* Time elapsed
* Optional notes

Weight checks continue until the tray weight stops changing.

The system preserves every recorded weight.

Historical measurements are never replaced.

---

# Workflow 5 — Complete a Tray

Once the tray weight remains constant, the tray is considered complete.

The system records:

* Final dry weight
* Total drying time
* Number of weight checks

Completed trays become available for packaging.

---

# Workflow 6 — Package Finished Product

There are two common packaging paths.

## Package Individually

If the tray will remain separate, the user packages it immediately.

The package records:

* Package date
* Sealed weight
* Oxygen absorber
* Notes

The system automatically records a Packaging Operation for this packaging action.

The user does not manage the Packaging Operation directly.

---

## Combine Compatible Trays

If multiple completed trays contain the same product, the user may combine them before packaging.

Examples include:

* Multiple trays from the same production batch
* Trays from different production batches
* Trays from different freeze dryers

The user selects which completed trays will be packaged together.

Important:

A completed tray may only be packaged once.

Once assigned to a Packaging Operation, it is no longer available for future packaging actions.

The system automatically creates a Packaging Operation and permanently records which trays were packaged together.

The Packaging Operation appears as part of package history rather than as a separate user-managed page.

---

# Workflow 7 — Create Packages

The selected tray contents are divided into one or more storage bags.

For every package the user records:

* Sealed weight
* Oxygen absorber
* Package date
* Notes

Packages become the primary inventory units.

Each Package is connected to the Packaging Operation that produced it.

---

# Workflow 8 — Store Inventory

Each package is assigned to a storage location.

Examples include:

* Bin A
* Bin B
* Pantry
* Shelf 3

Packages may later be moved to different locations while preserving location history.

---

# Workflow 9 — Search Inventory

The user may search for inventory at any time.

Common searches include:

* Product name
* Recipe
* Storage location

Search results should immediately show:

* Package
* Weight
* Storage location
* Inventory status

The goal is to answer the question:

> "Where is my product?"

within seconds.

---

# Workflow 10 — Mark Inventory as Depleted

When a package has been consumed, the user marks it as depleted.

The package remains in the system.

Historical production information is never deleted.

This preserves accurate reporting while keeping current inventory up to date.

---

# Reporting Workflow

As production history grows, users may view reports that summarize historical data.

Examples include:

### Freeze Dryer Reports

* Average drying time
* Number of completed batches
* Average moisture loss

---

### Product Reports

* Average drying time
* Yield percentage
* Production frequency

---

### Preparation Reports

* Compare preparation methods
* Compare seasoning variations
* Compare drying performance

---

### Inventory Reports

* Current inventory
* Recently packaged products
* Depleted inventory
* Inventory by storage location

---

# Workflow Principles

Every workflow within Freezeflow should follow these principles.

## Preserve History

Never overwrite historical production data.

---

## Minimize User Input

Reduce repetitive typing whenever possible.

---

## Complete One Task at a Time

The user should always understand the next step in the workflow.

---

## Preserve Traceability

Every package should remain traceable back through every stage of production.

---

## Keep Inventory Separate from Production

Inventory is the result of production.

Production history should exist independently from inventory management.

---

# Future Workflow Expansion

The workflow is intentionally modular.

Future versions may add additional workflows without changing the existing production process.

Examples include:

* Recipe management
* QR code labels
* Barcode scanning
* Mobile weight entry
* Cloud synchronization
* Multi-user collaboration

These additions should extend the workflow rather than replace it.

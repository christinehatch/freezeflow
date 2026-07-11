# 11 - User Journeys

# Purpose

This document describes the primary user journeys through Freezeflow.

Unlike the screen wireframes, which describe individual pages, User Journeys describe complete end-to-end workflows.

The goal is to verify that the application supports real-world tasks naturally and efficiently.

Each journey should require as little navigation and as few unnecessary decisions as possible.

---

# Journey 1 - First-Time Setup

## Goal

Prepare the application for first use.

### Steps

```text
Dashboard

Create Freeze Dryer #1

Create Freeze Dryer #2 (optional)

Create Storage Locations

Create Recipes (optional)

Ready to begin Production
```

### Success Criteria

The user can begin their first Production Batch without needing additional configuration.

---

# Journey 2 - Start a Production Batch

## Goal

Begin freeze drying a new batch of food.

### Steps

```text
Dashboard

Select an Idle Freeze Dryer

Create Production Batch

Add one or more Trays

Select a Recipe (optional)

Enter:

* Product
* Preparation
* Starting Weight

Start Production
```

### Success Criteria

The Freeze Dryer now shows an active Production Batch.

---

# Journey 3 - Complete a Drying Run and Record Weight Checks

## Goal

Record updated Tray weights after the freeze dryer cycle ends.

### Steps

```text
Dashboard

Select Running Freeze Dryer

Open Production Batch

Select Current Run Complete

Confirm or correct cycle end time

Weigh Tray 1

Enter Weight

Weigh Tray 2

Enter Weight

Repeat for all Trays

Review weight changes

Mark completed Trays when appropriate

Start another Drying Run if any Trays remain Running
```

### Success Criteria

All Weight Checks are recorded with minimal navigation.

The workflow feels continuous and efficient.

Every Running Tray receives a Weight Check for the completed Drying Run before another Drying Run starts.

---

# Journey 4 - Complete a Production Batch

## Goal

Finish drying.

### Steps

```text
Production Batch

Mark remaining Trays Complete

Review Ready to Complete Batch state

Select Complete Batch

Navigate to Packaging
```

### Success Criteria

The user clearly understands that the drying process is complete and the next step is Packaging.

---

# Journey 5 - Package Completed Trays

## Goal

Convert completed Trays into finished inventory.

### Steps

```text
Packaging

Select Completed Trays

Review Total Dry Weight

Review Packaging Worksheet

Create one or more Packages

Enter:

* Package Type
* Package Weight
* Storage Location or Unassigned

Print human-readable labels

Review or edit suggested oxygen absorber

Review weight comparison

Complete Packaging
```

### Success Criteria

The user creates finished Packages without needing to understand Packaging Operations.

The user only combines Trays that belong to the same Production Batch.

---

# Journey 6 - Find a Package

## Goal

Locate food quickly.

### Steps

```text
Dashboard

Inventory

Search

Open Package Details

Retrieve Package
```

### Success Criteria

The Package is found in under ten seconds.

---

# Journey 7 - Move a Package

## Goal

Record a new Storage Location.

### Steps

```text
Inventory

Open Package

Move Package

Select new Storage Location

Save
```

### Success Criteria

The Package immediately reflects its new location while preserving movement history.

---

# Journey 8 - Use a Package

## Goal

Remove a finished Package from inventory.

### Steps

```text
Inventory

Search

Open Package

Mark Package Depleted

Confirm
```

### Success Criteria

The Package disappears from the default Inventory view while remaining part of historical records.

---

# Journey 8A - Give Away a Package

## Goal

Record that a finished Package left inventory as a gift or transfer.

### Steps

```text
Inventory

Search

Open Package

Mark Package Given Away

Confirm
```

### Success Criteria

The Package disappears from default active Inventory counts while remaining part of historical records.

---

# Journey 9 - Review Production History

## Goal

Understand how a product was produced.

### Steps

```text
Inventory

Open Package

View Source Trays

Open Tray Details

Review:

* Weight History
* Preparation
* Production Batch
* Freeze Dryer
```

### Success Criteria

The user can trace a finished Package back to its original production history.

---

# Journey 10 - Compare Freeze Dryers

## Goal

Determine which Freeze Dryer performs better.

### Steps

```text
Dashboard

Reports

Freeze Dryer Performance

Compare:

* Average Dry Time
* Average Weight Loss
* Completed Batches
```

### Success Criteria

The user can identify meaningful performance differences between machines.

---

# Journey 11 - Reproduce a Previous Batch

## Goal

Freeze dry a successful product again.

### Steps

```text
Reports or Inventory

Locate previous Package or Tray

Review preparation details

Create a new Production Batch

Reuse the same Recipe (optional)

Begin Production
```

### Success Criteria

The user can confidently recreate a previous production run using historical information.

---

# Journey Design Principles

Every user journey should:

* begin with a clear goal
* require minimal navigation
* minimize repetitive typing
* preserve historical information
* guide the user toward the next logical action

Users should never need to understand internal implementation concepts such as Packaging Operations, database relationships, or audit records.

---

# Journey Validation Checklist

When introducing a new feature, verify that it does not negatively affect existing user journeys.

For each journey, ask:

* Is the next action obvious?
* Can unnecessary clicks be removed?
* Does the workflow match the user's real-world process?
* Is historical traceability preserved?
* Does the feature support the primary purpose of the screen?

If the answer to any question is "No," reconsider the design before implementation.

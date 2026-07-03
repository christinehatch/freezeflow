# 00 - Navigation

## Purpose

Navigation defines how users move through Freezeflow.

It should reflect the real freeze-drying workflow rather than the database model.

The navigation should make it easy to:

* See what needs attention
* Continue active production work
* Package completed trays
* Find stored inventory
* Review historical records

---

## Navigation Principles

The application should prioritize workflow over administration.

The most important paths are:

* Dashboard to active Production Batch
* Production Batch to Tray
* Completed Trays to Packaging
* Inventory to Package history
* Reports to historical summaries

Users should not need to understand internal entities such as Packaging Operations.

Those records may appear in history, but they should not be primary navigation destinations.

---

## Information Architecture

```text
Dashboard
|
+-- Production Batches
|   |
|   +-- Production Batch
|       |
|       +-- Tray
|
+-- Packaging
|
+-- Inventory
|   |
|   +-- Package
|
+-- Reports
|
+-- Recipes
|
+-- Freeze Dryers
|
+-- Storage Locations
```

---

## Primary Navigation

Primary navigation should contain the screens users return to regularly.

* Dashboard
* Production
* Packaging
* Inventory
* Reports

Administrative setup screens should be available but visually secondary.

Examples:

* Recipes
* Freeze Dryers
* Storage Locations

---

## Global Actions

The following actions should be available from most screens:

* Search
* Create Production Batch
* Record Weight Check when an active batch is selected
* Package Completed Trays when completed trays are available

Search should remain available from anywhere in the application.

---

## Breadcrumbs

Breadcrumbs should show where the user is in the workflow.

They should use user-facing screen names rather than implementation details.

Examples:

```text
Dashboard

Dashboard > Production > Chicken Batch

Dashboard > Production > Chicken Batch > Tray 3

Dashboard > Inventory > Taco Chicken Package
```

Breadcrumbs should be visible on detail screens.

They should help users move back to the broader workflow without losing context.

Breadcrumbs should not expose internal entities such as Packaging Operations.

---

## Screen Relationships

### Dashboard

The Dashboard is the starting point.

It should link to:

* Active Production Batches
* Trays needing Weight Checks
* Completed Trays ready for Packaging
* Inventory alerts
* Inventory search

### Production Batches

Production Batches is the list of freeze-drying production sessions.

It should link to each Production Batch detail screen.

### Production Batch

Production Batch is the active production workspace.

It should link to:

* Tray details
* Weight Check entry
* completed Tray actions

### Tray

Tray is the detailed production history for one Tray.

It should show:

* historical preparation information
* Weight Checks
* completion information
* Package traceability when packaged

### Packaging

Packaging is where completed Trays become Packages.

It should show completed Trays that are available to package.

It should not require users to manage Packaging Operations directly.

### Inventory

Inventory is the main search and storage view.

It should link to Package detail screens.

### Package

Package is the complete history of one stored Package.

It should trace backward through:

* Packaging history
* source Trays
* Production Batches
* Freeze Dryers
* Weight Checks
* historical preparation information

### Reports

Reports summarize historical production and inventory data.

Reports should never become the source of truth.

---

## Navigation States

### No Active Production

The Dashboard should emphasize creating a Production Batch.

Packaging and Inventory remain available.

### Active Production

The Dashboard should emphasize active Production Batches and Trays needing Weight Checks.

### Completed Trays Available

The Dashboard and Production screens should surface a path to Packaging.

### Inventory Available

Inventory search should remain prominent.

### Historical Review

Package, Tray, and Production Batch detail screens should make history easy to follow without changing current workflow state.

---

## Mobile Considerations

Navigation should collapse into a simple menu on small screens.

Primary workflow destinations should remain one tap away:

* Dashboard
* Production
* Packaging
* Inventory

Search should remain easy to access.

Setup screens may be grouped under a secondary menu.

---

## Future Enhancements

Future navigation may include:

* Labels
* Barcode scanning
* Cost tracking
* User settings
* Cloud sync status

These should be added only when they support real workflow needs.

---

## Success Criteria

A user should be able to:

* Understand the primary workflow areas without knowing the database model.
* Move from Dashboard to an active Tray without losing batch context.
* Move from Inventory search to Package history without exposing internal entities.
* Return from detail screens using breadcrumbs.
* Access Search from anywhere in the application.

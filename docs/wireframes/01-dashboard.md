# 01 - Dashboard

# Purpose

The Dashboard is the application's home screen.

Its purpose is not to display as much information as possible.

Its purpose is to answer one question:

**"What needs my attention right now?"**

The Dashboard should immediately direct the user toward the next logical task without requiring them to search through the application.

---

# Milestone Progression

The Dashboard evolves throughout development.

Each milestone introduces additional sections as new workflows become available.

The wireframe below represents the complete Version 1 Dashboard.

Earlier milestones should implement only the sections relevant to the workflows available at that stage.

## Milestone 2

Implement:

- Quick Actions
- Needs Attention
- Freeze Dryer cards
- Recent Production Batches

Do not implement Packaging, Inventory, Reports, or Weight Tracking.

### Recent Production Batches

Display a fixed list of recent batches using deterministic rules:

* Batches with `startedAt` are shown first and sorted by `startedAt` descending.
* Batches without `startedAt` are shown after started batches and sorted by `batchNumber` descending.
* Include Draft, Running, Completed, and Cancelled batches.
* Show up to 10 entries.
* Do not repeat a batch that is already shown as the active batch on its Freeze Dryer card.

Each entry should show:

* Batch number
* Freeze Dryer
* Status
* Started date, if available; otherwise "Not started"

---

## Milestone 3

Adds:

- Weight Check reminders
- Drying progress indicators

---

## Milestone 4

Adds:

- Packaging Queue
- Completed Trays awaiting Packaging

---

## Milestone 5

Adds:

- Inventory Summary
- Storage information

---

## Milestone 7

Adds:

- Reports
- Recent Activity
- Historical production summaries

---

# User Goals

A user should be able to:

* Resume active work.
* See if any Production Batches require attention.
* See if completed Trays are waiting to be packaged.
* Quickly begin common tasks.
* Understand the current state of their freeze-drying operation.

---

# Primary Actions

* Create Production Batch
* Resume Active Production Batch
* Package Completed Trays
* Search Inventory
* View Reports
* Manage Recipes

These actions should always be easy to find.

---

# Screen Layout

```text
+----------------------------------------------------------------------------+
|                              Freezeflow Dashboard                          |
+----------------------------------------------------------------------------+

Quick Actions

[ + New Production Batch ]

[ Package Completed Trays ]

[ Search Inventory ]

[ View Reports ]

------------------------------------------------------------------------------

Needs Attention

* Harvest Right #1 has an active Production Batch.
* 6 completed Trays are ready for Packaging.
* 2 Packages have no Storage Location assigned.

------------------------------------------------------------------------------

Freeze Dryers

+--------------------------------------+--------------------------------------+
| Harvest Right #1                     | Harvest Right #2                     |
| Running                              | Idle                                 |
| Chicken Batch                        | No active Production Batch           |
| 3 Running, 1 Complete                |                                      |
| [ Open Current Batch ]               | [ Create Production Batch ]          |
+--------------------------------------+--------------------------------------+

------------------------------------------------------------------------------

Packaging Queue

Completed Trays Ready for Packaging

6

[ Package Now ]

------------------------------------------------------------------------------

Inventory Summary

Packages In Storage

432

Storage Locations

12

Depleted Packages

58

------------------------------------------------------------------------------

Recent Activity

* Tray 2 marked Complete

* Weight Check recorded for Tray 4

* 3 Packages created

* Package moved to Pantry Shelf

------------------------------------------------------------------------------
```

---

# Information Priority

The Dashboard should present information in the following order:

1. Immediate actions the user can take.
2. Items requiring attention.
3. Freeze Dryer status.
4. Packaging readiness.
5. High-level inventory summary.
6. Recent activity.

Historical information should remain brief.

Detailed reporting belongs elsewhere.

---

# Quick Actions

Quick Actions should represent the most common user tasks.

Examples:

* Create Production Batch
* Package Completed Trays
* Search Inventory
* View Reports

These actions should always remain visible.

---

# Needs Attention

This section should highlight work requiring user action.

Examples:

* Active Production Batches
* Completed Trays awaiting Packaging
* Packages in Unassigned Storage Location
* Validation warnings
* Interrupted Production Batches

This section should never contain informational messages that do not require action.

---

# Freeze Dryers

Each Freeze Dryer should be displayed as an individual card.

The card should clearly communicate:

* Name
* Current status
* Active Production Batch, if any
* Number of running and completed Trays
* Primary action

Examples:

Running:

* Open Current Batch

Idle:

* Create Production Batch

The Freeze Dryer card should be the primary entry point into the Production workflow.

---

# States

## Normal

The Dashboard displays current activity and any tasks requiring attention.

---

## Busy

If multiple Production Batches are running, the Dashboard should prioritize:

* Freeze Dryers
* Packaging Queue
* Warnings

---

## Quiet

If no Production Batches are active:

Display encouragement to begin a new Production Batch.

Example:

```text
No active Production Batches.

Ready to start your next freeze-drying run?

[ Create Production Batch ]
```

---

# Empty State

```text
+---------------------------------------------------------------+
| Welcome to Freezeflow                                         |
|                                                               |
| Your freeze-drying history will appear here as you begin      |
| creating Production Batches and Packages.                     |
|                                                               |
| [ Create Your First Production Batch ]                        |
+---------------------------------------------------------------+
```

---

# Error States

If dashboard information cannot be loaded:

* Explain the problem clearly.
* Allow the user to retry.
* Preserve any cached information if available.

Example:

```text
Unable to load dashboard information.

[ Retry ]
```

---

# Mobile Considerations

On smaller screens:

* Stack dashboard sections vertically.
* Keep Quick Actions visible near the top.
* Prioritize Needs Attention over summary information.
* Avoid wide tables.

---

# Success Criteria

A user should be able to:

* Understand the current state of their operation within five seconds.
* Resume active work with one click.
* Discover unfinished tasks without searching.
* Begin the most common workflows immediately.

---

# Future Enhancements

Future versions may include:

* Drying time estimates
* Inventory alerts
* Low inventory notifications
* Freeze Dryer efficiency summaries
* Favorite reports
* Dashboard customization

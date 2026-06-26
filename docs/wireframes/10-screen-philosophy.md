# 10 - Screen Philosophy

# Purpose

This document defines the purpose of every major screen in Freezeflow.

Each screen exists to accomplish one primary user goal.

By giving every screen a clear responsibility, the application remains easy to learn, easy to maintain, and resistant to feature creep.

When adding new functionality, developers should first determine which screen's purpose the feature supports.

If it does not clearly belong to an existing screen, reconsider whether it should exist at all.

---

# Dashboard

## Primary Purpose

Direct the user's attention.

The Dashboard answers:

> "What needs my attention right now?"

The Dashboard is not:

* a reporting dashboard
* an inventory browser
* a production editor

It should immediately guide users toward their next task.

---

# Production Batch

## Primary Purpose

Rapid production data entry.

The Production Batch screen is the user's primary workspace.

Its goal is to minimize effort while recording production information.

Users should spend most of their production time here.

The screen is optimized for:

* recording Weight Checks
* reviewing Tray status
* completing Trays

The Production Batch screen is not intended for deep historical review.

---

# Packaging

## Primary Purpose

Convert completed Trays into inventory.

Packaging is a guided workflow.

The user selects completed Trays and creates one or more Packages.

The system automatically preserves traceability through an internal Packaging Operation.

The Packaging screen should hide implementation complexity.

---

# Tray Details

## Primary Purpose

Understand the complete history of a Tray.

The Tray Details screen is optimized for review rather than data entry.

Users visit this screen when they need additional context or historical information.

It answers:

> "Tell me everything that happened to this Tray."

---

# Inventory

## Primary Purpose

Find food.

Inventory is a search experience.

Users should be able to locate Packages quickly without remembering Production Batch numbers, dates, or other internal identifiers.

Inventory is optimized for discovery.

---

# Package Details

## Primary Purpose

Verify and trace a finished Package.

Package Details answer questions such as:

* What is this?
* How was it prepared?
* Where did it come from?
* Where is it stored?

This screen exists to build confidence in historical traceability.

---

# Reports

## Primary Purpose

Answer historical production questions.

Reports help users improve future production.

They should answer questions such as:

* Which Freeze Dryer performs better?
* How long does this product usually take?
* Which products do I make most often?

Reports should focus on insight rather than raw data.

---

# Recipes

## Primary Purpose

Reduce repetitive typing.

Recipes are reusable preparation templates.

They exist to improve efficiency during Production.

Recipes are not historical records.

Historical Production always owns its own preparation information.

---

# Common Principles

Every screen should have:

* one primary purpose
* one primary workflow
* one obvious next action

Avoid creating screens that attempt to do everything.

---

# Choosing Where Features Belong

Before adding a new feature, ask:

1. Which screen's primary purpose does this support?
2. Does this feature help users accomplish that screen's primary goal?
3. Would adding this feature make the screen more confusing?

If the answer to Question 3 is yes, the feature likely belongs somewhere else.

---

# Feature Creep

Avoid expanding screens beyond their intended purpose.

Examples:

Dashboard should not become Reports.

Inventory should not become Production.

Recipes should not become historical records.

Reports should not become inventory management.

Maintaining clear boundaries makes the application easier to learn and maintain.

---

# Guiding Principle

Every screen should answer one primary question.

| Screen | Question |
| ------ | -------- |
| Dashboard | What needs my attention? |
| Production Batch | What work do I need to do? |
| Packaging | How do I turn completed Trays into inventory? |
| Tray Details | What happened to this Tray? |
| Inventory | Where is my food? |
| Package Details | Can I trust this Package? |
| Reports | What can I learn from my history? |
| Recipes | How can I save time next time? |

If a user can answer that question within a few seconds of opening the screen, the design is successful.

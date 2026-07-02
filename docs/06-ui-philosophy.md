# 06 - UI Philosophy

# Purpose

This document defines the user experience principles that guide every screen, workflow, and interaction within Freezeflow.

The goal is not simply to build software that functions correctly.

The goal is to build software that feels intuitive, trustworthy, and efficient to use during everyday freeze-drying operations.

Whenever multiple interface designs are possible, the design that best follows these principles should be chosen.

---

# Primary Design Goal

Freezeflow should feel like a digital notebook that quietly organizes itself.

Users should spend their time freeze drying food—not managing software.

The application should support the workflow without becoming the focus of it.

---

## Smart Notebook

Freezeflow should behave like a smart notebook, not a rigid form.

* Fast capture takes priority over perfect structure.
* Users should be able to record production information as quickly as writing in a notebook.
* Freezeflow should progressively add structure only where it improves traceability.
* The app should never slow production by forcing unnecessary data entry.

Structure should emerge from use, not block the user before work begins.

When a field is optional during capture, the interface should make that obvious and stay out of the way.

---

# Design Principles

## Make the Next Step Obvious

Every screen should have one clear primary action.

The user should never wonder:

"What am I supposed to do next?"

Primary actions should be visually emphasized.

---

## Follow the Real Workflow

The interface should mirror the actual freeze-drying process.

Users should move naturally from:

Preparation

↓

Production

↓

Weight Checks

↓

Packaging

↓

Storage

↓

Inventory

The software should never require users to mentally translate between their real-world process and the application's structure.

---

## Start With the Food

When practical, production capture should begin with the question the user is already answering:

> What are you freeze drying today?

The interface may still create a Production Batch internally, but the user experience should not overemphasize system objects when the user's mental model starts with food, preparation, machine, and trays.

This principle should guide future workflow design without changing the Milestone 2 requirement to support Draft Production Batches and Tray setup.

---

## Optimize for Real-World Workflow

Freezeflow should follow the user's physical workflow whenever possible.

The interface should adapt to how work is actually performed rather than forcing the user to adapt to the software.

Example:

During weight checks, the user typically:

1. Weighs Tray 1
2. Records the weight
3. Moves to Tray 2
4. Records the weight
5. Repeats until all trays have been weighed

The interface should support this repetitive workflow with minimal navigation and minimal clicks.

Prefer:

* Inline editing
* Keyboard-friendly data entry
* Sequential workflows
* Automatic focus advancement
* Batch-oriented workspaces

Avoid requiring users to repeatedly:

* open detail screens
* navigate back
* search for the next tray
* perform unnecessary confirmation steps

The software should reduce friction during repetitive tasks.

---

## Optimize for Repetition

Users perform many repetitive tasks.

When designing interfaces, optimize for:

* repeated weight entry
* repeated package creation
* repeated inventory lookup

Reducing one click from a workflow performed hundreds of times is more valuable than optimizing a rare workflow.

---

## Reduce Typing

Typing is one of the slowest interactions.

Whenever possible the interface should prefer:

* selecting
* reusing
* remembering
* suggesting

instead of requiring users to repeatedly type the same information.

Examples include:

* saved recipes
* recently used products
* default values
* suggested tray combinations

Future UX may build structured product descriptions from selections such as product type, cut, preparation, seasoning, cooking method, source, and notes.

Those suggestions should reduce typing while preserving the user's ability to enter freeform descriptions.

---

## Preserve Context

Users should always know:

* which batch they are working on
* which tray they are editing
* where they are in the workflow

Important information should remain visible whenever practical.

---

## Preserve History

Historical production information should remain visible rather than hidden.

Users should be able to understand how a product reached its current state.

The interface should encourage confidence rather than uncertainty.

Freeform notes are part of production history, not disposable metadata.

Notes may include shorthand, corrections, calculations, observations, "same as above," and imperfect records.

The interface should preserve notes faithfully and make them searchable where appropriate rather than treating them as temporary input.

---

## Search First

Searching should be available from anywhere within the application.

Users should be able to quickly locate:

* products
* packages
* trays
* batches
* storage locations
* production notes, where indexed

without navigating through multiple screens.

---

## Prevent Mistakes

Whenever possible the interface should prevent invalid actions rather than displaying error messages afterward.

Examples include:

* Prevent packaging an already-packaged tray.
* Prevent adding Weight Checks to completed trays.
* Prevent selecting incompatible trays if compatibility rules are enabled.

The easiest mistake to fix is the one that never happens.

---

## Never Lose User Work

Users should never lose entered information because they:

* changed screens
* refreshed the page
* accidentally clicked away

Whenever practical:

* autosave changes
* preserve drafts
* warn before destructive actions

---

## Prefer Selection Over Configuration

Users should spend their time recording production rather than configuring software.

Whenever possible:

Choose

instead of

Configure.

Examples:

* choose a recipe
* choose a storage location
* choose completed trays

instead of repeatedly entering information.

---

## Show, Don't Hide

Whenever useful information already exists, show it.

Examples include:

* previous weight checks
* drying history
* tray status
* package history

Users should not have to remember information the software already knows.

---

## Don't Make the User Remember

Freezeflow should become the user's production memory.

The interface should surface known context instead of requiring the user to recall it from paper notes or memory.

Examples include:

* previous batches for the same Product
* recent preparation choices
* previous drying times
* Freeze Dryer performance patterns
* package rerun or special-attention notes
* storage movement history

This principle does not require every insight to be implemented in Version 1.

It should guide future design decisions as more historical data becomes available.

---

## Ask Better Questions

When a single broad field would force the user to remember too much, the interface should ask smaller workflow-shaped questions.

Examples:

* Is it raw or cooked?
* If cooked, how was it cooked?
* Was it seasoned?
* Was it pre-frozen?
* Was it store-bought or home-prepared?

The goal is to reduce typing and improve consistency without eliminating freeform notes.

---

## Helpful, Not Bossy

Freezeflow may suggest better habits, warnings, or next steps.

It should not override the user's judgment.

Examples:

* "Would you like to calibrate your trays?"
* "This Tray has not changed weight since the last Weight Check."
* "This Freeze Dryer has been slower than usual."
* "These Products usually finish at different times."

Suggestions should remain explainable and dismissible.

---

# UX Opportunity Themes

User research has identified future UX opportunities that may reduce mental work after the core workflow is stable.

These include:

* guided product description builders
* reusable smart notes and recently used values
* Physical Tray calibration
* live drying dashboards
* automatic stability detection
* Freeze Dryer health indicators
* product pairing suggestions based on drying history
* supply forecasting
* production timelines and batch replay
* rerun warnings
* historical insight summaries

These are product directions, not current milestone commitments.

---

# Generated Defaults

The interface should reduce typing by suggesting safe defaults for repetitive identifiers.

When creating a Production Batch, Freezeflow should suggest the next Batch Number automatically.

Generated defaults should be visible before saving and editable by the user.

Defaults should reduce work without hiding important production identity from the user.

Each opportunity requires architecture, business rules, persistence, and milestone documentation before implementation.

---

# Screen Design Principles

## One Primary Task Per Screen

Every screen should focus on a single activity.

Examples:

* Create Production Batch
* Record Weight Checks
* Package Finished Product
* Search Inventory

Avoid combining unrelated tasks on the same page.

---

## Progressive Disclosure

Show common actions first.

Reveal advanced options only when needed.

The interface should remain approachable for new users while still supporting experienced users.

---

## Consistent Navigation

Users should always know where they are.

Navigation should remain predictable throughout the application.

The same action should always appear in the same location.

---

## Large Interactive Elements

The application should be comfortable to use:

* on desktop computers
* on tablets
* in kitchens
* in workshops

Interactive controls should be large enough to quickly select without precision clicking.

---

# Data Presentation

## Tables

Tables should support:

* sorting
* searching
* filtering

Large production histories should remain easy to navigate.

---

## Status Indicators

Status should be immediately recognizable.

Examples include:

* Running
* Completed
* Packaged
* Stored
* Depleted

Users should never need to open a record simply to determine its current state.

---

## Historical Timelines

Whenever appropriate, display events chronologically.

Examples include:

Production Batch

↓

Weight Checks

↓

Packaging

↓

Storage

↓

Inventory

The history of a product should be easy to understand at a glance.

---

# User Feedback

The application should clearly communicate the results of user actions.

Examples include:

* Batch created.
* Weight recorded.
* Package created.
* Inventory updated.

Users should never wonder whether an action succeeded.

---

# Error Handling

Errors should explain:

* what happened
* why it happened
* how to fix it

Avoid technical language whenever possible.

The interface should guide users toward success rather than simply reporting failures.

---

# Future User Experience

As Freezeflow grows, new features should continue to follow these principles.

Every new screen should ask:

* Does this reduce work?
* Does this match the user's workflow?
* Does this preserve history?
* Does this simplify the experience?
* Does this make the next step obvious?

If the answer is "no," the design should be reconsidered.

---

# Philosophy Summary

Freezeflow should feel calm, predictable, and trustworthy.

It should organize information without demanding attention.

The software succeeds when users stop thinking about the software and simply focus on freeze drying.

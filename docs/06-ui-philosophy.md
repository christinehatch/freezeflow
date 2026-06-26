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

---

## Search First

Searching should be available from anywhere within the application.

Users should be able to quickly locate:

* products
* packages
* trays
* batches
* storage locations

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

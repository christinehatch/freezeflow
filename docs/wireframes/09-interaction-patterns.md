# 09 - Interaction Patterns

# Purpose

This document defines the common interaction patterns used throughout Freezeflow.

The goal is to create a consistent experience across the application.

Users should not need to relearn how the application behaves when moving between screens.

Whenever possible, similar tasks should behave in similar ways.

---

# Core Design Philosophy

Freezeflow should adapt to the user's real-world workflow.

The application should reduce unnecessary typing, clicking, navigation, and mental effort.

When multiple interaction styles are possible, prefer the one that minimizes friction during repetitive work.

---

# Pattern: Inline Editing

Whenever practical, information should be editable directly within the current screen.

Users should not need to open detail pages for routine tasks.

Examples:

* Recording Weight Checks
* Editing Notes
* Updating Storage Locations
* Marking Packages Depleted

Avoid unnecessary edit dialogs.

---

# Pattern: Sequential Data Entry

Many production tasks are repetitive.

The interface should encourage continuous data entry.

Example:

```text
Weigh Tray 1

Enter Weight

Automatically move to Tray 2

Enter Weight

Repeat
```

The application should minimize context switching.

---

# Pattern: Keyboard Navigation

Desktop users should be able to complete repetitive workflows without using a mouse whenever practical.

Examples:

* Tab moves to the next field.
* Enter saves the current value.
* Arrow keys navigate tables when appropriate.
* Escape closes dialogs.

Keyboard navigation should feel natural and predictable.

---

# Pattern: Progressive Disclosure

Show only the information required for the current task.

Additional information should be available without overwhelming the user.

Example:

```text
Production Batch

Displays only current Tray status.

Selecting a Tray opens complete historical details.
```

---

# Pattern: Immediate Feedback

After every user action, provide immediate feedback.

Examples:

* Weight Check Recorded
* Package Created
* Package Moved

Warnings should be clear but should not interrupt workflow unless necessary.

---

# Pattern: Validation

Validate data as early as possible.

Use warnings rather than blocking errors whenever safe.

Examples:

* Weight increased unexpectedly.
* Package weights differ from source weight.

Allow the user to continue after acknowledging the warning.

---

# Pattern: Respect User Intent

The application should never make important decisions automatically when user judgment is required.

Examples:

* Never automatically mark a Tray Complete.
* Never automatically combine Trays.
* Never automatically choose a Storage Location.
* Never automatically deplete a Package.

The application may make recommendations, highlight patterns, or display warnings, but the final decision always belongs to the user.

---

# Pattern: Confirmation

Require confirmation only for actions that cannot easily be undone.

Examples requiring confirmation:

* Cancel Production Batch
* Archive Recipe
* Mark Package Depleted

Routine actions should not require confirmation.

---

# Pattern: Empty States

Every empty screen should explain:

* Why the screen is empty.
* What the user should do next.

Example:

```text
No Production Batches exist.

[ Create Production Batch ]
```

Avoid empty tables with no explanation.

---

# Pattern: Error Recovery

Errors should help the user recover.

Whenever possible:

* Preserve entered information.
* Explain what happened.
* Offer Retry.
* Avoid forcing users to start over.

---

# Pattern: Search

Search should update results as the user types.

Users should not need to press a Search button.

Search should tolerate partial matches.

Search should prioritize relevant results.

---

# Pattern: Tables

Tables should be used only when users need to compare multiple records.

Examples:

* Production Batch Tray list
* Inventory results
* Reports

On mobile devices, tables should become cards.

---

# Pattern: Cards

Cards represent physical objects.

Examples:

* Freeze Dryers
* Packages
* Recipes
* Trays, mobile

Cards should emphasize identity and current status.

---

# Pattern: Status Indicators

Use consistent visual indicators throughout the application.

Examples:

* Running
* Idle
* Complete
* Packaged
* Stored
* Warning

Status indicators should always use the same wording and visual treatment.

---

# Pattern: Historical Records

Historical information should never disappear.

When records change:

* Preserve history.
* Record corrections.
* Show current values clearly.

Users should always be able to understand what happened.

---

# Pattern: Workflow First

Every screen should answer one question:

"What is the user trying to accomplish right now?"

Interfaces should be organized around tasks rather than database entities.

Examples:

```text
Production

Record Weight Checks

Packaging

Create Packages

Inventory

Find Packages

Reports

Answer Questions
```

---

# Pattern: Physical World Mapping

Whenever possible, the application should mirror the physical workspace.

Examples:

* Freeze Dryers are the primary entry point into Production.
* Trays represent loaded tray records within a Production Batch.
* Physical Trays represent reusable numbered equipment.
* Tray Slots represent positions inside a Freeze Dryer.
* Packages represent physical bags.
* Storage Locations represent real shelves or bins.

Users should recognize the software immediately because it reflects their actual workspace.

---

# Pattern: Accessibility

The interface should be usable by a wide range of users.

Guidelines:

* Large touch targets.
* Clear labels.
* High contrast.
* Keyboard accessibility.
* Avoid color as the only indicator of status.

Accessibility should be considered part of the design, not an enhancement.

---

# Pattern: Simplicity

Every screen should have one primary purpose.

Avoid adding features simply because the data exists.

If a feature does not help the user's current task, consider moving it elsewhere.

Simple workflows are preferred over feature-rich screens.

---

# Guiding Principle

Every interaction should leave the user thinking:

"That worked exactly the way I expected."

The software should feel calm, predictable, and supportive of the user's workflow.

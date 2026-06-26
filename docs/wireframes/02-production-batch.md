# 02 - Production Batch

# Purpose

The Production Batch screen is the primary workspace for managing an active freeze-drying run.

It is designed around the user's real-world workflow while standing in front of the freeze dryer.

The goal is to make repetitive tasks, especially recording Weight Checks, as fast and effortless as possible.

This screen should minimize navigation, reduce repetitive clicks, and allow the user to move naturally from one Tray to the next.

---

# User Goals

A user should be able to:

* View the entire Production Batch at a glance.
* Record Weight Checks quickly.
* See which Trays still require attention.
* Determine when a Tray is ready to complete.
* Review the latest drying progress.
* Open detailed Tray history when needed.
* Finish the Production Batch and transition to Packaging.

---

# Primary Actions

* Record Weight Check
* View Tray Details
* Mark Tray Complete
* Edit Batch Notes
* Cancel Production Batch

Packaging is intentionally not performed on this screen.

Once trays are complete, the user moves to the Packaging workflow.

---

# Desktop Layout

Desktop is optimized for rapid keyboard-based data entry.

```text
+======================================================================================+
| Harvest Right #1                                                Running               |
| Production Batch #24                                           Started: Apr 25 9:30  |
+======================================================================================+

Batch Notes

______________________________________________________________

Tray | Product         | Last Weight | New Weight | Change | Status

----------------------------------------------------------------------------

1    | Taco Chicken    | 12.8 oz     | [______]   | --     | Running

2    | Taco Chicken    | 12.7 oz     | [______]   | --     | Running

3    | Strawberries    | 3.8 oz      | [______]   | --     | Running

4    | Skittles        | Complete    | [done]     | 0.0 oz | Complete

----------------------------------------------------------------------------

[ Save New Weights ]

----------------------------------------------------------------------------

Recent Activity

* Tray 4 marked Complete

* Tray 2 Weight Check recorded

* Batch started 8:30 AM
```

---

# Tablet / Mobile Layout

Smaller devices should present one Tray as an individual card.

```text
+-------------------------------------------+

Tray 1

Taco Chicken

Last Weight

12.8 oz

New Weight

[__________]

Status

Running

[ Save Weight ]

[ View History ]

+-------------------------------------------+
```

The user should swipe or scroll naturally through the Trays.

---

# Information Priority

Information should appear in this order:

1. Freeze Dryer
2. Production Batch Status
3. Trays requiring attention
4. Weight entry
5. Recent activity
6. Historical information

The focus should always remain on the current work.

---

# Weight Entry Workflow

The Production Batch screen is a data-entry workspace.

Users typically perform the following workflow:

```text
Weigh Tray 1

Enter Weight

Weigh Tray 2

Enter Weight

Repeat
```

The interface should support this process with minimal interruption.

Users should not need to open each Tray individually to record a Weight Check.

---

# Inline Weight Entry

Every running Tray should support inline weight entry.

When a weight is entered:

* Save should require only one action, or Enter.
* The Weight Check is recorded immediately.
* The weight difference is calculated automatically.
* The cursor advances to the next editable Tray.
* The user continues entering weights without navigating.

The application should optimize for sequential entry.

---

# Weight Feedback

Immediately after recording a Weight Check, the interface should display:

* Previous Weight
* New Weight
* Weight Difference

Example:

```text
Previous

12.8 oz

New

12.8 oz

Difference

0.0 oz

Stable
```

This allows the user to recognize when drying has stabilized.

The application should inform the user but should not automatically complete the Tray.

---

# Completing a Tray

Completing a Tray is a separate user decision.

If the latest Weight Check indicates the Tray may be complete, the interface should make the action obvious.

Example:

```text
Weight unchanged

[ Mark Tray Complete ]
```

The application should never automatically complete a Tray.

---

# Tray Details

Each Tray row or card should be selectable.

Selecting a Tray opens the Tray Details screen, where the user can view:

* Weight Check history
* Starting Weight
* Final Dry Weight
* Product information
* Preparation details
* Notes

The detail screen is intended for review, not routine weight entry.

---

# Batch Progress

Batch progress should communicate operational status rather than elapsed time.

Examples:

* 4 Running
* 3 Running, 1 Complete
* All Trays Complete

Avoid percentage-complete indicators, since drying duration varies by product.

---

# States

## Draft

Batch has been created but drying has not begun.

Primary Action:

Start Production Batch

---

## Running

One or more Trays are still drying.

Primary workflow:

Record Weight Checks.

---

## Completed

All Trays have been completed.

Primary Action:

Go to Packaging.

Example:

```text
All Trays are complete.

[ Package Completed Trays ]
```

---

## Cancelled

Production ended before completion.

Historical information remains available for reporting.

---

# Empty State

```text
No Production Batch selected.

Choose a Production Batch or create a new one.
```

---

# Error States

## Weight Check Failed

The user's entered value should remain visible.

Explain the error clearly.

Allow retry without retyping.

---

## Validation Warning

Warnings should inform the user without blocking workflow.

Examples:

* Weight increased significantly.
* Weight appears unusually low.
* Duplicate Weight Check.

The user should be allowed to continue after acknowledging the warning.

---

# Mobile Considerations

* One Tray per card.
* Large touch targets.
* Minimal typing.
* Vertical scrolling.
* Sticky batch summary.
* Quick access to Save Weight.

---

# Success Criteria

A user should be able to:

* Understand the state of the entire freeze dryer within five seconds.
* Record all Tray weights without leaving the screen.
* Enter consecutive Weight Checks with almost no mouse interaction.
* Recognize completed Trays immediately.
* Transition naturally into Packaging when drying is finished.

---

# Future Enhancements

Future versions may include:

* Weight trend graphs
* Estimated completion time
* Automatic stability suggestions
* Bulk weight import from connected scales
* Freeze Dryer performance metrics
* Overdue Weight Check reminders

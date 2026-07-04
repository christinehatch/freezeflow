# 02 - Production Batch

# Purpose

The Production Batch screen is the primary workspace for managing an active freeze-drying run.

It is designed around the user's real-world workflow while standing in front of the freeze dryer.

The goal is to make repetitive tasks, especially recording Weight Checks, as fast and effortless as possible.

This screen should minimize navigation, reduce repetitive clicks, and allow the user to move naturally from one Tray to the next.

---

# Milestone Progression

The Production Batch screen evolves throughout development.

## Milestone 2 — Setup Only

During Milestone 2, the Production Batch screen is a setup workspace only.

It does not include Weight Checks, tray completion, or packaging actions.

Implement:

* Batch summary (Freeze Dryer, status, notes)
* Suggested editable Batch Number during creation
* Freeze Dryer Slots list for setup fields only
* Select Physical Tray for each used Tray Slot
* Add product and preparation information for selected Trays
* Edit Draft Tray
* Remove Draft Tray
* Start Production Batch
* Cancel Production Batch

Do not implement:

* Starting Weight
* Weight Check entry
* Tray completion
* Batch completion indicators beyond Draft / Running / Cancelled

### Milestone 2 Desktop Layout

```text
+======================================================================================+
| Harvest Right #1                                                     Draft            |
| Chicken Batch                                                        Not started     |
+======================================================================================+

Batch Notes

______________________________________________________________

Freeze Dryer Slots

Slot | Physical Tray | Product         | Recipe              | Preparation Summary

----------------------------------------------------------------------------

1    | Tray 7        | Taco Chicken    | Taco Chicken        | 2 lbs grilled, seasoned

2    | Tray 3        | Strawberries    | —                   | Washed, hulled, sliced

3    | —             | —               | —                   | —

4    | Tray 11       | Skittles        | Skittles            | Single layer

----------------------------------------------------------------------------

[ Select Trays Used ]

----------------------------------------------------------------------------

[ Start Production Batch ]                              [ Cancel Batch ]
```

Draft setup should represent the Freeze Dryer's configured Tray Slots and the Physical Trays selected for those slots.

The number of selected Trays cannot exceed the Freeze Dryer's configured Tray Slot count.

Example:

```text
Slot | Physical Tray | Product         | Recipe              | Preparation Summary

----------------------------------------------------------------------------

1    | Tray 7        | Taco Chicken    | Taco Chicken        | 2 lbs grilled, seasoned

2    | Tray 3        | Strawberries    | —                   | Washed, hulled, sliced

3    | —             | —               | —                   | —

4    | Tray 11       | Skittles        | Skittles            | Single layer
```

The recommended setup action is:

```text
Select Trays Used
```

Primary action while Draft:

Start Production Batch

Once Running in Milestone 2, the screen shows the batch and tray setup information in read-only form.

Weight entry belongs to Milestone 3.

---

## Milestone 3 and Later

Adds Starting Weight, inline Weight Checks, tray completion, drying progress, Production Batch completion, and the full layouts below.

Starting Weight should appear as a structured field for each Tray before production starts.

Users should not need to store Starting Weight in Notes.

Every selected Tray must have a Starting Weight before Start Production Batch is enabled.

Starting Production automatically creates the first Drying Run.

Example:

```text
Slot | Physical Tray | Product      | Starting Weight | Status

----------------------------------------------------------------------------

1    | Tray 7        | Chicken      | [ 2.0 lb ]       | Ready

2    | Tray 3        | Chicken      | [ 2.0 lb ]       | Ready

3    | Tray 11       | Blueberries  | [ 2.0 lb ]       | Ready

4    | Tray 2        | Strawberries | [ 2.0 lb ]       | Ready

----------------------------------------------------------------------------

[ Start Production Batch ]
```

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

* Current Run Complete
* Record Weight Checks
* Start Another Drying Run
* View Tray Details
* Mark Tray Complete
* Complete Batch
* Edit Batch Notes
* Cancel Production Batch

Packaging is intentionally not performed on this screen.

Once trays are complete, the user moves to the Packaging workflow.

---

# Desktop Layout

Desktop is optimized for rapid keyboard-based data entry after a Drying Run completes.

## Active Drying Run

```text
+======================================================================================+
| Harvest Right #1                                                Running               |
| Production Batch #24                                           Started: Apr 25 9:30  |
+======================================================================================+

Current Drying Run

Run 1

Started: Apr 25 9:30 AM

[ Current Run Complete ]
```

While a Drying Run is active, Weight Check entry is not shown.

The user does not normally weigh trays during an active freeze dryer cycle.

---

## Completed Drying Run Weight Entry

```text
+======================================================================================+
| Harvest Right #1                                                Running               |
| Production Batch #24                                           Started: Apr 25 9:30  |
+======================================================================================+

Drying Run 1 Complete

Started: Apr 25 9:30 AM

Ended:   Apr 25 10:30 PM

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

* Drying Run 1 completed 10:30 PM
```

All Running Trays must receive a Weight Check for the completed Drying Run before another Drying Run can start.

Completed Trays are excluded from later Weight Check requirements.

---

## Continue Drying

After Weight Checks are saved, the user may mark some Trays Complete and continue drying the remaining Running Trays.

```text
Tray | Product         | Last Weight | Change | Status

----------------------------------------------------------------------------

1    | Taco Chicken    | 8.1 oz      | 0.0 oz | Complete

2    | Taco Chicken    | 8.3 oz      | 0.1 oz | Running

3    | Strawberries    | 3.8 oz      | 0.0 oz | Complete

4    | Skittles        | 4.2 oz      | 0.2 oz | Running

----------------------------------------------------------------------------

[ Start Another Drying Run ]
```

Starting another Drying Run includes only Trays that remain Running.

---

## Ready to Complete Batch

When every Tray is Complete, the Batch becomes ready to complete.

The Batch should not complete automatically.

```text
All Trays Complete

Review the Batch before moving to Packaging.

[ Complete Batch ]
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

Completing all Trays should make the Batch ready to complete, but the Batch still requires the user to choose Complete Batch.

---

# Tray Details

Each Tray row or card should be selectable.

Selecting a Tray opens the Tray Details screen, where the user can view:

* Weight Check history
* Drying Run context
* Starting Weight
* Finished Product Weight
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

# 04 - Tray Details

# Purpose

The Tray Details screen provides the complete production history for a single Tray.

Unlike the Production Batch screen, which is optimized for rapid data entry, the Tray Details screen is optimized for understanding, reviewing, and correcting historical information.

Users should rarely need this screen during routine production.

Instead, it serves as the authoritative record for everything that happened to a Tray.

---

# User Goals

A user should be able to:

* Review all Weight Checks.
* Understand the drying timeline.
* View preparation information.
* See when the Tray was completed.
* Review notes.
* Understand where the Tray ultimately went after Packaging.

---

# Primary Actions

* Add Weight Check, optional
* Edit Tray Notes
* Correct historical information, subject to audit rules
* Mark Tray Complete, if not already completed
* View Packaging Details

Routine Weight Checks should normally be entered from the Production Batch workspace.

---

# Screen Layout

```text
+====================================================================================+
| Tray 2                                                           Running           |
+====================================================================================+

Product

Taco Chicken

Recipe

Taco Chicken (Optional Template)

Preparation

Cubed into 1-inch pieces.
Seasoned with taco seasoning.
Pre-frozen overnight.

------------------------------------------------------------------------------

Production

Freeze Dryer

Harvest Right #1

Production Batch

#24

Started

April 25, 2026
9:30 AM

Completed

April 27, 2026
3:42 PM

------------------------------------------------------------------------------

Weights

Starting Weight

34.2 oz

Final Dry Weight

8.1 oz

------------------------------------------------------------------------------

Weight History

Run     Date & Time           Weight

Run 1   Apr 25 10:45 PM       15.8 oz

Run 2   Apr 26 9:00 AM        11.2 oz

Run 3   Apr 27 8:00 AM        8.4 oz

Run 4   Apr 27 2:30 PM        8.1 oz

------------------------------------------------------------------------------

Notes

____________________________________________________

------------------------------------------------------------------------------

Packaging

Packaging Date

April 27

Packages Created

Package A

Package B

Package C

[ View Package Details ]
```

---

# Information Priority

Information should appear in the following order:

1. Product
2. Current Status
3. Production Information
4. Weight History
5. Notes
6. Packaging Results

Historical review is the primary purpose of this screen.

---

# Weight History

Weight Checks should be displayed chronologically.

Each Weight Check should show:

* Drying Run
* Timestamp
* Weight
* Optional notes

Future versions may display a weight trend graph.

---

# Tray Status

Possible states:

* Draft
* Running
* Completed
* Cancelled

The current state should always be clearly visible.

---

# Packaging Information

Once a Tray has been packaged, the screen should display:

* Packaging Date
* Packages created
* Links to Package Details

Users should be able to trace the Tray forward into inventory.

---

# Notes

Notes should remain editable according to the project's audit rules.

Historical edits should preserve audit history.

---

# States

## Running

Weight Checks continue to be recorded after completed Drying Runs.

The Tray has not yet been completed.

---

## Completed

No additional Weight Checks may be recorded.

The Tray is ready for Packaging.

---

## Packaged

The Tray has been included in a Packaging Operation.

The Packaging results become visible.

---

## Cancelled

Historical information remains available.

Cancelled Trays continue to appear in reports where appropriate.

---

# Empty State

Not applicable.

Tray Details always represents an existing Tray.

---

# Error States

If Tray history cannot be loaded:

* Explain the issue.
* Allow retry.
* Preserve unsaved notes where possible.

---

# Mobile Considerations

* Stack information vertically.
* Collapse Weight History into expandable sections.
* Keep Product and Status pinned near the top.
* Make Package links easy to tap.

---

# Success Criteria

A user should be able to:

* Understand the complete history of a Tray within one minute.
* Review all Weight Checks.
* Trace the Tray into finished Packages.
* Verify preparation details used during production.
* Correct mistakes without losing historical context.

---

# Future Enhancements

Future versions may include:

* Weight trend charts
* Printable production records
* Photo attachments
* Timeline visualization
* Linked audit history
* Comparison with previous batches of the same product

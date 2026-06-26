# 06 - Package Details

# Purpose

The Package Details screen provides the complete history and traceability of a finished Package.

It allows the user to answer:

* What is this?
* Where did it come from?
* How was it prepared?
* Which trays contributed to it?
* Where has it been stored?
* Is it still in inventory?

This screen is optimized for understanding and traceability rather than data entry.

---

# User Goals

A user should be able to:

* Verify the contents of a Package.
* Review package information.
* See where the Package is currently stored.
* Trace the Package back to its source Trays.
* Open the original Tray Details.
* Mark the Package as depleted.
* Move the Package to another Storage Location.

---

# Primary Actions

* Mark Package Depleted
* Move Package
* Edit Notes
* View Source Trays
* View Production History

---

# Screen Layout

```text
+====================================================================================+
| Package PKG-104                                              In Storage            |
+====================================================================================+

Product

Taco Chicken

Package Weight

10.8 oz

Packaged

April 27, 2026

Storage Location

Bin A

------------------------------------------------------------------------------

Preparation

Cubed into 1-inch pieces

Seasoned with taco seasoning

Pre-frozen overnight

------------------------------------------------------------------------------

Source Trays

Tray 1

Harvest Right #1

Batch #24

Final Dry Weight: 8.2 oz

--------------------------------------------------

Tray 2

Harvest Right #1

Batch #24

Final Dry Weight: 8.1 oz

--------------------------------------------------

Tray 3

Harvest Right #1

Batch #24

Final Dry Weight: 8.3 oz

--------------------------------------------------

Tray 4

Harvest Right #1

Batch #24

Final Dry Weight: 8.2 oz

[ View Tray Details ]

------------------------------------------------------------------------------

History

Packaged

Moved to Bin A

Currently In Storage

------------------------------------------------------------------------------

Notes

____________________________________________________

------------------------------------------------------------------------------

[ Move Package ]

[ Mark Depleted ]
```

---

# Information Priority

Information should appear in the following order:

1. Product
2. Inventory Status
3. Storage Location
4. Preparation
5. Source Trays
6. Package History
7. Notes

Users should immediately understand what the Package is and where it is located.

---

# Package Information

Display:

* Product
* Package Weight
* Package Date
* Storage Location
* Current Status

These values represent the Package's current state.

---

# Preparation

Display the historical preparation information copied from the source Trays.

Users should not need to open a Tray to understand what the Package contains.

---

# Source Trays

Every Package should display the Trays that contributed to its creation.

Each Tray should display:

* Tray Number
* Production Batch
* Freeze Dryer
* Final Dry Weight

Each Tray should be clickable.

---

# History

The Package timeline should display significant events.

Examples:

* Package Created
* Storage Location Changed
* Package Depleted
* Corrections, future

History should be chronological.

---

# States

## In Storage

Package is available.

Primary Actions:

* Move Package
* Mark Depleted

---

## Depleted

Package remains visible as historical information.

No longer appears in default Inventory searches.

Primary Action:

View History

---

# Empty State

Not applicable.

Package Details always represents an existing Package.

---

# Error States

If Package information cannot be loaded:

* Explain the problem.
* Preserve unsaved Notes.
* Allow retry.

---

# Mobile Considerations

* Stack sections vertically.
* Display one Source Tray per card.
* Large action buttons.
* Sticky Package Status.

---

# Success Criteria

A user should be able to:

* Identify the Package immediately.
* Verify how it was prepared.
* Trace it back to every contributing Tray.
* Understand where it is currently stored.
* Perform common inventory actions without searching elsewhere.

---

# Future Enhancements

Future versions may include:

* Package photos
* QR code labels
* Printable labels
* Nutritional information
* Shelf-life estimates
* Moisture monitoring history
* Storage movement timeline

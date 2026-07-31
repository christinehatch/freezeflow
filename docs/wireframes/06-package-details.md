# 06 - Package Details

# Purpose

The Package Details screen identifies one physical Package and separates information by purpose.

It must distinguish:

* Package identity and current state
* human-facing Package Label content
* immutable Production History
* Packaging information
* Inventory History

Editing a Package Label must never rewrite Production History.

---

# User Goals

A user should be able to:

* identify the Package immediately
* review and edit its Package Label
* reprint its label
* trace it to every source Tray
* review Packaging and Inventory History
* move an In Storage Package
* mark an In Storage Package Given Away or Depleted

---

# Primary Actions

* Edit Package Label
* Reprint Package Label
* Move Package
* Mark Given Away
* Mark Depleted
* View Source Trays

---

# Screen Layout

```text
+====================================================================================+
| Package PKG-2026-000104                                      In Storage            |
+====================================================================================+

Package

Package Type: Quart Mylar
Finished Product Weight: 8.2 oz
Sealed Package Weight: 8.5 oz
Current Storage Location: Bin A

------------------------------------------------------------------------------

Package Label

Status: Ready

Display Name: Martin's Taco Meal
Subtitle / Description: Chicken and vegetables
Ingredients Summary: Chicken, cabbage, tomatoes, onion, cilantro, lemon juice
Net Weight: 8.2 oz
Fresh Equivalent: 2 lb fresh
Packaging Date: July 5, 2026
Package Identifier: PKG-2026-000104
Preparation Summary: Cubed and seasoned
Serving Notes: Two-cup meal
Rehydration Instructions: Add 2 cups water and wait 15 minutes

[ Edit Package Label ] [ Print / Reprint Label ]

Print History

July 5, 2026  Printed  Avery 5163

------------------------------------------------------------------------------

Production History

Source Tray 1 | Batch 24 | Black Freeze Dryer | Final Dry Weight 4.1 oz
Source Tray 2 | Batch 24 | Black Freeze Dryer | Final Dry Weight 4.1 oz

[ View Tray Details ]

------------------------------------------------------------------------------

Packaging

Packaged: July 5, 2026
Oxygen Absorber: 500cc
Packaging Notes: No notes

------------------------------------------------------------------------------

Inventory History

July 5, 2026  In Storage  Unassigned
July 6, 2026  Moved       Bin A

[ Move Package ] [ Mark Given Away ] [ Mark Depleted ]
```

---

# Information Priority

Information should appear in this order:

1. Package
2. Package Label
3. Production History
4. Packaging
5. Inventory History

The Package Label helps the user recognize and use the food. Production History preserves traceability. They must remain visibly distinct.

---

# Package

Display:

* Package Identifier
* Package Type
* Finished Product Weight
* Sealed Package Weight
* current Inventory Status
* current Storage Location

These values describe the physical Package and its current state.

---

# Package Label

Every Package owns exactly one editable Package Label.

Display:

* Display Name
* Subtitle or Description
* Ingredients Summary
* Net Weight
* Fresh Equivalent
* Packaging Date
* Package Identifier
* Preparation Summary
* Serving Notes
* Rehydration Instructions
* Label Status: Draft, Ready, or Needs Reprint

Package Identifier, Packaging Date, and weights should be rendered from authoritative Package records where documented rather than duplicated as unrelated editable values.

Before Milestone 8, editing a Package Label overwrites its current presentation fields. Milestone 8 adds correction and audit history. Label edits must not alter source Trays, Preparation Metadata, Weight Checks, or other Production History.

Printing does not change the Package lifecycle. Every print or reprint appends a Print Event. Editing a previously printed label changes its current Label Status to Needs Reprint.

---

# Production History

Display the immutable historical Preparation Metadata and every source Tray.

Each Tray should show:

* Tray Slot
* Physical Tray
* Product
* Ingredients
* Preparation Methods
* Production Batch
* Freeze Dryer
* Starting Weight
* Finished Product Weight

Each Tray should be clickable.

---

# Packaging

Display:

* Packaging date
* Package Type
* oxygen absorber
* Packaging notes
* source Packaging Operation as internal history, not a user-managed destination
* source Packaging Allocation and its selected completed Trays

The Packaging Allocation is an identified child of the Packaging Operation. It preserves how completed product was allocated to this Package without becoming a user-managed aggregate root.

---

# Inventory History

Display the append-only Package Status History and Storage Location History chronologically.

Examples:

* Package created In Storage
* Storage Location changed
* Package marked Given Away
* Package marked Depleted

---

# States

## In Storage

Primary actions:

* Move Package
* Mark Given Away
* Mark Depleted

## Given Away

The Package remains visible as history and is excluded from default active Inventory results.

## Depleted

The Package remains visible as history and is excluded from default active Inventory results.

Given Away and Depleted Packages may still have their Package Label viewed or reprinted.

---

# Error States

If Package information cannot be loaded:

* explain the problem
* preserve unsaved Package Label changes
* allow retry

---

# Mobile Considerations

* Stack sections vertically.
* Keep Package identity and Inventory Status visible.
* Display one source Tray per row or compact card.
* Keep label edit and reprint actions easy to reach.

---

# Success Criteria

A user should be able to:

* identify the Package immediately
* understand what the printed label says
* edit and reprint Package Label presentation without changing Production History
* trace the Package to every contributing Tray
* understand its current location and lifecycle
* perform valid Inventory actions without searching elsewhere

---

# Future Enhancements

Future versions may include:

* Package photos
* QR codes or barcodes
* Package Label history through the Audit system
* nutritional information
* shelf-life estimates
* moisture monitoring history

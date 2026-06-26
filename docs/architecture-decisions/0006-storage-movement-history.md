# ADR-0006 - Storage Movement History

# Status

Accepted

---

# Context

Packages may be moved between Storage Locations over time.

Examples include:

* Moving Packages between bins.
* Reorganizing pantry shelves.
* Consolidating storage.
* Correcting an incorrect Storage Location.

Users should always know where a Package is currently stored.

Whenever practical, they should also be able to understand where it has previously been stored.

Without a defined movement model, different implementations could overwrite Storage Locations without preserving historical information.

---

# Decision

Freezeflow preserves Storage Movement History.

Every Package has:

* one current Storage Location
* zero or more historical Storage Movements

Changing a Package's Storage Location creates a new historical movement.

The previous location is never discarded.

---

# Current Storage Location

Every Package belongs to exactly one current Storage Location.

This location is used for:

* Inventory searches
* Package Details
* Inventory reports
* Daily use

The current Storage Location represents where the Package physically exists today.

---

# Storage Movement

Whenever a Package changes Storage Location, Freezeflow records a Storage Movement.

A Storage Movement records:

* Package
* Previous Storage Location
* New Storage Location
* Movement Time
* Optional Notes

Future versions may also record:

* User
* Reason
* Device

Storage Movements are append-only historical records.

---

# Initial Placement

Creating a Package automatically creates its first Storage Movement.

Example:

```text
Package Created

Stored in Bin A
```

This first movement establishes the Package's initial Storage Location.

No special handling is required for newly created Packages.

---

# Package Moves

Users may move a Package whenever necessary.

Examples:

* Bin A -> Pantry
* Pantry -> Emergency Storage
* Freezer -> Basement

Every move creates another Storage Movement.

The Package's current Storage Location always reflects the most recent movement.

---

# Historical Integrity

Storage history is never deleted.

Historical Package Details should display the current Storage Location while allowing users to review previous locations when needed.

Movement history exists for traceability rather than daily workflow.

---

# Reports

Version 1 reports use the current Storage Location.

Historical Storage Movements are available for review but are not included in standard production reports.

Future reports may analyze storage movement frequency or inventory organization.

---

# User Experience

Daily workflows emphasize the current Storage Location.

Movement history remains secondary.

Example:

```text
Current Location

Bin A

View Location History

Apr 27

Created in Bin A

May 18

Moved to Pantry

July 12

Moved to Basement Shelf
```

Users should not need to view movement history during routine inventory searches.

---

# Renaming Storage Locations

Storage Locations may be renamed.

Renaming a Storage Location updates its display name throughout the application.

Historical Storage Movements continue to reference the same Storage Location.

The rename does not create a new Storage Movement.

---

# Archiving Storage Locations

Storage Locations should be archived rather than deleted.

Archived Storage Locations:

* cannot receive new Packages
* remain visible in historical records
* preserve historical traceability

Deleting Storage Locations is not supported.

---

# Future Considerations

Future versions may support:

* Bulk Package moves
* Storage maps
* Shelf organization
* Capacity tracking
* Barcode-assisted moves
* Movement reasons
* Multi-user attribution

These features extend the movement model without changing the underlying history.

---

# Consequences

## Benefits

* Complete storage traceability.
* Users can review where Packages have been stored.
* Inventory remains accurate after reorganization.
* Historical information is preserved.
* Supports future warehouse-style features without architectural changes.

---

## Tradeoffs

* Additional historical records are created for every Package move.
* More implementation complexity than simply updating a Storage Location.

These tradeoffs are acceptable because preserving traceability is one of the primary goals of Freezeflow.

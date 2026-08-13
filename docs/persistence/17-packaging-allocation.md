# Packaging Allocation

## Purpose

A Packaging Allocation is an identified child entity of a Packaging Operation.
It defines which completed Tray or Trays supply product for one or more Packages.

# Fields

| Field | Required | Editable while Open | Notes |
| --- | --- | --- | --- |
| id | Yes | No | Stable UUID |
| packagingOperationId | Yes | No | Owning aggregate root |
| notes | No | Yes | Optional context |
| createdAt | Yes | System | Record timestamp |
| updatedAt | Yes | System | Last update timestamp |

# Relationships

* An Allocation belongs to exactly one Packaging Operation.
* It references one or more completed Trays through Allocation Source Tray rows.
* It owns zero or more planned package rows.
* It owns zero or more recorded Packages.
* It owns zero or more Packaging Loss records.

An Allocation may exist with zero Packages. It never exists independently of its
Packaging Operation and is not managed as an aggregate root.

# Packaging Loss

See ADR-0016. A Packaging Loss records Selected Source Weight that will never
become a Package, for example product lost to sampling, spillage, or crumbs.

| Field | Required | Editable | Notes |
| --- | --- | --- | --- |
| id | Yes | No | Stable UUID |
| packagingAllocationId | Yes | No | Owning Allocation |
| weightGrams | Yes | No | Canonical grams (ADR-0003); greater than zero |
| reason | Yes | No | One of: Sampled, Spilled, Crumbs, Other |
| reasonDetail | No | No | Free text; only collected when reason is Other |
| recordedAt | Yes | System | Record timestamp |

Packaging Loss is append-only. Entries are never edited or deleted once
saved. A Packaging Loss cannot exceed the Allocation's Remaining Weight at
the time it is recorded, and never modifies a source Tray's Final Dry Weight
or any other historical production record.

# Allocation Source Tray

| Field | Notes |
| --- | --- |
| packagingAllocationId | References the Allocation |
| trayId | References one completed Tray |

The combination is unique. A completed Tray may belong to only one active
Allocation. All source Trays must belong to the Operation's Production Batch and
must not already be consumed by a completed Packaging Allocation.

# Derived Weight

* Selected Source Weight = sum of source Tray Finished Product Weights.
* Total Recorded Loss Weight = sum of the Allocation's Packaging Loss weights.

Both derived property groups below share these two inputs. All four
properties are derived and are not persisted independently. Sealed Package
Weight does not participate in any of these calculations.

## Internal (reservation)

* Allocated Weight = sum of recorded and planned Package Finished Product Weights.
* Remaining Weight = Selected Source Weight - Allocated Weight - Total Recorded Loss Weight.

These exist to protect correctness, not to describe physical progress. They
drive: rejecting a Planned Package Row update that would overcommit the
Allocation's Selected Source Weight, the invariant preserved when a Planned
Package Row converts to a Package, the Packaging Operation completion gate,
and client-side Bag-weight validation. Because Allocated Weight counts
unrecorded Planned Package Rows, Remaining Weight decreases as soon as a
draft Bag exists, before any Package is recorded. The Packaging UI must not
present these two values as operator-facing progress — see
`docs/06-ui-philosophy.md`'s "Present Physical State, Not Internal
Mechanism." They may surface only to explain a validation failure, for
example why another Bag cannot be drafted.

## Operator-facing (packaging progress)

* Bagged Weight = sum of recorded Package Finished Product Weights only;
  unrecorded Planned Package Rows are excluded.
* Remaining to Bag = Selected Source Weight - Bagged Weight - Total Recorded
  Loss Weight.

These describe the physical packaging process: how much product has
actually been bagged, and how much is still sitting on the table waiting to
be bagged. The Packaging UI's sidebar and hero display these two values, not
Allocated Weight or Remaining Weight. Drafting or editing a Planned Package
Row never changes either value; only recording or removing a Package does.

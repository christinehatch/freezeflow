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
| reason | Yes | No | Required explanation |
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
* Allocated Weight = sum of recorded and planned Package Finished Product Weights.
* Total Recorded Loss Weight = sum of the Allocation's Packaging Loss weights.
* Remaining Weight = Selected Source Weight - Allocated Weight - Total Recorded Loss Weight.

Remaining Weight is derived and is not persisted independently. Sealed Package
Weight does not participate in this calculation.

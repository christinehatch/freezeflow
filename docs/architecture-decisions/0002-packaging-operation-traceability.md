# ADR-0002 - Packaging Operations Preserve Tray-to-Package Traceability

# Status

Accepted

---

# Context

Operators may combine several completed Trays, divide the result among several
Packages, pause the work, and resume later. One Production Batch may also contain
different products that are packaged separately. Every Package must remain
traceable to the exact completed Trays that supplied it without forcing the
operator to perform physical tasks in a prescribed order.

---

# Decision

`PackagingOperation` is the aggregate root for one resumable packaging workspace.
It has an `Open` or `Completed` status. At most one Open Packaging Operation may
exist for a Production Batch. The operator explicitly completes it after all
required product has been allocated and recorded.

`PackagingAllocation` is an identified child entity inside the Packaging
Operation. It has stable identity independent of its Packages but cannot exist
outside its parent Packaging Operation. An Allocation references one or more
completed Trays as its product source and connects that source to zero or more
Packages. Separate combinations of Trays use separate Allocations.

An Allocation may exist before any Package is recorded. This allows open work,
planned package rows, and Package Label drafts to survive closing and reopening
the application. A Package is created when the operator intentionally records
it in Freezeflow. There is no Draft Package inventory state.

Selected source weight and allocated Package Finished Product Weight are
persisted facts. Remaining product weight is derived from them and is never
stored independently. Sealed Package Weight does not reduce remaining product.

Completed product may be allocated to only one active Packaging Allocation at a
time. Version 1 Allocations reference Trays from one Production Batch.

Users work with a Packaging workspace and selected Trays. They do not manage
Allocations as standalone records.

---

# Consequences

* Packaging may be paused and resumed without losing work.
* Different Tray combinations in one Production Batch remain distinct.
* Packages retain exact source-Tray traceability through their Allocation.
* An Allocation may contain zero Packages while work is being prepared.
* No selected product may silently disappear when Packaging is completed.
* Corrections after completion follow ADR-0005.

---

# Alternatives Considered

## Direct Packaging Operation to Tray Association

Rejected because it cannot distinguish separate combinations of Trays within
one resumable Packaging Operation.

## Packaging Allocation as Aggregate Root

Rejected. Allocations have stable identity but belong to the lifecycle and
transaction boundary of their Packaging Operation.

## Packaging Allocation

Rejected as terminology. `Packaging Allocation` answers the business question
of where completed product went and matches the traceability purpose.

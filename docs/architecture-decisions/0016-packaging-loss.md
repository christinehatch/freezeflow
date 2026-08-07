# ADR-0016 - Packaging Loss

# Status

Proposed

---

# Context

Selected Source Weight for a Packaging Allocation comes from the Final Dry
Weight of its source Trays. TR-012 and PK-008 require Allocated Weight to
fully account for Selected Source Weight before a Packaging Operation can
complete, so that no source product silently disappears.

In practice, a small amount of dried product between weighing the Trays and
sealing Packages may never become a Package. Product is sampled for taste,
crumbles during handling, or is otherwise lost before it can be bagged. This
is normal, expected loss, not a data-entry mistake, and it should not require
correcting a Tray's historical Final Dry Weight just to make the numbers
agree.

Without an explicit way to record this, an Allocation with a few grams of
unaccounted product becomes permanently unable to complete, which conflicts
with PK-023 ("the application must not require... one fixed physical order")
and the intent behind TR-012 that Packaging remain resumable and honest about
the physical work actually performed.

---

# Decision

Introduce Packaging Loss: an explicit, reasoned, append-only record that a
portion of an Allocation's Selected Source Weight will not become a Package.

A Packaging Loss:

* belongs to exactly one Packaging Allocation
* records a weight greater than zero, entered in any supported display unit
  and stored in canonical grams (ADR-0003)
* records a required reason chosen from a fixed list: Sampled, Spilled,
  Crumbs, or Other
* when the reason is Other, may also record an optional free-text detail;
  the detail is not shown or collected for the other three reasons
* records a system-assigned recordedAt timestamp
* is never edited or deleted once saved

Remaining Weight becomes:

```text
Remaining Weight = Selected Source Weight - Allocated Weight - Total Recorded Loss Weight
```

A Packaging Loss cannot exceed the Allocation's Remaining Weight at the time
it is recorded. Recording a Packaging Loss can bring Remaining Weight to zero
and unblock completion under TR-012, exactly like allocating the same amount
to a Package would, except that the weight is explicitly recorded as never
becoming inventory.

---

# What Packaging Loss Does Not Do

Packaging Loss must never:

* modify a source Tray's Final Dry Weight or any other historical production
  record
* create, modify, or replace a Package
* affect Package Fresh Equivalent calculations for other Packages in the
  Allocation, which continue to use the source Trays' recorded weights
* substitute for Milestone 8 corrections; an incorrectly recorded Packaging
  Loss is corrected the same way other Milestone 8 fields will be, not by
  editing or deleting the entry

---

# User Experience

Packaging Loss is offered as an alternative to "Add another bag" whenever an
open Allocation has Remaining Weight greater than zero, using the same
weight-entry pattern as a Bag (value plus unit).

Package Details and Allocation history should display recorded Packaging
Loss entries alongside recorded Packages, so the full accounting for an
Allocation's Selected Source Weight stays visible in one place: how much
became Packages, and how much was explicitly recorded as loss.

---

# Consequences

## Benefits

* Small, real-world product loss no longer blocks completing a Packaging
  Operation.
* Historical Tray weights remain untouched; the discrepancy is explained
  rather than erased.
* Remaining Weight keeps its meaning ("what still needs to be accounted
  for") instead of being worked around by editing unrelated fields.

## Tradeoffs

* Adds a new persisted entity and a second way a Packaging Allocation can
  reach zero Remaining Weight, which the UI and future reports must both
  account for.
* Without a maximum threshold, a user could record a large Packaging Loss
  instead of investigating a real measurement or entry error. Version 1
  relies on the required reason and visible history rather than a hard
  limit.

---

# Open Decisions

* Should Packaging Loss appear in Reports (Milestone 7) as its own figure,
  for example alongside yield, so users can see how much product is lost
  across batches over time?
* Exact API route and request/response shape, to be defined alongside the
  other Packaging endpoints in `docs/09-api-design.md`.

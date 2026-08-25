# ADR-0019 - Reporting Architecture

# Status

Accepted

---

# Context

Milestone 7 introduces Reporting: Freeze Dryer Performance, Product
History, Preparation History, Drying Time, Production History, and
Inventory Summary. Every one of these aggregates across many rows of
historical production data — averages across many Production Batches,
sums across many Trays or Packages, counts grouped by Freeze Dryer,
Product, or Preparation Preset.

This is a genuinely new kind of computation for Freezeflow. ADR-0003
already establishes that derived values (it names Total Drying Time and
Package Fresh Equivalent explicitly) should be computed rather than
persisted, and ADR-0008 already establishes that reports "should be
derived from historical records and canonical current values." Neither
says *how* a cross-entity aggregate should be computed, or *where* that
computation happens. Every existing derived value in the codebase reduces
one entity's own already-loaded relationships in Python — for example
`production_batch_data()`'s `total_drying_seconds`, summed in Python over
one Batch's Drying Runs after they're already fetched. That idiom does not
generalize to "the average of this value across every Batch a Freeze Dryer
has ever run," and someone extending Reporting later could reasonably copy
it anyway without realizing it doesn't scale past a single entity.

Three real forks in the road need a durable, citable answer instead of a
one-off implementation choice buried inside a service file.

---

# Decision

## Aggregation happens in SQL, not in Python

Reports use grouped SQL aggregate queries (`func.avg`, `func.sum`,
`func.count`, `func.min`, `func.max`, `GROUP BY`) — never by loading full
ORM object graphs into Python and reducing them there. `list_product_groups()`
in `app/services/inventory.py` (a grouped `select()` with `func.count`,
`func.min`, `func.max`, already used for Product-grouped Inventory) is the
idiom to follow. `production_batch_data()`'s Python-side summing of
`total_drying_seconds` is not — it works at single-Batch scale and should
not be copied at report scale.

## Reports are always computed on demand

No report result is cached or materialized. There is no report-snapshot
table, and therefore no cache-invalidation problem to solve. This follows
directly from RP-001/RP-002 (reports are never the source of truth, and
must always reflect current historical records) and avoids reintroducing
the exact class of staleness bug Milestone 6's Snapshot Integrity work
fixed for Preparation Preset display names — a cached report result could
just as easily go stale the moment underlying data changes.

## Reports never join live to mutable current-state data for values that must reflect history

Reports read Tray's immutable Preparation Metadata snapshot columns
(`product_name`, `ingredients`, `preparation_methods`,
`preparation_preset_name_at_use`) and the already-immutable weight and
timestamp columns on Batches, Trays, Drying Runs, and Packages. They never
join live to the current `PreparationPreset` row for a value that must
reflect what actually happened — renaming or archiving a Preparation
Preset must never change a report that already reflects Trays created from
it. This is the report-level generalization of Milestone 6's Core
Principle and the direct implementation of the Reporting wireframe's
"Historical Accuracy" requirement.

---

# Alternatives Considered

* **A materialized `report_cache` table**, refreshed on a schedule or on
  write. Rejected: reintroduces staleness risk this codebase has no need
  to accept at its current data scale, and would need its own
  invalidation-on-edit logic — exactly the bug class Milestone 6 just
  fixed for a different feature.
* **A generic reporting query-builder or DSL**, so future reports could be
  configured rather than coded. Rejected as over-engineering for six fixed
  reports; `app/services/reports.py` following the established
  grouped-aggregate idiom is sufficient, and a generic builder can be
  reconsidered if a much larger report catalog ever materializes.
* **Python-side reduction**, matching `production_batch_data()`'s existing
  idiom. Rejected: doesn't scale past a single entity's own relationships,
  and using it here would set the wrong precedent for the rest of this
  milestone and any report added after it.

---

# Consequences

* `app/services/reports.py` is the one place report queries live; new
  reports extend it using the same grouped-aggregate idiom rather than
  inventing a new one.
* Report response shapes are dedicated Pydantic schemas (see
  `09-api-design.md`), not ad hoc dicts — consistent with how the rest of
  the API surface already models its request/response contracts.
* No new persisted entity, cache table, or background job is introduced by
  Reporting. The tradeoff is that report queries recompute their answer on
  every request; this is acceptable at Freezeflow's household-scale data
  volume, the same reasoning ADR-0007 and ADR-0018 already rely on for
  read-time aggregation elsewhere in the application.

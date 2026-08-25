# Milestone 7 - Reporting

## Status

Planned.

All architecture and scope decisions below were resolved in authoritative
documentation (this file, `docs/09-api-design.md`, `docs/04-business-rules.md`,
`docs/wireframes/07-reports.md`, and new ADR-0019) before implementation
began, per AGENTS.md's documentation-first process. Implementation proceeds
in eight phases: documentation groundwork, backend response schemas and
report queries, backend API endpoints, backend tests, frontend API client,
the Reports page itself, frontend tests, and a final regression/verification
pass. This section is updated to Complete once all phases have merged.

---

# Goal

Provide production insights: give operators a way to learn from historical
production and inventory data rather than only seeing current work.

---

# Objectives

Implement:

* Freeze Dryer Performance, Product History, Preparation History, Drying
  Time, Production History, and Inventory Summary reports
* filtering by Date Range, Freeze Dryer, Product, Preparation Preset, and
  Production Batch, with only the filters relevant to the selected report
  shown
* a versioned `/api/v1/reports/*` API surface, replacing the four stale,
  unversioned, schema-less stubs that predated this milestone's full
  report set
* SQL-computed aggregation (never Python-side reduction, never cached or
  materialized) as this codebase's first cross-entity reporting surface
* strict historical accuracy: every report reads each Tray's immutable
  Preparation Metadata snapshot, never a live join to a Preparation
  Preset's current values

---

# Scope

Milestone 7 includes:

* the six reports named above, each answering the specific questions
  documented in `docs/wireframes/07-reports.md`
* Date Range, Freeze Dryer, Product, Preparation Preset, and Production
  Batch filters, applied per the filter-applicability table in
  `docs/wireframes/07-reports.md`
* a distinct product-names lookup, since no `Product` entity exists in the
  persistence model
* backend business-rule tests proving aggregate correctness and the
  historical-snapshot guarantee
* frontend component tests covering every report type and all five
  documented UI states

---

# Out of Scope

Do not include:

* interactive charts or any data-visualization library
* a custom report builder
* CSV/Excel export
* cost analysis
* production forecasting
* shelf-life statistics
* machine-utilization trend analysis beyond Freeze Dryer Performance's
  four stated metrics
* a full packaging-efficiency-analysis feature beyond the basic
  tray-output-vs-packaged-output comparison YD-003 already scopes into
  this milestone
* an auto-generated natural-language comparison sentence
* report result caching or materialization

Milestone 8 (Corrections & Audit History) owns correction workflows and
audit-trail display; Reporting must respect corrections' resulting values
but does not implement correction UI itself. Milestone 9 owns broader
polish and production readiness.

---

# Core Principle

> **Reports are read-only, on-demand views over historical data. They never
> become the source of truth, and they never let current-state edits
> rewrite what already happened.**
> Every report is computed fresh at query time via SQL aggregation — never
> cached, never materialized into a table of its own. Every report reads
> each Tray's immutable Preparation Metadata snapshot rather than joining
> live to the current Preparation Preset row, so renaming or archiving a
> Preset can never retroactively change a report that already reflects
> Trays created from it.

This is the report-level generalization of Milestone 6's Core Principle
and Snapshot Integrity guarantee, and it is the direct implementation of
the Reporting wireframe's own "Historical Accuracy" requirement. See
ADR-0019 for the full architectural reasoning.

---

# Known Limitations

**Product names are free text with no normalization or uniqueness
enforcement.** Unlike Preparation Preset names (case-insensitively unique
since Milestone 6), `Tray.product_name`/`PreparationPreset.product_name`
have no such constraint anywhere in the schema. A Tray typed as "Chicken"
and another typed as "chicken" are, today, two different rows in Product
History, Preparation History, Production History, and Inventory Summary's
Most Common Products. Milestone 7 inherits this gap; it does not create
it, and does not fix it.

This is called out explicitly, in its own section, so a future contributor
doesn't find it and "fix" it by normalizing or merging product names
*inside the reporting layer* — that would silently change what a report
shows without changing the historical data it reads, producing exactly
the kind of display-only inconsistency Milestone 6's Snapshot Integrity
work exists to prevent. If this is ever fixed, it belongs at the
data-entry/normalization layer (mirroring how Preparation Preset names are
already normalized), with reports automatically inheriting the fix.

---

# Report Scope and Filtering

**Completed-only scope (RP-003):** Production Batches contribute only when
`status == Completed`. Trays contribute only when `status IN (Completed,
Packaged)` — both represent a Tray that finished drying with an immutable
`final_dry_weight_grams`; `Packaged` is simply "completed and later
packaged," not a different outcome. Draft, Running, and Cancelled Batches
and Trays are excluded from every report. Inventory Summary is the one
exception: it includes Packages of every status, since "how much inventory
have I produced" includes Packages that have since left storage.

**Date Range field per report (RP-004):** `ProductionBatch.completed_at`
for Batch-level reports, `Tray.completed_at` for Tray-level reports,
`Package.packaged_at` for Inventory Summary — each is the one immutable,
always-populated timestamp on the rows the status filter above already
includes. Inclusive on both ends, UTC day boundaries.

**Historical snapshot reads (RP-005):** reports read `Tray.product_name`,
`Tray.ingredients`, `Tray.preparation_methods`, and
`Tray.preparation_preset_name_at_use` — never a live join to the current
`PreparationPreset` row.

**Unrecognized filter values** (an unknown `freeze_dryer_id`,
`preparation_preset_id`, or `production_batch_id`) are treated identically
to "no matching data" and return an empty result, not a 404 — matching how
Inventory search already behaves.

---

# The Six Reports

## Freeze Dryer Performance

Grouped by Freeze Dryer: Number of Completed Production Batches, Average
Dry Time, Average Weight Loss, Average Time to Completion.

Average Dry Time is averaged at the Batch level, not weighted by how many
Trays a Batch contained — a 100-Tray Batch and a 10-Tray Batch each
contribute one value. Average Time to Completion is wall-clock
(`completed_at - started_at`) and is computed and named separately from
Average Dry Time per business rule DR-012 ("Production Batch wall-clock
duration must not be used as actual drying time"). Average Weight Loss is
Tray-level, averaged across every qualifying Tray in that machine's
Completed Batches; Trays missing `starting_weight_grams` are excluded from
the average rather than corrupting it.

Filters: Date Range, Freeze Dryer.

## Product History

Grouped by `Tray.product_name`: times produced, average drying time,
average yield, last batch date.

Average drying time attributes each Batch's total drying time once per
distinct Product represented in that Batch — a Batch that dried two
Products simultaneously contributes its one shared duration to both
Products' averages, a deliberate and documented choice, not
double-counting. Average yield (`final_dry_weight_grams /
starting_weight_grams` per Tray) excludes Trays with a null or zero
`starting_weight_grams` rather than treating them as zero yield.

Filters: Date Range, Product.

## Preparation History

Grouped by `Tray.preparation_preset_name_at_use`: same shape as Product
History. Trays with no Preparation Preset are grouped into their own row
(`used_preset: false`) rather than excluded, since inline entry is fully
supported and equally first-class per Milestone 6. The bucket is
distinguished by that boolean field, never by string-matching a display
label, since a real Preparation Preset could itself be named "No Preset."

Filters: Date Range, Preparation Preset.

## Drying Time

One row per Completed Production Batch: Freeze Dryer, Batch Number,
Completed date, Total Drying Time, Drying Run count, Voided Run count. The
Batch-level detail that Freeze Dryer Performance's per-machine averages
roll up from.

Filters: Date Range, Freeze Dryer, Production Batch.

## Production History

One row per Completed Production Batch: Batch Number, Freeze Dryer,
Completed date, Tray count, Products represented, Total Drying Time. The
general-purpose historical browse view, supporting every filter. Renamed
from the stale "Production Summary" API stub, which predated this
milestone's full report set and was never implemented against — there is
no separate "summary" concept.

Filters: Date Range, Freeze Dryer, Product, Preparation Preset, Production
Batch.

## Inventory Summary

Packages currently In Storage, Given Away, and Depleted; two distinct
production-total figures; Most Common Products.

Given Away is included alongside In Storage and Depleted (the wireframe
originally named only the latter two) since `InventoryStatus` has exactly
three values and omitting one would make the counts not add up to
total-ever-produced.

Total production is shown as two distinct labeled figures, never merged:
*Total Packaged Weight* (`SUM(Package.finished_product_weight_grams)`
across every Package ever created, any status) as the headline figure,
since Package is the canonical inventory unit (PK-012); *Total Dried
Weight* (`SUM(Tray.final_dry_weight_grams)` across every qualifying Tray)
as a secondary figure. These are intentionally not expected to match —
some dried product may not yet be packaged, and packaging introduces its
own weight differences — and the response/UI states this explicitly so it
never reads as a bug.

Filters: Date Range, Product.

---

# Empty and Undefined-Average Display Contract

If a group (for example a Freeze Dryer) has zero contributing Completed
Batches in the selected range, its row is omitted entirely, matching what
a `GROUP BY` naturally produces. Within an included row, an average whose
inputs were *all* missing after per-metric filtering (for example every
Tray of a Product lacking `starting_weight_grams`) renders as `null`, not
`0` — a report showing `0%` weight loss when the data is simply absent
would be actively misleading.

---

# API Expectations

`docs/09-api-design.md`'s Reporting Endpoints section fully defines the
versioned `/api/v1/reports/*` surface: `freeze-dryer-performance`,
`product-history`, `preparation-history`, `drying-time`,
`production-history`, `inventory-summary`, and `product-names`, each with
its applicable filters and full response schema. Every report response is
a dedicated Pydantic schema (`FreezeDryerPerformanceRow`,
`ProductHistoryRow`, `PreparationHistoryRow`, `DryingTimeRow`,
`ProductionHistoryRow`, `InventorySummary`), not an ad hoc dict, matching
the schema-first direction the rest of the API already takes. A shared
`ReportFilters` request schema bundles the up-to-five applicable query
parameters; it stays generic and carries no per-report validation logic —
each report simply reads whichever fields are relevant to it and ignores
the rest, keeping the object reusable by whatever report Milestone 8 or 9
adds next.

---

# Persistence Expectations

Reporting introduces no new persisted entities and no schema migration. It
reads existing immutable columns: `Tray.product_name`/`ingredients`/
`preparation_methods`/`preparation_preset_name_at_use`/
`starting_weight_grams`/`final_dry_weight_grams`/`completed_at`;
`ProductionBatch.completed_at`/`started_at`/`freeze_dryer_id`;
`DryingRun.started_at`/`ended_at`/`status`; `Package.packaged_at`/
`finished_product_weight_grams`/`status`.

No report result is cached or materialized (ADR-0019) — every request
recomputes its answer directly from these columns at query time.

---

# Validation Rules

Backend business logic must enforce:

* Production Batches contribute to a report only when `status == Completed`
  (RP-003)
* Trays contribute only when `status IN (Completed, Packaged)` (RP-003)
* Inventory Summary includes Packages of every `InventoryStatus`
* each report's Date Range filter applies to the correct immutable
  timestamp for that report (RP-004)
* reports never join live to a Preparation Preset's current values for
  data that must reflect history (RP-005)
* an unrecognized filter id returns an empty result, not an error
* an average whose contributing values are all missing renders as `null`,
  never `0`

---

# Testing Expectations

## Backend

* exact aggregate correctness for all six reports against hand-computed
  expected values, seeded with multiple Freeze Dryers, Batches with known
  Drying Run durations, Trays across multiple products with known
  weights, some created from a Preparation Preset and some not, and
  Packages across all three Inventory Statuses
* NULL/zero-weight edge cases: a still-Running Tray excluded entirely
  (never zero-filled); a Tray with null or zero `starting_weight_grams`
  excluded from yield averages without corrupting or erroring the report
* completed-only scoping: Draft, Running, and Cancelled Batches/Trays
  seeded alongside Completed ones and confirmed excluded everywhere they
  should be
* filter combination coverage, including an unrecognized filter id
  returning an empty result rather than a 404
* the empty-row/null-average display contract described above
* a dedicated Snapshot Accuracy test module (mirroring Milestone 6's own
  split-out Snapshot Integrity test): create a Preset, create a Tray from
  it, run Preparation History, edit the Preset's name, re-run Preparation
  History, and confirm the bucket is unchanged — verified to actually fail
  if the query is reverted to a live join, before being finalized

## Frontend

* each of the six report types rendering with mock data
* filter selection narrowing which query parameters are sent, asserted
  against the constructed request
* the filter-applicability table (selecting a report type shows only its
  relevant filters)
* No Data, Empty, and Error states each rendering their documented copy
* Error-state retry re-issuing the request with filters intact

---

# Deliverables

Milestone 7 deliverables are:

* documentation-first groundwork: `docs/09-api-design.md`'s Reporting
  Endpoints section fully specified and versioned; `docs/wireframes/07-reports.md`'s
  three previously-undefined reports given detail sections, its
  chart/notes self-contradiction resolved, and its filter-applicability
  table added; `docs/04-business-rules.md`'s RP-003 through RP-005; new
  ADR-0019
* `app/schemas/reports.py` with dedicated response and filter schemas
* `app/services/reports.py` with SQL-aggregate report queries and a
  shared date-range helper
* `app/api/reports.py`, registered under `/api/v1/reports/*`
* backend business-rule tests, including the dedicated Snapshot Accuracy
  module
* `reportsApi` in the frontend API client
* the real `ReportsPage.tsx`, replacing its placeholder stub, implementing
  all six reports, the filter-applicability table, and all five documented
  UI states
* frontend component tests
* a final regression, grep-sweep, and manual-verification pass

---

# Open Decisions

Every decision below was resolved during planning, before implementation
began, per AGENTS.md's documentation-first process.

### 1. API doc stub naming mismatch — Resolved

"Production Summary" (the pre-existing API doc stub) and "Production
History" (the wireframe) are the same report, renamed. There was no
separate "summary" concept documented anywhere. See `docs/09-api-design.md`.

### 2. Undefined reports in the wireframe — Resolved

Preparation History, Drying Time, and Production History — named in the
wireframe's "Available Reports" list but never defined — now have full
detail sections in `docs/wireframes/07-reports.md`, consistent in shape
with the three reports the wireframe already defined.

### 3. Charts vs. "Future Enhancements" self-contradiction — Resolved

The wireframe's own mockup showed a Charts section and an auto-generated
comparison sentence, while its "Future Enhancements" section listed
"Interactive charts" as explicitly out of Version 1. Resolved in favor of
the Future Enhancements framing: Version 1 renders tables and summary
stat blocks, no charting library was added, and the mockup and Notes
sentence were removed from the wireframe.

### 4. Whether a new ADR was needed — Resolved, yes

ADR-0003 and ADR-0008 establish philosophy (derive don't persist; reports
reflect history) but not mechanics (how aggregation is computed, whether
results are cached, whether live joins are ever acceptable). ADR-0019
resolves all three as genuinely new, precedent-setting decisions for this
codebase's first cross-entity aggregation surface.

### 5. Preparation History's "no preset" bucketing — Resolved

Included as its own row (`used_preset: false`), not excluded, so inline
Preparation Metadata entry — fully supported since Milestone 6 — remains
visible in this report. Distinguished by a boolean field, not a string
label, since a real Preparation Preset could be named "No Preset."

### 6. Inventory Summary's "Total production" — Resolved

Shown as two distinct labeled figures (Total Packaged Weight, Total Dried
Weight), explicitly not expected to match, rather than one merged number
that would hide the gap between them. Given Away is included alongside In
Storage and Depleted for a complete three-way status breakdown.

### 7. Report response shapes — Resolved

Dedicated Pydantic schemas per report, not ad hoc dicts, matching this
codebase's existing schema-first direction. Considered and declined:
having the service layer return framework-agnostic domain data with only
the API layer constructing Pydantic models — every other service module
in this codebase already returns Pydantic-adjacent or ORM shapes for the
API layer to serialize, so a new dataclass layer here would be a one-off
pattern rather than following the codebase's existing direction.

### 8. Shared filter object — Resolved

`ReportFilters` bundles the up-to-five applicable query parameters as one
reusable, generic Pydantic model. It carries no per-report validation
logic or report-aware branching — each report simply ignores whichever
fields don't apply to it, keeping the object equally usable by whatever
report Milestone 8 or 9 adds.

### 9. Product name case-sensitivity — Resolved, documented as a Known Limitation, not fixed

See the Known Limitations section above. Deliberately not folded into
Out of Scope, so it isn't later "fixed" silently inside the reporting
layer in a way that would change report output without changing the
underlying historical data.

### 10. Navigation placement — Verified, no change needed

Reports is already primary navigation per `docs/wireframes/00-navigation.md`,
already routed at `/reports`, and already linked from the top-level nav.
No routing or navigation changes are required for this milestone.

---

# Definition of Done

Milestone 7 is complete when:

* all Open Decisions above remain resolved in authoritative documentation
* all six reports return SQL-aggregated results scoped to completed
  production history, per RP-003
* each report's Date Range filter applies to the correct immutable
  timestamp, per RP-004
* every report reads Tray's immutable Preparation Metadata snapshot, never
  a live join to a Preparation Preset's current values, per RP-005, and
  this guarantee is covered by a dedicated, verified regression test
* an unrecognized filter id returns an empty result, never a 404
* an average with no contributing data renders as `null`, never `0`
* the versioned `/api/v1/reports/*` API surface fully replaces the stale
  unversioned stubs, with dedicated Pydantic schemas for every response
* `ReportsPage.tsx` implements all six reports, the documented
  filter-applicability table, and all five documented UI states
  (Normal, No Data, Filtered, Empty, Error-with-retry)
* backend and frontend Milestone 7 tests pass
* lint, formatting, type checks, and production builds pass
* a final grep sweep confirms no remaining reference to the old
  unversioned reporting stub paths
* the application was manually verified end-to-end against the real UI
  and a live database, including re-running a report after renaming a
  Preparation Preset and confirming the historical result is unchanged
* no Milestone 8 or later functionality has been introduced

All Open Decisions are resolved as of this revision; see the Open
Decisions section above for where each resolution is authoritatively
documented.

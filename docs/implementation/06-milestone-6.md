# Milestone 6 - Preparation Presets

## Status

Complete.

Implemented across eight merged phases, each reviewed as its own branch and
PR and stacked on the previous phase so `main` was never left in a broken
state: documentation-first groundwork, backend model/schema/migration
foundation, the Preparation Preset service and API, the Snapshot Integrity
regression test, the frontend API client and `TagAutocompleteField`
primitive, the standalone Preparation Presets management page, wiring
Preset selection into Tray setup, and a final full-stack regression and
verification pass. Phases were implemented in dependency order
(0 → 1 → 2 → 4 → 6 → 3 → 5 → 7) rather than numeric order so that live Tray
creation through the real UI was restored as early as possible, since
Phase 1 alone (a backend-only rename) left the application unable to
create a new Tray until the frontend caught up. The whole stack merged
into `main` together once Phase 7's full verification passed. All Open
Decisions below were resolved in the authoritative architecture,
business-rules, persistence, and API documentation before implementation
began; see each decision's entry under Open Decisions for where its
resolution lives.

---

# Goal

Build optional reusable Preparation Metadata presets, completing the
migration from the pre-ADR-0013 `Recipe` model that the accepted
architecture had already renamed at the documentation level but that the
backend and frontend code had not yet caught up to.

Preparation Presets exist to speed up data entry for Products, Ingredients,
and Preparation Methods an operator produces repeatedly. They are never a
prerequisite for Production and never become the authoritative source of
historical truth for a Tray once it exists.

---

# Objectives

Implement:

* Preparation Preset create, list, get, update, archive, and restore
* case-insensitive name uniqueness across active and archived Presets
* structured `ingredients` and `preparation_methods` string-list fields on
  both Preparation Preset and Tray, replacing the old single freeform
  `preparation` text field for all new data
* a suggestions endpoint that surfaces distinct existing ingredient and
  preparation-method values from both Presets and historical Trays, so
  one-off entries typed directly on a Tray also become future suggestions
* optional Preparation Preset selection during Tray setup, pre-filling an
  editable starting point rather than binding the Tray to the Preset
* an immutable Tray-owned snapshot of whatever Product Name, Ingredients,
  and Preparation Methods were actually submitted, regardless of whether
  they originated from a Preset, were edited from a Preset, or were
  entered entirely inline
* a true immutable snapshot of the Preset's name at Tray-creation time,
  closing a real pre-existing bug where the displayed preset/recipe name
  was computed live via a join and could change retroactively
* a standalone Preparation Presets management page
* a reusable tag-autocomplete input primitive for the design system

---

# Scope

Milestone 6 includes:

* creating, viewing, editing, archiving, and restoring user-managed
  Preparation Presets
* selecting a Preparation Preset while setting up a Tray, as a convenience
  that pre-fills editable fields
* creating a Tray with fully inline Product Name, Ingredients, and
  Preparation Methods, with no Preparation Preset at all
* editing an existing Draft Tray's structured Preparation Metadata
* autocomplete suggestions for Ingredients and Preparation Methods, sourced
  from both saved Presets and prior Tray entries
* free-text one-off Ingredient and Preparation Method entry without
  requiring a catalog record to exist first
* a permanent, read-only legacy fallback for the freeform `preparation`
  text recorded by every Tray and Recipe created before this milestone

Preparation Presets remain lightweight, optional data-entry conveniences.
Selecting one never makes it the system of record for a Tray that has
already been created.

---

# Out of Scope

Do not include:

* normalizing Ingredients into canonical food entities, quantities,
  measurements, or a unit-of-measure system
* nutritional computation of any kind
* an Ingredient or Preparation Method catalog table
* recipe-of-recipes composition or hierarchical recipes
* extending Inventory search to include Preparation Presets (Milestone 5's
  IN-011 deferral stands; Preset search/browse lives only on the new
  Preparation Presets page)
* a "reload the latest Preset values onto an existing Tray" convenience
  feature — this would violate the Core Principle below and needs its own
  explicit, documented decision if ever proposed
* production reports or Preparation Preset usage analytics
* corrections UI or audit history UI

Reporting belongs to Milestone 7. Corrections and Audit History belong to
Milestone 8.

---

# Core Principle

> **Preparation Presets are templates, not authoritative production
> records.** Selecting a Preparation Preset only provides an editable
> starting point. The operator always owns the final Tray data. When the
> Tray is saved, the submitted Product Name, Ingredients, and Preparation
> Methods become the immutable historical record, regardless of how they
> originated.

This is the single most load-bearing rule in the milestone. It is the
whole reason `preparation_preset_id`/`preparation_preset_name_at_use` exist
as provenance-only fields rather than live references, and it is why the
server never overwrites a Tray-create request's own `product_name`,
`ingredients`, or `preparation_methods` with the selected Preset's stored
values. It also sets this milestone's place in Freezeflow's overall
philosophy: Milestone 4 preserves exactly what happened during packaging;
Milestone 5 preserves exactly where Packages went; Milestone 6 preserves
exactly what the operator actually produced, never what the Preset
currently says.

---

# Workflow Summary

1. An operator may optionally create a Preparation Preset ahead of time,
   or one-off Ingredients and Preparation Methods typed directly onto a
   Tray become future autocomplete suggestions on their own.
2. While setting up a Draft Tray, the operator may select a Preparation
   Preset from an active (non-archived) list.
3. Selecting a Preset pre-fills the Tray's Product Name, Ingredients, and
   Preparation Methods fields with the Preset's current values. Nothing is
   persisted yet.
4. The operator may freely edit any of the pre-filled values, or ignore
   Presets entirely and enter everything inline.
5. On save, the Tray records whatever Product Name, Ingredients, and
   Preparation Methods were actually on the form, plus - only if a Preset
   was selected - the Preset's id and its current name, captured once as
   an immutable snapshot.
6. Later edits to the Preparation Preset (rename, archive, changed
   Ingredients or Preparation Methods) never retroactively change any
   Tray already created from it.
7. Preparation Preset selection is create-time-only: editing an existing
   Tray's structured fields does not re-record which Preset it came from.

---

# Preparation Presets

Preparation Presets represent reusable combinations of Product Name,
Ingredients, and Preparation Methods an operator produces repeatedly, such
as a household's usual Taco Chicken or Sliced Strawberries preparation.

Milestone 6 supports:

* listing active and archived Preparation Presets
* creating a user-managed Preparation Preset with a name, product name,
  optional Ingredients list, optional Preparation Methods list, and
  optional notes
* editing any of those fields in place, regardless of archive state
* archiving a Preparation Preset
* restoring an archived Preparation Preset

Preparation Presets are archived rather than deleted, matching the pattern
already established for Storage Locations and Package Types.

An archived Preparation Preset:

* cannot be selected for a new Tray
* remains visible in the Archived list and can still be edited or restored
* has no effect on Trays already created from it

Preparation Preset names are trimmed and non-blank, and are
case-insensitively unique across both active and archived Presets, the
same rule already used for Storage Locations - reusing a name requires
restoring the archived Preset rather than creating a new one. Unlike
Storage Location, there is no reserved system-provided Preset name.

See business rules RC-001 through RC-006 and
`docs/persistence/04-preparation-preset.md`.

---

# Tray Setup Integration

Tray setup gained a Preparation Preset `<select>` alongside two
tag-autocomplete inputs for Ingredients and Preparation Methods, replacing
the old single freeform `preparation` text input.

Selecting a Preset is purely a client-side convenience: it copies the
Preset's current `product_name`, `ingredients`, and `preparation_methods`
into the Tray setup form's local state. The Preset selection can also be
used this way while editing an existing Tray, as a quick-fill shortcut,
without that edit re-recording which Preset was used - provenance is
create-time-only.

Saving a Tray always sends whatever is currently in the form, whether it
came from a Preset untouched, a Preset that was then edited, or was typed
entirely by hand. When `preparation_preset_id` is included in a create
request, the server's only use for it is validating the Preset exists and
is not archived, and capturing its current name into
`preparation_preset_name_at_use` for provenance - the server never
overwrites the request's own submitted values with the Preset's row.

A Tray created without a Preparation Preset requires a Product Name plus
at least one of Ingredients or Preparation Methods - deliberately "at
least one," not "both," so sparse or asymmetric entry (a long ingredient
list with no separately named method, or vice versa) is fully supported
rather than treated as incomplete.

Read-only Tray display renders the structured Ingredients/Preparation
Methods fields when present, falling back to the legacy freeform
`preparation` string only for Trays created before this milestone.

---

# Suggestions and Autocomplete

Ingredient and Preparation Method entry uses a shared tag-autocomplete
input: typing filters a pre-fetched list of suggestions client-side,
clicking a suggestion or pressing Enter on unmatched text adds a chip, and
no catalog record is ever required to exist first.

Suggestions are sourced from distinct existing values across **both**
Preparation Presets and historical Trays, so an operator's one-off Tray
entries also surface as suggestions on future Trays and Presets, not just
values saved to a Preset. The suggestions endpoint is called once per
field when the input mounts or refreshes, not per keystroke; filtering
against the fetched list happens entirely client-side.

---

# Snapshot Integrity

Once a Tray is created, later edits to (or archiving of) the Preparation
Preset it was created from must never retroactively rewrite that Tray's
historical record. This is the specific fix for a real pre-existing bug:
the old Recipe-era `tray.recipe_name` was computed live via a join to the
Recipe's current name, so renaming a Recipe silently changed what an
already-completed Tray displayed. `Tray.preparation_preset_name_at_use` is
a true immutable snapshot captured once at Tray-creation time, and the
Tray's own `product_name`/`ingredients`/`preparation_methods` columns are
the historical record independent of the Preset's current state.

This guarantee is covered by a dedicated backend regression test module
(`test_milestone_6_snapshot_integrity.py`), separate from the general CRUD
test suite, that creates a Preset, creates a Tray from it, edits the
Preset's name and structured fields, and confirms the re-fetched Tray is
completely unchanged while the re-fetched Preset reflects the edit. The
test's ability to actually catch a regression was verified directly:
reverting the snapshot field to the old live-join expression made the test
fail with a clear diff before the fix was restored.

---

# API Expectations

Milestone 6 requires workflow-oriented API capabilities for:

* listing active and archived Preparation Presets
* creating a Preparation Preset
* getting a single Preparation Preset
* editing a Preparation Preset
* archiving a Preparation Preset
* restoring a Preparation Preset
* retrieving distinct Ingredient/Preparation Method suggestions across
  Presets and Trays
* creating a Tray with structured `ingredients`/`preparation_methods` and
  an optional `preparation_preset_id`
* editing an existing Tray's structured Preparation Metadata

Commands must enforce lifecycle and naming rules in backend business
logic; the client must not be the only enforcement layer.

`09-api-design.md` fully defines the versioned `/api/v1/preparation-presets`
routes (list, create, get, update, archive, restore, suggestions) and the
Add-Tray endpoint's snapshot-content contract. Preparation Preset
archive/restore use explicit action endpoints rather than generic field
PATCH, the same pattern used for Storage Location and Package Type, because
each represents a domain transition, not an ordinary edit. Only the new
Milestone 6 endpoints are versioned; the pre-existing unversioned Add-Tray
endpoint was left as-is as unrelated pre-existing debt, out of scope for
this milestone.

---

# Persistence Expectations

Use the authoritative persistence model.

Preparation Preset stores:

* name, product name, notes
* `ingredients` and `preparation_methods` as JSON string-list columns
* archive state
* a permanently nullable legacy `preparation` text column, populated only
  on rows migrated from the pre-Milestone-6 Recipe table and never written
  by new code

Tray stores:

* `ingredients` and `preparation_methods` as JSON string-list columns,
  populated for every Tray created from this milestone forward
* `preparation_preset_id`, a live foreign key retained for optional
  "view current Preset" navigation, but never used as a display source
* `preparation_preset_name_at_use`, an immutable snapshot of the Preset's
  name at Tray-creation time - the authoritative display source
* a permanently nullable legacy `preparation` text column, the original
  freeform value for Trays created before this milestone

The legacy `preparation` columns on both tables are permanently immutable
historical fallback data. No future cleanup job, migration, or backfill
may synthesize them into the structured `ingredients`/`preparation_methods`
fields after the fact - doing so would fabricate structure that was never
actually recorded. This constraint outlives Milestone 6.

The Alembic migration that introduced this schema
(`0012_preparation_presets`) renamed the `recipes` table to
`preparation_presets` and `trays.recipe_id` to
`trays.preparation_preset_id`, added the new JSON and snapshot columns, and
performed no data backfill - existing rows kept their legacy `preparation`
text untouched. It was verified twice against a copy of a real seeded
pre-Milestone-6 database with direct row inspection (not just an
automated migration test), and reconfirmed against the live development
database immediately before this milestone's stack merged, with a clean
`PRAGMA foreign_key_check` and intact row counts.

---

# Validation Rules

Backend business logic must enforce:

* Preparation Preset names are trimmed, non-blank, and case-insensitively
  unique across active and archived Presets
* an archived Preparation Preset cannot be archived again
* only an archived Preparation Preset may be restored, and restore
  re-checks name uniqueness against any Preset created in the meantime
* an archived Preparation Preset cannot be selected when creating a new
  Tray
* a Tray created without a Preparation Preset requires a Product Name plus
  at least one of Ingredients or Preparation Methods non-empty
* when a Preparation Preset is provided at Tray-creation time, the
  server's only use for it is existence/archive validation and capturing
  its current name into the immutable snapshot - it never overwrites the
  request's own submitted Product Name, Ingredients, or Preparation
  Methods
* editing a Preparation Preset never modifies any Tray previously created
  from it
* the suggestions endpoint rejects any `field` value other than
  `ingredients` or `preparation_methods`

---

# Testing Expectations

## Backend

Added tests for:

* Preparation Preset create, list, get, update, archive, and restore
* case-insensitive name uniqueness across active and archived Presets,
  including restore re-checking uniqueness
* rejection of double-archive and restoring a non-archived Preset
* archived Preset rejected when selected for a new Tray
* Tray creation with fully inline values and no Preparation Preset
* a Preset-selected Tray snapshotting the submitted values rather than the
  Preset's own stored values
* the suggestions endpoint returning distinct values from both
  Preparation Presets and Trays, and rejecting an invalid `field`
* the Snapshot Integrity guarantee, in its own dedicated test module:
  editing or archiving a Preset after a Tray was created from it leaves
  the Tray's historical record completely unchanged
* the migration's real-database safety, verified through direct row
  inspection rather than an automated test alone

## Frontend

Added component tests for:

* the `TagAutocompleteField` primitive in isolation: add via click, add
  via free-text Enter, remove via chip button and Backspace, filter by
  typed text, keyboard navigation, and already-added suggestions excluded
  from the dropdown
* the Preparation Presets management page: create, archive, restore,
  edit-in-place with an exact request-body assertion, structured
  validation-error-then-successful-retry, and back-navigation
* Tray setup: creating a Tray by selecting a Preparation Preset and
  confirming submitted edits win over the Preset's own values, editing an
  existing Draft Tray's structured fields, and a legacy-Tray display case
  confirming the freeform fallback renders
* a Packaging worksheet regression case, added during the final
  verification pass, confirming the structured Preparation summary
  renders for a Tray with no legacy `preparation` text (this test was
  verified to fail against the code it was written to catch, the same
  discipline used for the Snapshot Integrity test)

No Playwright end-to-end coverage was added in this milestone; Milestone 6
was verified through backend and frontend component tests plus repeated
manual verification directly against the real UI and a live development
database, described under Deliverables below.

---

# Deliverables

Milestone 6 deliverables are:

* documentation-first groundwork: business rules, persistence docs, API
  design docs, wireframes, and terminology reconciled to Preparation
  Preset before any code changed, including renaming
  `docs/persistence/04-recipe.md` and `docs/wireframes/08-recipes.md`
* the Alembic migration renaming Recipe to Preparation Preset and
  introducing structured `ingredients`/`preparation_methods` columns,
  verified against real seeded data
* Preparation Preset backend service and versioned REST API, including
  archive/restore and the cross-table suggestions endpoint
* the Snapshot Integrity regression test module proving ADR-0013's core
  guarantee as a concrete, checkable fact
* frontend API client types and functions for Preparation Presets and the
  updated Tray shape
* the `TagAutocompleteField` design-system primitive
* the standalone Preparation Presets management page
* Preparation Preset selection wired into Tray setup, with submitted
  values always winning over the Preset's stored values
* backend business-rule tests
* frontend component tests
* a full final-phase regression, migration-safety, and grep-sweep pass
  that found and fixed one remaining call site (the Packaging worksheet)
  still reading the legacy `preparation` field directly
* documentation cleanup for stale Recipe wording, reviewed hit-by-hit
  rather than blanket-replaced, preserving legitimate historical
  references (ADR-0001, migration files, point-in-time milestone specs)

---

# Open Decisions

Every decision below is resolved. Each entry keeps its original question
for context and records where the resolution now lives.

## Previously Blocking

### 1. Recipe → Preparation Preset migration strategy — Resolved

Resolved by treating this milestone as a genuine schema migration, not a
find-and-replace rename: new nullable `ingredients`/`preparation_methods`
JSON columns were added to both `preparation_presets` and `trays`, the
existing freeform `preparation` column was kept on both tables, made
nullable, as a permanently immutable read-only legacy fallback, and no
historical data was backfilled or synthesized into the new structured
fields. See the Persistence Expectations section above and the
`0012_preparation_presets` migration.

### 2. Live-join display bug — Resolved

Resolved by adding `Tray.preparation_preset_name_at_use`, a true immutable
snapshot captured once at Tray-creation time, replacing the old
`tray.recipe.name` live join that let renaming a Recipe retroactively
change what already-completed Trays displayed. See the Snapshot Integrity
section above.

### 3. Snapshot content when a Preset is edited before saving — Resolved

Resolved by the Core Principle above: the create-Tray request body always
carries the actual `product_name`/`ingredients`/`preparation_methods` to
persist. When `preparation_preset_id` is also provided, the server's only
job with it is validating the Preset exists and is not archived, and
capturing its current name for provenance - it never overwrites the
submitted values with the Preset's own row.

---

## Previously Needing Clarification

### 4. API versioning scope — Resolved

Only the new Milestone 6 endpoints are versioned under `/api/v1/`; the
pre-existing unversioned Add-Tray endpoint was left as-is as unrelated
pre-existing debt, out of scope for this milestone.

### 5. Required fields when no Preset is selected — Resolved

Resolved as Product Name plus at least one of Ingredients or Preparation
Methods non-empty - deliberately "at least one," not "both," so sparse or
asymmetric entry is fully supported rather than treated as a validation
gap. See the Tray Setup Integration section above.

### 6. Suggestions query implementation — Resolved

Resolved using SQLite's `json_each` table-valued function rather than an
in-Python flatten-and-dedupe, since this is a SQLite-only stack. The
frontend calls the suggestions endpoint once per field-load, not per
keystroke, so the dialect coupling is a one-time-per-load cost.

### 7. Shared uniqueness helper across Storage Location and Preparation Preset — Resolved

Only the string-normalization step (trim and reject blank) was extracted
into a shared utility (`app/services/_naming.py`). Each service keeps its
own name-uniqueness business-rule function built on top of it, since
Storage Location and Preparation Preset naming rules may diverge later -
for example, Storage Location reserves the name `Unassigned`, and
Preparation Preset has no equivalent reserved name.

### 8. Legacy `preparation` field exposure — Resolved

The legacy `preparation` field is never exposed on the Preparation Preset
API surface, since Presets have no historical-data reason to need it. It
is exposed only on `TrayRead`, as a display fallback for Trays created
before this milestone.

### 9. Inventory search extension — Resolved, deferral stands

Milestone 5's business rule IN-011 explicitly deferred Preparation Preset
search from Inventory search to a future milestone. Milestone 6 does not
extend Inventory search; Preparation Preset search and browsing live only
on the new Preparation Presets page. Extending Inventory search remains
out of scope to avoid reaching into Milestone 7/reporting territory.

### 10. Navigation placement — Verified, matches documented classification

`docs/wireframes/00-navigation.md` classifies Preparation Presets as a
secondary administrative screen, the same tier as Storage Locations off
Inventory and Package Types off Packaging. The Preparation Presets page is
reachable through a `ButtonLink` from the Production landing page, not a
new top-level `Layout.tsx` navigation entry, matching that documented
classification exactly.

---

# Definition of Done

Milestone 6 is complete when:

* all blocking Open Decisions have been resolved in authoritative
  documentation
* Preparation Presets can be created, edited, archived, and restored
  according to documented rules
* Preparation Preset names are trimmed, non-blank, and case-insensitively
  unique across active and archived Presets
* an archived Preparation Preset cannot be selected for a new Tray
* a Tray can be created with fully inline Product Name, Ingredients, and
  Preparation Methods, with no Preparation Preset at all
* selecting a Preparation Preset only pre-fills an editable starting
  point; the submitted values at save time always become the Tray's
  historical record, regardless of how they originated
* editing or archiving a Preparation Preset never rewrites any Tray
  already created from it, and this guarantee is covered by a dedicated,
  verified regression test
* the pre-existing live-join display bug is fixed: Tray display reads an
  immutable name snapshot, never a live join to the Preset's current name
* Ingredient and Preparation Method suggestions are sourced from both
  Presets and historical Trays and require no catalog record to exist
  first for one-off entry
* the standalone Preparation Presets management page supports the full
  create/archive/restore/edit lifecycle
* the legacy `preparation` text field remains permanently intact and
  read-only for Trays and Presets created before this milestone, with no
  data ever backfilled into the new structured fields
* the Alembic migration was verified against real seeded data, not just
  an automated test
* backend and frontend Milestone 6 tests pass
* lint, formatting, type checks, and production builds pass
* a full final-phase grep sweep found and fixed the one remaining stale
  call site, with no other stale Recipe/preparation references left
  outside legitimate historical context
* the application was manually verified end-to-end against the real UI
  and a live database: creating a Preset, creating a Tray from it, editing
  the Preset afterward, and confirming the Tray's display stayed
  unchanged
* no Milestone 7 or later functionality has been introduced

All Open Decisions are resolved as of this revision; see the Open
Decisions section above for where each resolution is authoritatively
documented.

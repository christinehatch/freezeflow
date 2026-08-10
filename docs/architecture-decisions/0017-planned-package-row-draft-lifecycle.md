# ADR-0017 - Planned Package Row Draft Lifecycle

# Status

Accepted

---

# Context

`docs/05-terminology.md`, `docs/08-data-model.md`, `docs/persistence/18-planned-package-row.md`,
and the Stage 3 wireframe in `docs/wireframes/03-packaging.md` all describe a
Planned Package Row as durable working state that "survives navigation and
application restart," and describe reload as resuming "a durable unrecorded
planned row." None of them say what triggers a Planned Package Row's creation,
what triggers its persistence while the operator is still editing, or what
happens to it once its Bag is recorded.

The single-bag loop (`SingleBagEntryLoop`) already reads Planned Package Rows
correctly: an existing unrecorded row pre-fills the next Bag form, and an
unrecorded row blocks "No more bags — Review" exactly as the wireframe
specifies. But nothing in that component ever creates or updates a Planned
Package Row. The in-progress Bag form is plain React state. The only things
that have ever created a Planned Package Row are the developer-tools seed
scripts and direct API calls from tests — never a real operator action.

During implementation, it appeared that Planned Package Rows were obsolete
because no operator workflow could create them. Investigation showed the
opposite: the persistence model, terminology, wireframes, and backend all
consistently describe them as a required domain concept. The missing piece
was the lifecycle connecting the Bag form to the existing persistence model.

Three genuinely different domain states exist during Packaging, and only one
of them currently has no way to be reached:

```text
Operator is thinking          →  Planned Package Row
Operator commits the bag      →  Package
Operator later finds an error →  Correction (Milestone 8)
```

A Package cannot stand in for the first state. Per ADR-0005, Package creation
is a Non-Correctable Event, and per `docs/persistence/07-package.md`, recording
a Package immediately mints a permanent Package Identifier and creates its
Package Label and initial Package Status History and Storage Location
History — real inventory and real history, the instant it happens. There is
also currently no endpoint to edit a Package's own fields at all outside the
not-yet-built Milestone 8 correction workflow. Treating a still-being-typed
Bag as a Package would mean minting real historical records for a value the
operator hasn't finished deciding.

This ADR defines the missing lifecycle so the gap can be implemented without
further ambiguity.

---

# Decision

## Lifecycle overview

```text
New Bag
   │
   ▼
Blank Form
   │
   │ first meaningful edit
   ▼
Planned Package Row created
   │
   │ further edits, debounced
   ▼
Planned Package Row updated  ◄── repeats while the operator keeps editing
   │
   │ operator clicks "Save Bag"
   ▼
Package created
   ├── recordedPackageId set on the Planned Package Row
   ├── Package Label created
   ├── Package Status History created
   └── Storage Location History created
```

The Planned Package Row is never a separate screen or object the operator
manages — it is the persisted form of the Bag they are already looking at.

## Creation

A Planned Package Row is created on the first meaningful edit of a new Bag
form. A meaningful edit is the first change that causes any persisted Planned
Package Row field to become non-null or to differ from its default value —
selecting a Package Type, or entering a weight, absorber, storage location, or
note. Opening a blank Bag form does not create a row; there is nothing yet
worth preserving.

## Autosave

Edits are saved on a debounce, not on every keystroke: after a field changes,
wait for a short pause in editing (on the order of 1–2 seconds) before sending
the update. While a save is pending, the Bag form shows "Unsaved"; once the
request succeeds, it shows a subtle "Saved" confirmation. This avoids
hammering the backend on every character while still delivering the crash and
navigation resilience the documentation already promises.

If the operator navigates away (changes Allocation, moves to another stage,
leaves the page) while a debounced save is still pending, the pending save is
flushed immediately rather than surfacing an interruption prompt — consistent
with PK-023's requirement that the application not impose a fixed physical
order or add friction to normal navigation. The row should reflect the
operator's last edit even if they leave before the debounce timer would
otherwise have fired.

If an autosave request fails (network error, server error), the Bag remains
in an Unsaved state, and no subsequent "Save Bag" action may proceed until the
Planned Package Row has been successfully persisted. This keeps "the row
reflects what the operator sees" true at every point, rather than letting a
Bag be recorded from data the backend never actually held.

## Conversion

A Planned Package Row is converted into a Package when the operator explicitly
saves the physical bag ("Save Bag N"). This already works today: `POST
.../allocations/{id}/packages` accepts a `planned_package_row_id` and the
backend sets that row's `recordedPackageId` when the Package is created. The
missing piece is exclusively on the frontend: the Bag form must carry the
autosaved row's id through to that call, the same way it already does when
resuming an existing planned row.

## Reconciliation scope

`PATCH .../allocations/{id}`'s `planned_packages` array describes only the
Allocation's current *unrecorded* Planned Package Rows — the ones a Bag form
could still be editing. Recorded rows are immutable historical records and
are excluded from that array's reconciliation entirely: an autosave request
never needs to include them, and the endpoint never creates, edits, or
removes a recorded row regardless of whether one happens to be present or
absent from a given request.

This was not the endpoint's original behavior. Reconciliation used to treat
every row not present in the request as slated for removal, erroring on a
recorded row either way — present or absent. That made autosave impossible in
any Allocation with more than one Bag, since the very first autosave for Bag
2 would always describe a payload that either omitted or included Bag 1's
now-recorded row, and both were rejected. Recorded rows are not part of the
"current planned work" this array exists to describe, so the endpoint now
excludes them from reconciliation outright instead of erroring on either
side of that boundary. See `docs/09-api-design.md` and
`docs/persistence/18-planned-package-row.md` for the resulting contract.

## Deletion

Planned Package Rows are never deleted. When a Package is recorded,
`recordedPackageId` is set to reference the created Package. Recorded rows are
excluded from unrecorded counts and from reconciliation, but remain part of
the permanent Packaging history.

This matches the persistence doc's own field definition for
`recordedPackageId` and this application's append-only treatment of every
other historical record. Hard deletion on conversion would have been the one
place in the architecture where a record disappears instead of being
superseded or linked — the evidence points in only one direction, so this is
settled rather than left open.

## Application close or navigation away

If the application closes or the operator navigates away mid-edit, the row is
restored exactly as the operator left it on return — this is the entire
reason the row exists. Combined with the flush-on-navigate behavior above, no
edit should ever be silently lost between one autosave and the next.

---

# User Experience

Planned Package Row is an implementation name. An operator never sees or
needs to know whether their in-progress entry is "planned," "draft," or
"recorded" — to them, it is just **Bag 1**, the same Bag they are already
looking at. The distinction between Planned Package Row and Package is purely
internal:

* the Bag form shows only Bag numbering, field values, and a small
  Saved/Unsaved indicator;
* no screen refers to a "Plan," "Draft," or "Planned Package Row" by that
  name.

The single-bag entry form is the sole editor for Planned Package Rows.
Operators do not create, browse, or manage Planned Package Rows
independently, and no separate "Planned Package Rows" screen should ever be
built — the Bag form is the entire interface this entity has or needs.

---

# What This Decision Does Not Change

* Package immutability, Package identifiers, and Package Label rules from
  ADR-0004, ADR-0005, and ADR-0014 are unchanged.
* This does not introduce a general-purpose autosave framework elsewhere in
  the application — it defines the lifecycle for exactly one existing entity,
  Planned Package Row, inside the existing single-bag loop.
* This does not change how Planned Package Rows are read or how they block
  "No more bags — Review"; that behavior is already correct.
* This does not create a standalone Planned Package Row management surface;
  see User Experience above.

---

# Consequences

## Benefits

* Closes the gap between what the documentation already promised (crash- and
  navigation-resilient Bag entry) and what the current UI actually does
  (in-memory-only draft state).
* Gives operators a real, observable Saved/Unsaved state instead of a silent
  risk of losing an in-progress Bag.
* Requires no new backend capability for conversion, and no new endpoint for
  autosave — `PATCH .../allocations/{id}` already accepts `planned_packages`.
  It does require fixing that endpoint's reconciliation to exclude recorded
  rows (see Reconciliation scope above), since autosave is the first real
  caller to exercise an Allocation with both recorded and unrecorded rows at
  once.
* Makes the "Resume Packaging Session" developer scenario represent a state a
  real operator can actually reach, closing the gap that made it feel like
  the seed data was doing something the application couldn't.
* Settles a question (deletion on conversion) that was previously an unstated
  assumption, using evidence already present in the codebase rather than a
  fresh guess.

## Tradeoffs

* Adds a debounced network call, a save-failure gate on "Save Bag," and a
  small saved/unsaved indicator to the Bag form's implementation.
* The Allocation's Remaining Weight and "Allocated" figure can now change
  from autosave alone, before any Bag is recorded — already true today
  whenever a Planned Package Row exists, but will now happen far more often
  once real operators create them directly.

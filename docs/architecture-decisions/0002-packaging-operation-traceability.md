# ADR-0002 - Packaging Operations Preserve Tray-to-Package Traceability

# Status

Accepted

---

# Context

Completed Trays are often packaged after drying.

Sometimes one Tray is packaged by itself.

Sometimes multiple compatible Trays are mixed together before packaging.

That mixed product may then be divided into multiple finished Packages.

Every Package must remain traceable back to the Tray or Trays that produced it.

At the same time, users should think in terms of the workflow:

* select completed Trays
* package selected Trays
* create Packages

Users should not need to manage an additional object just to preserve traceability.

---

# Decision

Freezeflow uses an internal Packaging Operation entity.

A Packaging Operation represents one packaging action.

It contains one or more completed Trays.

For Version 1, selected Trays must belong to the same Production Batch and Freeze Dryer, as defined in ADR-0011.

It produces one or more Packages.

A Tray may participate in only one Packaging Operation.

Each Package belongs to exactly one Packaging Operation.

The public workflow remains Package selected Trays.

The API exposes this as a package creation action, such as `POST /api/v1/packages`.

The server creates the internal Packaging Operation automatically.

Packaging Operations appear as part of package history rather than as user-managed records.

---

# Alternatives Considered

## Direct Package-to-Tray Relationship

Rejected.

A direct relationship works when one Package comes from one or more Trays.

It becomes ambiguous when multiple Trays are mixed and then divided into multiple Packages.

It also loses the real-world packaging action that connected the selected Trays to the resulting Packages.

## Consolidated Lot

Rejected as user-facing terminology.

The concept is useful internally, but the term does not match how users describe the workflow.

Users package selected Trays; they do not create Consolidated Lots.

## Public Packaging Operation API

Rejected.

Packaging Operation is an internal traceability concept.

The public API should describe the user's action rather than expose internal implementation details.

---

# Consequences

Traceability from Package back to source Trays is preserved.

Packages can be created from mixed completed Trays without duplicating or reusing Trays across packaging actions.

The user experience remains simple.

The UI can show Packaging Operations as history events without requiring users to manage them directly.

Reporting can trace Packages through Packaging Operations to Trays, Production Batches, Freeze Dryers, Weight Checks, and historical preparation information.

# ADR-0014 - Package Labels, Durable Draft Work, and Print Events

# Status

Accepted

---

# Context

Operators may prepare labels before, during, or after filling bags. They may
pause Packaging, change a Package weight, or reprint one damaged label. Label
work must survive closing the application without creating inventory
prematurely, and presentation changes must never rewrite Production History.

---

# Decision

Each persisted Package owns exactly one editable `PackageLabel`.

While a Packaging Operation is Open, durable planned package rows store the
operator's package plan and draft label content inside a Packaging Allocation.
These rows are working state, not Packages, inventory records, or independently
managed domain aggregates. Recording a planned row intentionally creates the
Package and its Package Label.

A Package Label supports:

* Display Name
* Description
* Ingredients Summary
* Preparation Summary
* Rehydration Instructions
* Serving Notes
* Net Weight display
* Fresh Equivalent display

Package Identifier and Packaging Date are rendered from authoritative Package
and Packaging Operation records.

Package Label state is `Draft`, `Ready`, or `Needs Reprint`. Printing is not a
label state. Every print or reprint creates an append-only `PrintEvent`. Editing
a previously printed label changes its state to `Needs Reprint`; printing its
current content returns it to `Ready` while preserving every PrintEvent.

Before Milestone 8, edits replace the current Package Label content. Milestone 8
adds revision history through the Audit system. Production History is never
rewritten by a label edit.

One selection-based print engine supports one Package, one Allocation, one
Packaging Operation, one Production Batch, today's Ready labels, or a custom
selection of Package identifiers. Avery 5163 output lays out ten labels per US
Letter sheet. Package Display Name and weight are visually primary; Package
Identifier is secondary.

---

# Consequences

* Open label work survives reload and resume.
* Planned rows do not create inventory.
* Labels can be edited and printed in an operator-chosen order.
* Reprints are historical events rather than destructive state changes.
* All print scopes use one rendering path.

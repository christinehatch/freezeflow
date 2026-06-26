# ADR-0001 - Recipe History is Stored as Tray Snapshots

# Status

Accepted

---

# Context

Recipes exist to reduce repetitive data entry.

They describe reusable preparation information that may be applied when loading a Tray.

Historical production records must not change when a Recipe is edited later.

A Production Batch represents one freeze-dryer run and may contain Trays with different products or preparation methods.

This means Recipe history cannot safely live only on the Production Batch.

It also means historical Trays cannot depend on the current state of a Recipe.

---

# Decision

Recipes are optional reusable preparation templates.

When a Tray is created from a Recipe, Freezeflow copies the relevant preparation information onto the Tray.

The Tray owns the historical preparation data from that point forward.

Editing a Recipe affects future Trays only.

A Tray may also be created without a Recipe.

In that case, the user records the product and preparation information directly on the Tray.

---

# Alternatives Considered

## Store Recipe on Production Batch

Rejected.

A Production Batch may contain multiple products or preparation methods.

Storing Recipe information on the Production Batch would incorrectly imply that every Tray in the batch used the same preparation.

## Always Reference Recipe

Rejected.

Historical production records would depend on the current state of the Recipe.

Editing a Recipe later could change the apparent preparation history of existing Trays.

## Version Recipes

Rejected for V1.

Versioned Recipes would preserve history but add complexity that is not needed for the initial workflow.

Tray snapshots provide simpler historical accuracy while keeping Recipes reusable.

---

# Consequences

Production Batches may contain mixed products and mixed preparation methods.

Historical production records remain stable when Recipes are edited.

Reporting should use Tray preparation data rather than the current Recipe definition.

Recipes remain useful as templates without becoming permanent dependencies for historical records.

The Recipe relationship on a Tray is optional and exists only to show which template was used, if any.

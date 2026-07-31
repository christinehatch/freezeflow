# ADR-0013 - Preparation Metadata and Presets

# Status

Accepted

---

# Context

Freeze-drying operators describe production in terms of a Product, Ingredients, Preparation Methods, and freeform processing Notes. Requiring a saved Recipe before production adds administration and misrepresents this workflow.

Production history must remain understandable even when reusable setup data changes later.

---

# Decision

Freezeflow models the description of a Tray as structured Preparation Metadata:

- Product
- Ingredients
- Preparation Methods
- Notes

A Tray stores an immutable snapshot of the Preparation Metadata used for that production run.

A Preparation Preset is an optional reusable combination of Preparation Metadata. Selecting a preset copies its values into the Tray snapshot. Later changes to the preset never rewrite historical Tray data.

Users may enter one-off Ingredients and Preparation Methods inline without first creating catalog records. Existing values may be suggested through autocomplete, and a new value may be created in the same workflow.

---

# Consequences

- Production does not require a Preparation Preset.
- Historical Tray data remains self-contained and immutable.
- Milestone 6 becomes Preparation Presets rather than Recipe management.
- Existing Recipe-oriented persistence and API names require a documented migration path during Milestone 6 implementation.
- Preparation Presets improve data entry speed but do not become the source of historical truth.

---

# Supersedes

ADR-0001 Recipe History.

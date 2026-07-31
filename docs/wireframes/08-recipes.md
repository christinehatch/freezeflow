# 08 - Preparation Presets

The filename is retained temporarily so existing documentation links remain valid while the Recipe-first model is retired.

# Purpose

Preparation Presets reduce repetitive typing during Production.

A Preparation Preset is an optional saved combination of:

* Product
* Ingredients
* Preparation Methods
* default Notes

Production never requires a saved Preset. Users may enter one-off Preparation Metadata directly on a Tray without creating catalog or administrative records first.

---

# User Goals

A user should be able to:

* browse and search Preparation Presets
* create a Preset from useful combinations they expect to reuse
* apply a Preset during Production
* change the preloaded values for the current Tray
* archive and restore Presets
* enter a new Ingredient or Preparation Method inline without leaving Production

---

# Primary Actions

* Create Preparation Preset
* Edit Preparation Preset
* Archive Preparation Preset
* Restore Preparation Preset
* Search Preparation Presets

---

# List Layout

```text
+====================================================================================+
| Preparation Presets                                               [ + New Preset ] |
+====================================================================================+

Search  [ chicken tacos________________________________________ ]

Sliced Chicken Tacos
Product: Chicken Breast
Ingredients: Salt, Pepper, Salsa
Methods: Sliced, Cooked

[ Use Preset ] [ Edit ] [ Archive ]
```

---

# Preset Detail

Display and edit:

* Preset Name
* Product
* Ingredients
* Preparation Methods
* default Notes

Ingredients and Preparation Methods should support lightweight autocomplete from previously entered values. Typing a new value should offer an inline create action rather than requiring setup elsewhere.

---

# Production Use

Applying a Preparation Preset preloads editable Preparation Metadata for a Tray.

When the Tray is saved, Freezeflow stores an immutable snapshot on that Tray. Later Preset edits or archiving must not change historical Production.

The user may:

* apply a Preset and accept its defaults
* apply a Preset and change any field for this Tray
* enter all Preparation Metadata manually
* optionally save a useful one-off combination as a new Preset

---

# Lifecycle

Preparation Presets move between Active and Archived.

Archived Presets:

* cannot be applied to new Trays
* remain visible in historical references
* may be restored

Presets should not be permanently deleted.

---

# Empty State

```text
No Preparation Presets have been created.

Presets are optional. You can enter Product, Ingredients,
Preparation Methods, and Notes directly during Production.

[ Create Preparation Preset ]
```

---

# Success Criteria

A user should be able to:

* start Production without maintaining Presets
* reuse a successful preparation with minimal typing
* create new metadata naturally while working
* understand that Presets are conveniences, not historical records
* trust that changing a Preset does not rewrite prior Production

---

# Future Enhancements

Future versions may include:

* favorite Preparation Presets
* Preset duplication
* suggestions based on previous Production
* richer autocomplete management

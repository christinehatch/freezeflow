# 03 - Packaging

Each Package editor presents separate **Finished Product Weight** and **Sealed
Package Weight** inputs. Avery 5163 labels emphasize product name and the
fresh-to-dry equivalence, then show preparation or contents, Packaging Date,
Package identifier, Package Type, Production Batch, Freeze Dryer, and oxygen
absorber. Labels show `Fresh equivalent unavailable` when source history is
incomplete. Storage Location is not printed.

# Purpose

The Packaging screen guides the user through preparing and executing a Packaging Session.

Packaging should feel like a worksheet for the real packaging table, not a data entry form.

The user selects completed Trays, plans Package Types and package count, prints human-readable labels, records sealed weights, and creates one or more Packages.

The system automatically creates the internal Packaging Operation required for complete historical traceability.

Users should never need to understand or manage Packaging Operations directly.

---

# User Goals

A user should be able to:

* Choose the Production Batch to package without scrolling through every Batch.
* Select eligible Trays from that Production Batch.
* Review a Packaging Worksheet.
* Select or create Package Types inline.
* Print human-readable labels.
* Create one or more finished Packages.
* Record package weights.
* Select Storage Locations or use Unassigned.
* Complete packaging with minimal typing.

---

# Primary Actions

* Select Completed Trays
* Review Packaging Worksheet
* Create Packages
* Print Labels
* Select Storage Locations or Unassigned
* Finish Packaging

---

# Screen Layout

```text
+====================================================================================+
| Packaging                                                                          |
+====================================================================================+

Completed Trays

Production Batch

[ Batch 014 / Freeze Dryer Black / 32.8 oz ready v ]

[x] Tray 1   Taco Chicken      8.2 oz

[x] Tray 2   Taco Chicken      8.1 oz

[x] Tray 3   Taco Chicken      8.3 oz

[x] Tray 4   Taco Chicken      8.2 oz

------------------------------------------------------------------------------

Selected Trays

4 Trays

Total Dry Weight

32.8 oz

------------------------------------------------------------------------------

Packaging Worksheet

Batch 014 / Freeze Dryer Black

Package Count

[ 3 ]

Print Labels

[ Print Planned Labels ]

------------------------------------------------------------------------------

Packages

Package 1

Package Identifier

PKG-2026-000123

Package Type

[ 1 qt Mylar v ]

Oxygen Absorber

[ 500cc ]

Package Weight

[________]

Storage Location

[ Bin A v ]

--------------------------------------------------

Package 2

Package Identifier

PKG-2026-000124

Package Type

[ 1 qt Mylar v ]

Package Weight

[________]

Storage Location

[ Unassigned v ]

--------------------------------------------------

Package 3

Package Identifier

PKG-2026-000125

Package Type

[ 1 qt Mylar v ]

Package Weight

[________]

Storage Location

[ Bin B v ]

--------------------------------------------------

[ + Add Another Package ]

------------------------------------------------------------------------------

Weight Summary

Source Weight

32.8 oz

Package Weight Total

32.5 oz

Difference

0.3 oz

Review before saving

------------------------------------------------------------------------------

[ Finish Packaging ]

------------------------------------------------------------------------------

Packaging Complete

3 Packages created

[ Print Labels ]  [ Done ]
```

---

# Information Priority

The screen should emphasize:

1. Source Trays
2. Total available product
3. Packages being created
4. Weight validation
5. Storage assignment

The workflow should feel linear and predictable.

---

# Tray Selection

Only Completed Trays should appear.

Running Trays should never be selectable.

Completed Trays should remain visible until they have been packaged.

Once packaged, they should disappear from this screen.

For Version 1, the user first chooses one Production Batch. The workspace then
shows only the eligible Trays from that Batch.

The user may select multiple eligible Trays from the same group.

Selected Trays form one combined source pool for the Packaging Operation. This
models physically mixing several Trays before dividing the product among one or
more Packages.

The user should not be able to combine Trays from different Production Batches in one Packaging Operation.

Because a Production Batch belongs to one Freeze Dryer, this also prevents cross-freeze-dryer packaging.

---

# Package Creation

Users should be able to create any number of Packages.

Examples:

* 1 Tray -> 1 Package
* 4 Trays -> 1 Package
* 4 Trays -> 3 Packages
* 8 Trays -> 12 Packages

The interface should never assume a fixed relationship.

The interface should show the selected source weight, the Finished Product
Weight already allocated across Package rows, and the remaining Finished Product
Weight still to package. These values update as Package rows are edited.

The final action should be labeled **Finish Packaging** so it cannot be confused
with adding another Package row. While Finished Product Weight remains
unallocated, the interface should offer **Add Package for Remaining** and must not
allow the user to finish Packaging. Each weight input must keep its selected unit
visibly readable.

Sealed Package Weight remains separate and does not reduce the remaining source
pool because bags and oxygen absorbers add weight.

Each Package should have a Package Type.

Package Type should prefill sensible defaults, such as oxygen absorber size and printable label template, while allowing the user to edit Package-level values.

Package Types may be created or edited inline during Packaging.

Package identifiers should be generated automatically.

---

# Printable Labels

Printable human-readable labels are part of Milestone 4.

Labels should be available from planned Package data before physical packaging and from created Package data after Packaging is complete.

Labels should include Package identifier, product summary, Package Type,
packaging date, preparation or contents, and Package Fresh Equivalent when
available. Mutable Storage Location should not appear on permanent printed
labels.

QR codes, barcode labels, and automated label integrations are future enhancements.

---

# Storage Assignment

Every Package should have a current Storage Location during creation.

If the user does not select a Storage Location, the interface should use Unassigned.

Users should be able to change the location for individual Packages or leave individual Packages Unassigned.

---

# Weight Validation

The application should automatically compare:

Source Weight

vs

Total Package Weight

If the values differ significantly, display a warning.

Warnings should inform the user but should not block completion.

The user remains responsible for the final decision.

---

# Packaging Workflow

Typical workflow:

```text
Choose Production Batch

Select Trays

Review Packaging Worksheet

Print Labels

Create Packages

Select Storage Locations or Unassigned

Review Weight Difference

Complete Packaging
```

The user should remain on a single screen throughout the process.

---

# States

## No Completed Trays

```text
No Completed Trays are ready for Packaging.

Finish drying a Production Batch before creating Packages.
```

---

## Trays Selected

The Package editor becomes active.

---

## Validation Warning

Examples:

* Weight mismatch
* Empty Package Weight

Warnings should be easy to understand.

Missing Storage Location should resolve to Unassigned rather than block Packaging.

---

## Complete

Display confirmation.

Example:

```text
Packaging Complete

3 Packages created successfully.

[ Print Labels ]  [ Done ]
```

---

# Empty State

```text
No Trays are currently waiting for Packaging.
```

---

# Error States

If packaging fails:

* Preserve all entered Package information.
* Explain the error.
* Allow retry without re-entering data.

---

# Mobile Considerations

* One Package editor per card.
* Large numeric inputs.
* Storage Location picker optimized for touch.
* Sticky Complete Packaging button.

---

# Success Criteria

A user should be able to:

* Select completed Trays quickly.
* Create multiple Packages without confusion.
* Understand how much product is being packaged.
* Notice unexpected weight differences immediately.
* Print human-readable labels before or after physical Packaging.
* Complete packaging without understanding internal Packaging Operations.

---

# Future Enhancements

Future versions may include:

* Custom label-template design
* Direct printer integrations
* QR code generation
* Barcode support
* Suggested package sizes
* Smart Storage Location recommendations
* Bluetooth scale integration
* Packaging supply stock tracking

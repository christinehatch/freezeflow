# Milestone 4 - Packaging

# Status

Ready for implementation after documentation readiness review.

---

# Goal

Prepare and execute a Packaging Session.

Milestone 4 converts completed Trays into finished Packages while helping the user make packaging decisions, print human-readable labels, and then physically package food with minimal context switching.

---

# Objectives

Implement:

- Packaging Session workflow
- Packaging Worksheet
- eligible completed Tray selection
- same Production Batch packaging constraint
- internal Packaging Operation creation
- Package Type inline setup
- Package Type defaults for oxygen absorber and printable label template
- multi-tray packaging
- multi-package creation
- auto-generated Package identifiers
- printable human-readable labels
- sealed Package Weight entry
- warning-only source weight comparison
- selected Storage Location or implicit Unassigned Storage Location
- Package creation as active inventory
- Tray transition to Packaged
- traceability from Package back to Trays, Production Batch, and Freeze Dryer

---

# Scope

Milestone 4 begins after a Production Batch has been completed and one or more Trays are eligible for Packaging.

Milestone 4 ends when the user completes a Packaging Session and Freezeflow has created the internal Packaging Operation, Packages, Package identifiers, label data, and initial Storage Location History records.

Milestone 4 includes the setup required to package efficiently, but only where that setup is part of the Packaging workflow.

---

# Out of Scope

Do not include:

- Inventory browsing
- Inventory search
- Package movement after creation
- Package depletion
- marking Packages Given Away
- Storage Location setup screens
- Reports
- Recipe CRUD
- Corrections UI
- Audit History UI
- QR codes
- barcodes
- automated label integrations
- packaging supply stock counts
- reorder reminders

Given Away is documented as an inventory/disposition state, but the workflow for marking a Package Given Away belongs to Milestone 5.

---

# Workflow Summary

1. A completed Production Batch becomes eligible for Packaging.
2. The user opens Packaging.
3. The user selects eligible completed Trays from one Production Batch.
4. The system shows a Packaging Worksheet.
5. The user decides package count and Package Types.
6. The system suggests oxygen absorber defaults from Package Type.
7. The system supports printable human-readable labels.
8. The user physically packages the food.
9. The user records sealed Package Weights.
10. The system compares source Finished Product Weight with total sealed Package Weight.
11. Warnings are shown but do not block.
12. The user completes Packaging.
13. The system creates the internal Packaging Operation and Packages.
14. The system marks source Trays as Packaged.
15. The system assigns the selected Storage Location or implicit Unassigned Storage Location.
16. The system shows created Packages with Print Labels and Done actions.

---

# Packaging Worksheet

The Packaging Worksheet is the user-facing planning surface for a Packaging Session.

It should show:

- Production Batch
- Freeze Dryer
- selected Trays
- product names
- preparation summaries
- Finished Product Weight per Tray
- total source Finished Product Weight
- package count
- Package Type per Package
- suggested oxygen absorber
- Package identifiers
- printable labels
- selected Storage Location or Unassigned
- optional notes

The worksheet should reduce context switching between the computer and the packaging table.

---

# Package Type Setup

Package Types are part of Milestone 4.

Package Types are setup data used inline during Packaging. The user should be able to create or edit Package Types without leaving the Packaging workflow.

Package Types may provide defaults for:

- oxygen absorber
- printable label template

Package Type defaults prefill Package-level values. The user may override Package-level oxygen absorber values during Packaging.

Archived Package Types cannot be selected for new Packages.

Historical Packages preserve the Package Type selected at packaging time.

---

# Eligible Tray Selection

Only Completed Trays are eligible for Packaging.

Draft, Running, Cancelled, and Packaged Trays are not eligible.

A Packaging Operation may only include Trays from the same Production Batch.

Because a Production Batch belongs to exactly one Freeze Dryer, this also preserves same-Freeze-Dryer packaging history.

Different products within the same Production Batch may be packaged together when intentionally selected by the user.

The application should not offer cross-batch Packaging selections.

---

# Packaging Operation Behavior

Packaging Operation is an internal historical record.

Users package selected Trays; they do not manage Packaging Operations directly.

When the user completes Packaging, the server creates one Packaging Operation that:

- references one or more completed source Trays
- records `packagedAt`
- preserves optional packaging notes
- produces one or more Packages

A Tray may participate in only one Packaging Operation.

Once a Tray is included in a Packaging Operation, the entire Tray is considered consumed by that operation.

---

# Package Creation

Each Package represents one sealed inventory unit.

Each Package records:

- Package identifier
- Package Type
- sealed Package Weight
- oxygen absorber
- current Storage Location
- notes
- inventory status

Package identifiers are auto-generated by the system.

Users should rarely type Package identifiers manually.

Package identifiers must be human-readable and suitable for printed labels.

The exact identifier format may be implementation-defined unless a later document specifies it.

---

# Multi-Package Creation

One Packaging Operation may produce one or more Packages.

The workflow must support:

- one Tray to one Package
- one Tray to many Packages
- many Trays to one Package
- many Trays to many Packages

The UI should never assume a fixed relationship between selected Trays and created Packages.

---

# Multi-Tray Packaging

Multiple eligible Trays may be packaged together when they belong to the same Production Batch.

The selected Trays are treated as the source product for one Packaging Operation.

The resulting product may be divided into any number of Packages.

---

# Printable Labels

Milestone 4 includes printable human-readable labels.

Labels may be generated from planned Package data during the Packaging Worksheet step and from created Package data after Packaging is complete.

Labels should include at minimum:

- Package identifier
- product name or summary
- Package Type
- packaging date
- Package Weight if available
- Storage Location or Unassigned

QR codes, barcode labels, and automated label integrations are future enhancements.

---

# Package Identifiers

Package identifiers are generated by the server.

They should be stable, human-readable, and appropriate for printed labels.

The user should not need to invent Package identifiers during routine Packaging.

---

# Oxygen Absorber Defaults and Overrides

Package Type may provide a default oxygen absorber value.

When a Package Type is selected, the Package's oxygen absorber field may be prefilled.

The Package-level oxygen absorber value remains editable and historical.

Editing a Package Type later must not rewrite historical Package oxygen absorber values.

---

# Package Weight

Package Weight is the sealed Package Weight.

It includes:

- dried food
- bag or container
- oxygen absorber
- label if present

Package Weight is distinct from Finished Product Weight.

---

# Finished Product Weight vs Sealed Package Weight

Finished Product Weight is recorded on completed Trays and represents dried food only.

Package Weight is recorded on Packages and represents the sealed inventory unit.

Because Package Weight includes packaging materials, it may not equal Finished Product Weight.

---

# Weight Comparison Warnings

Freezeflow should compare:

- total source Finished Product Weight
- total sealed Package Weight

Unexpected differences should produce warnings.

Warnings should never block completing Packaging.

Legitimate differences may come from bag weight, oxygen absorbers, labels, crumbs, or normal measurement variation.

---

# Unassigned Storage Location Behavior

Storage Location setup is not part of Milestone 4.

The user may select an existing Storage Location during Packaging.

If no Storage Location is selected, the system uses an implicit Unassigned Storage Location.

Unassigned is a system-provided Storage Location used to avoid blocking Packaging.

Unassigned allows the user to create Packages now and organize inventory later.

Initial Storage Location History should record either the selected Storage Location or Unassigned.

---

# Package Lifecycle

Milestone 4 creates Packages as active inventory.

Packages created during Milestone 4 should start as In Storage, even when the current Storage Location is Unassigned.

Given Away and Depleted are later inventory actions.

The workflow for marking a Package Given Away or Depleted belongs to Milestone 5.

---

# Tray Packaging Lifecycle

When Packaging completes, every source Tray transitions from Completed to Packaged.

Packaged Trays cannot be selected for another Packaging Operation.

Packaged Trays remain historical production records.

---

# Historical Traceability

Every Package must be traceable to:

- Packaging Operation
- source Trays
- Production Batch
- Freeze Dryer
- Tray Slot
- Physical Tray
- Finished Product Weight
- Weight Checks
- Drying Runs
- historical preparation information
- Package Type
- packaging date
- initial Storage Location or Unassigned

---

# UI Expectations

The Packaging UI should:

- show eligible completed Trays grouped by Production Batch
- prevent cross-batch Packaging selection
- show the Packaging Worksheet after Tray selection
- allow inline Package Type creation or editing
- prefill oxygen absorber from Package Type
- support printable human-readable labels
- allow selected Storage Location or Unassigned
- show weight comparison warnings without blocking
- preserve entered Package data if saving fails
- show created Packages after completion
- provide Print Labels and Done actions after completion

The user should not see a separate Packaging Operation management screen.

---

# API Expectations

The API should expose workflow-oriented actions.

Expected API capabilities:

- list eligible Trays for Packaging
- preview Packaging Worksheet data if needed
- create or update Package Types inline
- generate printable label data
- package selected Trays into one or more Packages

The package action should:

- create the internal Packaging Operation
- generate Package identifiers
- create Packages
- mark source Trays as Packaged
- create initial Storage Location History records
- return the created Packages and label data

---

# Persistence Expectations

Persistence should support:

- Package Type default oxygen absorber
- Package Type default printable label template
- Packaging Operation `packagedAt`
- Package identifier
- Package Type reference
- Package Weight in grams
- oxygen absorber
- selected Storage Location or Unassigned
- Package status
- Storage Location History
- PackagingOperationTray association

Packages should not store an independent package date.

Packaging date comes from `PackagingOperation.packagedAt`.

---

# Validation Rules

Milestone 4 must enforce:

- at least one source Tray is required
- at least one Package is required
- every source Tray must be Completed
- source Trays must not already be Packaged
- source Trays must belong to the same Production Batch
- source Trays therefore share the same Freeze Dryer
- Package Type must exist and not be archived
- Package Weight must be numeric and positive when completing Packaging
- omitted Storage Location resolves to implicit Unassigned Storage Location
- oxygen absorber may default from Package Type but can be overridden
- Package identifiers are generated by the server
- packaging date is stored on PackagingOperation.packagedAt
- weight comparison warnings do not block Packaging

---

# Testing Expectations

Add focused tests for:

- Package Type inline setup
- archived Package Types excluded from Packaging
- Package Type oxygen absorber defaults
- Package Type label template defaults
- eligible Tray listing
- preventing Running, Draft, and Cancelled Trays from Packaging
- preventing already Packaged Trays from Packaging
- preventing cross-batch Packaging
- allowing intentionally selected different products within one Production Batch
- one Packaging Operation producing multiple Packages
- one Tray not being split across Packaging Operations
- selected Storage Location behavior
- implicit Unassigned Storage Location behavior
- initial Storage Location History creation with selected Storage Location
- initial Storage Location History creation with Unassigned
- auto-generated Package identifiers
- printable human-readable label data
- source weight vs total Package Weight warning
- weight warning does not block Packaging
- oxygen absorber override behavior
- PackagingOperation.packagedAt editability
- traceability from Package back to Trays, Production Batch, and Freeze Dryer

---

# Deliverables

Milestone 4 is delivered when the application includes:

- Packaging page
- eligible Tray selection
- Packaging Worksheet
- inline Package Type setup
- Package Type defaults
- printable human-readable labels
- package creation workflow
- internal Packaging Operation creation
- Package identifier generation
- selected Storage Location or Unassigned behavior
- initial Storage Location History
- completed Packaging success state
- backend validation
- backend tests
- frontend tests where supported by the existing setup

---

# Definition of Done

Milestone 4 is complete when:

- completed Trays can be selected for Packaging
- cross-batch Packaging is prevented
- Packaging Worksheet supports package planning
- Package Types can be managed inline during Packaging
- human-readable labels can be printed
- Packages can be created from one or more Trays
- one Packaging Operation can produce multiple Packages
- source Trays become Packaged
- created Packages are active inventory
- Packages use selected Storage Location or Unassigned
- source weight comparison warnings appear and do not block
- Package identifiers are generated automatically
- traceability is preserved from Package back to source production history
- Package depletion, Given Away, inventory search, and package movement remain deferred to Milestone 5
- tests verify the Milestone 4 business rules

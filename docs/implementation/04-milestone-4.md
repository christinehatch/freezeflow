# Milestone 4 - Packaging and Package Labels

# Status

Complete.

# Goal

Convert completed product into labeled inventory through a flexible, resumable
Packaging workspace without forcing the operator to perform physical filling,
weighing, labeling, printing, and storage tasks in one prescribed order.

# Objectives

Implement:

- one resumable Packaging Operation workspace per Production Batch
- identified Packaging Allocations within the operation
- durable selected Tray, planned Package, label, note, and progress data
- exact source Tray-to-Package traceability
- separate Finished Product Weight and Sealed Package Weight
- remaining-product protection
- Package creation with initial inventory and location history
- one editable Package Label per Package
- Ready and Needs Reprint label workflows
- append-only Print Events
- package-selection-based Avery 5163 printing
- explicit Packaging Operation completion

# Scope

Milestone 4 includes:

- starting or resuming Packaging from a completed Production Batch
- selecting completed Trays from that Production Batch
- creating separate Packaging Allocations for separate product combinations
- planning one or more Package rows without creating inventory
- recording one or more Packages from an Allocation
- creating Package Types inline
- applying and overriding Package Type defaults
- assigning a Storage Location or using Unassigned
- preparing, editing, previewing, printing, and reprinting Package Labels
- printing one Package or a selection of eligible Package Labels
- completing Packaging only after all selected product is allocated

# Out of Scope

Do not implement:

- Inventory browsing or search
- moving Packages between Storage Locations
- marking Packages Given Away or Depleted
- Package Status correction UI
- Preparation Preset CRUD
- reporting
- QR codes or barcodes
- label-edit Audit History
- correction workflows for completed Packaging Operations
- hardware or printer integration
- automatic inference of physical bag state

Those behaviors belong to later milestones.

# Workflow Summary

```text
Completed Production Batch

↓

Start or Resume Packaging

↓

Open Packaging Operation

↓

Create Packaging Allocation by selecting one or more completed Trays

↓

Plan Package rows and label defaults, or record Packages directly

↓

Record Finished Product Weight and Package details

↓

Review and edit Package Labels

↓

Print any Ready or Needs Reprint labels when useful

↓

Repeat for additional Allocations in the Production Batch

↓

Explicitly Complete Packaging Operation
```

The operator may pause and resume at any point while the Packaging Operation is
Open.

# Packaging Operation

Packaging Operation is the aggregate root for Packaging work.

- It belongs to exactly one Production Batch.
- Its lifecycle is `Open` or `Completed`.
- A Production Batch may have at most one Open Packaging Operation.
- Starting Packaging creates the Open operation when none exists.
- Returning to Packaging resumes the existing Open operation.
- The operator explicitly completes the operation.
- An Open operation may contain Allocations with no Packages.
- Package and label information may be edited while the operation is Open.
- Changes after completion use the future Corrections workflow.

The user works in a Packaging workspace and does not administer Packaging
Operations as generic CRUD records.

# Packaging Allocation

A Packaging Allocation is an identified child entity within a Packaging
Operation. It references one or more completed Trays as its product source and
connects that completed product to planned Package rows, Package Labels, and
recorded Packages.

- It has stable identity independent of its Packages.
- It is not an aggregate root.
- It cannot exist independently of its Packaging Operation.
- It references source Trays; the Production Batch continues to own them.
- It may exist before any Package is recorded.
- It may produce one or more Packages.
- Separate product combinations use separate Allocations.
- Users select Trays and package product; they do not administer Allocations
  directly.

Example:

```text
Packaging Operation

Allocation A
  Trays 1, 2, 3: Chicken
  Packages 1-12

Allocation B
  Tray 4: Strawberries
  Packages 13-15
```

# Weight Allocation

For each Allocation, derive:

- **Selected Source Weight:** sum of source Tray Final Dry Weights
- **Allocated Weight:** sum of Package Finished Product Weights
- **Remaining Weight:** Selected Source Weight minus Allocated Weight

Remaining Weight is derived and must not be independently stored or edited.

Finished Product Weight records only freeze-dried product placed into a Package
and reduces Remaining Weight. Sealed Package Weight includes the container,
absorber, label, and other packaging materials and does not reduce Remaining
Weight.

Weight comparison warnings may be shown, but a warning must not silently discard
unallocated product.

# Persistent Open Work

An Open Packaging Operation persists:

- Packaging Allocations
- selected source Trays
- planned Package rows
- draft Package Label information
- recorded Packages
- Packaging notes
- weight allocation progress

Closing the browser, navigating away, or returning later must not erase this
work. Draft work belongs to its Packaging Operation and Allocation. It does not
create a Draft Package inventory state.

# Package Creation

A Package is created when the operator intentionally records it in Freezeflow.
The application does not infer when the physical bag began to exist.

The operator may record a Package before or after filling or weighing the bag.
The workflow validates required information without prescribing the physical
order of work.

Creating a Package:

- generates its Package identifier
- links it to exactly one Packaging Allocation
- preserves exact source Tray traceability through that Allocation
- records Package Type, Finished Product Weight, Sealed Package Weight, oxygen
  absorber, Packaging Date, notes, and Storage Location
- creates one Package Label
- creates initial `In Storage` Package Status History
- creates initial Storage Location History
- uses the implicit Unassigned Storage Location when none is selected

# Planned Package Rows

A planned Package row is durable workspace data, not a Package or inventory item.
It may hold proposed Package Type, weights, label content, absorber, Storage
Location, and notes before the operator records the Package.

Recording a planned row creates the Package and removes or marks the plan as
fulfilled within the same operation transaction. Removing an unrecorded plan
does not delete Package history because no Package exists yet.

# Package Labels

Every Package owns exactly one persistent, editable Package Label.

Package Label is Package Presentation, not Production History. Initial values may
be derived from immutable source Tray information, but later edits must not
rewrite the Production Batch, Trays, Preparation Metadata, Drying Runs, or Weight
Checks.

The Package Label contains:

- Display Name
- Subtitle or Description
- Ingredients Summary
- Preparation Summary
- Freeze-Dried Product Weight
- Fresh Equivalent
- Packaging Date
- Package Identifier
- Package Type
- Oxygen Absorber
- Rehydration Instructions
- Serving Notes
- optional freeform label notes

A saved Preparation Preset is never required. Allocation-level defaults
may reduce repeated typing, with per-Package overrides.

# Label State

Package Label state is:

- `Draft`
- `Ready`
- `Needs Reprint`

`Printed` and `Reprinted` are Print Event kinds, not label states.

Editing printable content after any Print Event sets or derives `Needs Reprint`.
Before Milestone 8, edits replace current Package Label presentation data.
Milestone 8 adds correction and audit history for prior label content.

# Print Events

Printing a Ready or Needs Reprint Package Label appends a minimal Print Event.
Each event preserves at least:

- Package Label identifier
- printedAt
- print request or print batch identifier
- initial print or reprint kind

Print Events do not change Production History, Package inventory status, or
Storage Location. Detailed print auditing remains a future Audit enhancement.

# Label Printing

Use one selection-based print engine. Supported scopes are:

- one Package
- one Packaging Allocation
- one Packaging Operation
- one Production Batch
- today's Ready or Needs Reprint labels
- a custom Package selection

Printing operates on Package or Package Label identifiers, never Tray identifiers.
The preview shows the total label count before output.

Avery 5163 output uses Letter paper, two columns, five rows, and ten labels per
sheet. More than ten labels creates additional correctly paginated sheets.

Label visual hierarchy is:

1. Display Name
2. Freeze-Dried Product Weight and Fresh Equivalent
3. Ingredients or Preparation Summary
4. Packaging Date
5. Package Type and Oxygen Absorber
6. Package Identifier

The Package identifier remains visible but visually secondary.

# Package Type Setup

Package Types are setup data used inline in Packaging. The operator may create a
Package Type without leaving the workspace.

A Package Type may suggest:

- oxygen absorber
- label template

Defaults are conveniences, not hard requirements, and may be overridden per
Package.

# Storage Assignment

Storage Location setup is not part of Milestone 4. The operator may select an
existing active Storage Location or leave the Package Unassigned.

Package movement, Given Away, Depleted, and Inventory search belong to Milestone
5.

# Packaging Completion

The operator explicitly completes an Open Packaging Operation.

Completion requires:

- every Allocation has at least one recorded Package
- every recorded Package has required Package and label information
- every selected source Tray remains traceable through its Allocation
- every Allocation has zero Remaining Weight within the documented measurement
  tolerance
- no selected product is silently discarded

Completion transitions the Packaging Operation to `Completed` and its selected
source Trays to `Packaged`. It does not change Package Status from `In Storage`.

# UI Expectations

The Packaging workspace should:

- open directly for a Production Batch when launched from Production
- resume existing Open work rather than starting over
- show one active Allocation at a time while keeping operation progress visible
- make source Trays and their combined Final Dry Weight clear
- show Selected, Allocated, and Remaining Weight together
- place Add Package for Remaining near the current Package rows and disabled
  completion action
- allow multiple Package rows without repeated navigation
- make weight units visible and explicit
- separate Finished Product Weight from Sealed Package Weight
- save planned rows and label work before operation completion
- support label preview, editing, bulk selection, printing, and reprinting
- explain why completion is unavailable
- avoid exposing aggregate or persistence terminology as administrative UI
- present Stage 3 as a focused one-Bag-at-a-time entry loop
- keep the active source pool's Remaining Weight dominant while entering a Bag
- collapse saved Bags to compact summaries and keep detailed history behind
  disclosures
- ask whether another Bag remains after each successful Package recording

# API Expectations

Provide workflow-oriented APIs for:

- start or resume Packaging for a Production Batch
- load an Open Packaging Operation workspace
- create an Allocation by selecting completed Trays
- update Allocation defaults and notes
- create, update, and remove planned Package rows
- intentionally record a Package from an Allocation
- update an Open Package
- read and update a Package Label
- preview a selected set of Package Labels
- print a selected set and record Print Events
- explicitly complete the Packaging Operation

Backend validation enforces aggregate ownership, eligibility, allocation totals,
and lifecycle rules. The client must not be the only enforcement point.

# Persistence Expectations

Persist:

- Packaging Operation status and timestamps
- Packaging Allocations with stable identifiers
- Allocation-to-Tray references
- planned Package rows owned by Allocations
- Packages owned by Allocations
- Package Labels owned one-to-one by Packages
- append-only Print Events
- initial Package Status History
- initial Storage Location History

Do not persist Remaining Weight as an independent value. Do not create a Draft
Package inventory status.

# Validation Rules

- Packaging requires a completed Production Batch.
- A Production Batch may have at most one Open Packaging Operation.
- Allocation source Trays belong to the operation's Production Batch.
- Source Trays are Complete and not already fully Packaged.
- Completed product belongs to only one active Allocation at a time.
- Every Package belongs to one Allocation.
- Finished Product Weight is positive and reduces Remaining Weight.
- Sealed Package Weight is positive but does not reduce Remaining Weight.
- Over-allocation and unallocated product block operation completion.
- Weight comparison warnings do not block ordinary data entry.
- Package Label state accepts only Draft, Ready, or Needs Reprint.
- Printing requires eligible Package Label identifiers.
- Editing printed content produces Needs Reprint.
- Completed operation data is changed only through future Corrections behavior.

# Testing Expectations

Backend tests cover:

- starting and resuming one Open operation per Production Batch
- Allocation creation and stable identity
- cross-batch and duplicate active source rejection
- Allocation with zero Packages
- planned rows surviving reload
- Package recording and exact source traceability
- initial In Storage and location histories
- Selected, Allocated, and Remaining Weight derivation
- Finished Product versus Sealed Package Weight behavior
- completion rejection with remaining or overallocated product
- explicit successful completion
- Package Label creation, editing, and Needs Reprint behavior
- append-only Print Events
- selection print scopes and Avery pagination

Frontend component and Playwright tests cover:

- Production-to-Packaging handoff
- resume after navigation or reload
- multi-Allocation, multi-Tray, and multi-Package workflows
- visible units and remaining-product guidance
- durable planned Package and label data
- Package Label editing and bulk selection
- initial print and reprint flows
- explicit completion validation

Physical Avery sheet alignment remains a manual printer check.

# Deliverables

- Packaging Operation and Allocation persistence
- planned Package row persistence
- Package, Package Label, and Print Event persistence
- migrations and backend workflow APIs
- resumable Packaging workspace
- Package and label editing while Open
- selection-based Avery 5163 preview and printing
- Production Batch Packaging handoff
- backend, frontend, and browser regression coverage
- updated architecture and user documentation

# Definition of Done

Milestone 4 is complete when:

- Packaging work can be started, paused, resumed, and explicitly completed
- separate product combinations can be represented by separate Allocations
- selected product cannot disappear through partial Package recording
- Packages preserve exact source Tray traceability
- Package creation initializes inventory and location history
- Package Labels are editable without rewriting Production History
- printed labels can become Needs Reprint and retain Print Events
- one print engine supports Package, Allocation, Operation, Batch, today, and
  custom scopes
- Avery 5163 output paginates at ten labels per Letter sheet
- the UI supports flexible physical work order
- automated Milestone 4 tests pass
- physical printer alignment has been manually checked
- no Milestone 5 Inventory actions were introduced

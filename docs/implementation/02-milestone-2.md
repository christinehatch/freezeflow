# 02 - Milestone 2 - Production Workflow

# Goal

Implement the first user-facing production workflow.

This milestone introduces the ability to create and manage Production Batches and Trays.

At the completion of this milestone, users should be able to organize a freeze-drying session from preparation through loading trays.

Weight tracking, tray completion, and packaging are intentionally deferred to later milestones.

---

# Objectives

Implement:

- Freeze Dryer management
- Tray Slot setup
- Physical Tray setup
- Production Batch creation
- Production Batch details
- Start Production
- Cancel Production Batch
- Tray creation
- Tray management
- Production Dashboard
- Production navigation
- Production API endpoints

Do not implement Weight Checks or Packaging.

---

# Freeze Dryers

Implement the ability to:

- Create Freeze Dryers
- Edit Freeze Dryers
- Archive Freeze Dryers
- View Freeze Dryers
- Configure Tray Slots
- Configure reusable Physical Trays used in production

Each Production Batch must belong to exactly one Freeze Dryer.

A Freeze Dryer may have at most one Running Production Batch at a time.

A Freeze Dryer has a configured Tray Slot count.

The configured Tray Slot count is an attribute of the Freeze Dryer.

Physical Trays are reusable equipment and do not belong permanently to one Freeze Dryer.

---

# Production Batches

Implement:

- Create Draft Production Batch
- View Production Batch
- Edit Draft Production Batch
- Start Production
- Cancel Production Batch
- List Production Batches

A Draft Production Batch may temporarily contain zero Trays while it is being assembled.

A Production Batch must contain at least one Tray before it can transition to the Running state.

When creating a Draft Production Batch, the system should suggest the next Batch Number.

The suggested Batch Number should be visible and editable before the Draft is saved.

Production Batch setup should show the Freeze Dryer's configured Tray Slots.

The user may select which Physical Trays are used in those slots.

The number of selected Trays in a Production Batch cannot exceed the Freeze Dryer's configured Tray Slot count.

Once a Production Batch has entered the Running state, production setup is complete and editing is limited according to the documented business rules.

Lifecycle behavior must follow ADR-0004.

---

# Start Production

When the user starts a Production Batch:

- The Production Batch transitions from Draft to Running.
- `startedAt` is set to the current timestamp.
- Every Draft Tray in the Batch transitions to Running.
- Draft Trays may no longer be added, edited, or removed.
- The assigned Freeze Dryer now has an active Running Production Batch.

Validation must enforce:

- The Production Batch is in Draft.
- The Production Batch contains at least one Tray.
- The assigned Freeze Dryer does not already have a Running Production Batch.
- The assigned Freeze Dryer is not archived.

Starting Weight is not recorded during Start Production.

Starting Weight belongs to Milestone 3.

---

Users should be able to:

- Select a Freeze Dryer
- Enter Batch notes
- View current Batch status

Lifecycle behavior should follow ADR-0004.

---

# Freeze Dryer Slots and Trays

Implement:

- View Freeze Dryer Slots in the Draft Production Batch
- Select Physical Tray for a Slot
- Add product information for a selected Slot
- Edit Draft Slot/Tray setup
- Clear or remove Draft Slot/Tray setup
- View Tray Details

Each Tray should support:

- Tray Slot
- Physical Tray
- Product Name
- Optional Recipe
- Preparation
- Notes

Recipe snapshot behavior must follow ADR-0001.

Weight information is intentionally excluded from this milestone.

Starting Weight is deferred to Milestone 3.

Only Draft Trays may be edited or removed.

Once the parent Production Batch has entered the Running state, Tray setup is considered complete.

Weight tracking and Tray completion belong to later milestones.

---

# Dashboard

Implement the Production Dashboard.

The Dashboard should display:

- Freeze Dryers
- Active Production Batches
- Recent Production Batches
- Production status

Recent Production Batches should follow deterministic rules:

- Batches with `startedAt` are shown first and sorted by `startedAt` descending.
- Batches without `startedAt` are shown after started batches and sorted by `batchNumber` descending.
- Include Draft, Running, Completed, and Cancelled batches.
- Limit to a fixed number of entries (recommended: 10).
- Never duplicate batches already shown as the active batch on a Freeze Dryer card.

The Dashboard should act as the primary entry point into production.

---

# Navigation

Implement navigation for:

- Dashboard
- Production Batch
- Tray Details
- Freeze Dryers

Navigation should follow the documented wireframes.

---

# API

Implement endpoints required for:

- Freeze Dryer CRUD
- Production Batch CRUD
- Tray CRUD

Endpoints should follow the API Design document.

Business validation should remain minimal.

---

# Validation

Implement structural validation only.

Examples:

- Required fields
- Duplicate Tray Slot selections within a Batch
- Duplicate Physical Tray selections within a Batch
- Selected Tray count exceeding the Freeze Dryer's configured Tray Slot count
- Missing Freeze Dryer

Business rules related to drying progress belong to later milestones.

---

# Testing

Create tests for:

- Production Batch creation
- Tray creation
- Freeze Dryer management
- Repository operations
- API endpoints

Weight-related tests are deferred.

---

# Out of Scope

This milestone does not implement:

- Weight Checks
- Starting Weight
- Finished Product Weight
- Tray Completion
- Batch Completion
- Packaging
- Inventory
- Reports
- Recipe management

Production setup ends when the user starts the Production Batch.

All functionality related to drying progress begins in Milestone 3.

---

# Deliverables

At the completion of Milestone 2:

- Users can manage Freeze Dryers.
- Users can configure Freeze Dryer Tray Slot count.
- Users can configure reusable Physical Trays.
- Users can create Production Batches.
- Users can select Physical Trays for Freeze Dryer Slots in a Draft Production Batch.
- Users can add and edit Product, Recipe, Preparation, and Notes for selected Slots.
- The Dashboard displays production information.
- Production navigation is functional.
- Production data persists correctly.

Users cannot yet track drying progress.

---

# Completion Checklist

- [x] Freeze Dryer management implemented
- [x] Production Batch CRUD implemented
- [x] Tray CRUD implemented
- [x] Dashboard implemented
- [x] Navigation implemented
- [x] API endpoints implemented
- [x] Tests passing
- [x] Linting passing
- [x] Formatting passing
- [x] Documentation updated if necessary

Milestone 2 is complete when users can successfully organize a production run from creating a Production Batch through loading and managing Trays, without implementing drying or packaging functionality.

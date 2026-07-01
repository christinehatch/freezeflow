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
- Production Batch creation
- Production Batch details
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

Each Production Batch must belong to exactly one Freeze Dryer.

---

# Production Batches

Implement:

- Create Production Batch
- View Production Batch
- Edit Draft Production Batch
- Cancel Production Batch
- List Production Batches

Users should be able to:

- Select a Freeze Dryer
- Enter Batch notes
- View current Batch status

Lifecycle behavior should follow ADR-0004.

---

# Trays

Implement:

- Add Tray
- Edit Tray
- Remove Draft Tray
- View Tray Details

Each Tray should support:

- Tray Number
- Product Name
- Optional Recipe
- Preparation
- Notes

Recipe snapshot behavior must follow ADR-0001.

Weight information is intentionally excluded from this milestone.

---

# Dashboard

Implement the Production Dashboard.

The Dashboard should display:

- Freeze Dryers
- Active Production Batches
- Recent Production Batches
- Production status

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
- Duplicate Tray numbers within a Batch
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
- Final Dry Weight
- Tray Completion
- Packaging
- Inventory
- Reports
- Recipe management

These features belong to future milestones.

---

# Deliverables

At the completion of Milestone 2:

- Users can manage Freeze Dryers.
- Users can create Production Batches.
- Users can add and edit Trays.
- The Dashboard displays production information.
- Production navigation is functional.
- Production data persists correctly.

Users cannot yet track drying progress.

---

# Completion Checklist

- [ ] Freeze Dryer management implemented
- [ ] Production Batch CRUD implemented
- [ ] Tray CRUD implemented
- [ ] Dashboard implemented
- [ ] Navigation implemented
- [ ] API endpoints implemented
- [ ] Tests passing
- [ ] Linting passing
- [ ] Formatting passing
- [ ] Documentation updated if necessary

Milestone 2 is complete when users can successfully organize a production run from creating a Production Batch through loading and managing Trays, without implementing drying or packaging functionality.

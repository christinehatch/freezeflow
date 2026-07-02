# 03 - Milestone 3 - Weight Tracking

# Goal

Manage the active drying process after a Production Batch has entered the Running state.

Milestone 3 begins when Production has started and ends when every Tray has been explicitly marked Complete.

At the completion of this milestone, users should be able to record Starting Weights, record Weight Checks, review drying history, complete individual Trays, and complete a Production Batch when all Trays have finished drying.

Packaging remains deferred to Milestone 4.

---

# Objectives

Implement:

- Starting Weight entry
- Starting Weight stored as structured weight data, not Notes
- Weight Check recording
- Historical Weight Check timeline
- Latest Weight display
- Weight trends
- Final Dry Weight
- Manual Tray completion
- Tray completion validation
- Production Batch completion when every Tray is complete
- Fresh-to-dry yield foundations

---

# Scope

Milestone 3 adds drying-progress behavior to the Production Batch and Tray workflows created in Milestone 2.

This milestone should support:

- Recording the Starting Weight for each Running Tray.
- Recording repeated Weight Checks for each Running Tray.
- Viewing Weight Checks in chronological order.
- Comparing the latest Weight Check with previous Weight Checks.
- Showing current Tray drying status.
- Marking Trays Complete when the user decides drying is finished.
- Recording Final Dry Weight when a Tray is completed.
- Completing the Production Batch when every Tray has completed.

Milestone 3 should keep the user in the Production Batch workspace for routine weight entry.

Tray Details should remain available for reviewing the complete history of a single Tray.

---

# Out of Scope

Do not implement:

- Packaging
- Packaging Operations
- Package creation
- Package Types
- Inventory
- Storage Locations
- Reports
- Recipe CRUD
- Corrections UI
- Audit History UI
- Physical Tray tare-weight calculations
- Physical Tray calibration
- Automatic Tray completion
- User-initiated Batch completion

The application may suggest that a Tray appears dry or stable, but the user must explicitly mark the Tray Complete.

Production Batch completion is a system transition that occurs only after every Tray has been explicitly marked Complete.

---

# Workflow Summary

The Milestone 3 workflow begins after the user starts a Production Batch.

```text
Running Production Batch
        ↓
Enter Starting Weights
        ↓
Record Weight Checks
        ↓
Review latest weights and trends
        ↓
Mark individual Trays Complete
        ↓
Production Batch completes when all Trays are Complete
```

The workflow should feel like a smart production notebook:

- fast
- low-friction
- tolerant of imperfect information
- structured where structure improves traceability
- supportive of freeform production notes

Users should not need to leave the Production Batch workspace to record routine weights.

---

# Starting Weight

Each Tray records one Starting Weight.

Starting Weight is the weight of the prepared food placed on a Tray before freeze drying begins.

Starting Weight represents food weight only.

It does not include:

- Physical Tray weight
- Packaging materials
- Containers

Starting Weight must be recorded as structured weight data.

Users should not need to put Starting Weight in Notes.

Implementation must respect the persistence documentation:

- Tray stores `startingWeightGrams`.
- Weight Checks remain append-only observations during drying.
- Starting Weight may be shown together with Weight Check history for review, but it should not erase or replace Weight Check records.

Starting Weight entry should be optimized for the running Production Batch workflow.

Users should be able to enter Starting Weights for all selected Freeze Dryer Slots in one screen.

---

# Weight Checks

A Weight Check represents one recorded weight observation for a Tray during drying.

Each Weight Check records:

- Tray
- weight
- observedAt
- recordedAt
- optional notes

Weight Checks belong to Trays, not directly to Production Batches.

Weight Checks are append-only historical observations.

Existing Weight Checks must not be overwritten during normal workflow.

Corrections are governed by ADR-0005 and belong to the correction model, not the routine Milestone 3 data-entry workflow.

---

# Weight History

Each Tray should display its Weight Checks chronologically.

Weight history should include:

- Starting Weight
- each Weight Check
- Final Dry Weight after completion
- optional notes attached to observations

The Tray Details screen is the authoritative historical view for a single Tray.

The Production Batch screen should show enough recent history to support fast production work without forcing navigation.

---

# Weight Trends

Milestone 3 should provide basic trend feedback derived from recorded weights.

Examples:

- previous weight
- latest weight
- weight difference
- unchanged weight indicator
- increased weight warning

Weight trends are derived values.

They should not be stored independently.

The application may indicate that a Tray appears stable, but it must not automatically complete the Tray.

The user remains responsible for deciding when food is dry.

---

# Latest Weight Display

Running Trays should clearly show their latest known weight.

The latest known weight should be derived from:

- the most recent Weight Check, if one exists
- otherwise the Starting Weight, if no Weight Check has been recorded

The interface should make the difference between Starting Weight and later Weight Checks clear.

---

# Final Dry Weight

Each Tray records one Final Dry Weight.

Final Dry Weight is the last dry food weight recorded before the Tray is marked Complete.

Final Dry Weight represents food weight only.

It does not include:

- Mylar bags
- oxygen absorbers
- labels
- storage containers

When a user marks a Tray Complete, the application must record Final Dry Weight.

Final Dry Weight may be copied from the latest Weight Check when appropriate, but the user should understand and confirm the value used to complete the Tray.

---

# Tray Completion

Completing a Tray is a user decision.

The application may suggest completion when weight appears stable, but it must not complete the Tray automatically.

When a Tray is completed:

- Final Dry Weight is recorded.
- `completedAt` is recorded.
- Tray status becomes Completed.
- additional Weight Checks are no longer allowed.

Completed Trays remain historical production records.

Completed Trays become eligible for Packaging in Milestone 4.

---

# Production Batch Completion

A Production Batch completes only when every Tray in the Production Batch has completed.

Users should not manually mark a Production Batch Complete.

When the last Tray is completed:

- Production Batch status becomes Completed.
- `completedAt` is recorded.
- the Production Batch becomes a historical production record.

Completed Production Batches remain available for Packaging, Reporting, and historical review.

Packaging itself belongs to Milestone 4.

---

# Yield Foundations

Fresh-to-dry yield compares Starting Weight to Final Dry Weight for a Tray.

Milestone 3 records the structured data required to calculate yield:

- Starting Weight
- Final Dry Weight

Yield is a derived production metric.

Yield should not be stored independently.

Historical yield reporting belongs to Milestone 7.

Milestone 3 may show simple tray-level weight loss or yield feedback when useful, but long-term analysis belongs to Reporting.

---

# UI Expectations

The Production Batch workspace should support fast, repeated weight entry.

It should show:

- Freeze Dryer
- Production Batch status
- Freeze Dryer Slots used in the Batch
- Physical Tray selected for each slot
- Product and preparation summary
- Starting Weight
- latest weight
- new Weight Check input
- weight difference or stability feedback
- Tray status
- Mark Tray Complete action

The interface should support the real-world sequence:

```text
Weigh Tray 1
Enter Weight
Weigh Tray 2
Enter Weight
Repeat
```

When a Weight Check is saved:

- the value should be recorded immediately
- the latest weight display should update
- the weight difference should update
- focus should advance to the next editable Tray when practical

The user should not need to open Tray Details for routine weight entry.

Tray Details should show:

- Weight Check history
- Starting Weight
- Final Dry Weight
- preparation information
- notes
- completion information

Notes remain available for observations that are not structured weight values.

---

# API Expectations

Implement API behavior required for the Weight Tracking workflow.

Expected actions include:

- record Starting Weight for a Tray
- record Weight Check for a Tray
- list Weight Checks for a Tray
- complete Tray with Final Dry Weight
- return updated Production Batch status after Tray completion

Endpoints should be workflow-oriented and consistent with the API Design document.

Weight Check creation should append a new historical observation.

Tray completion should be an explicit user action.

Production Batch completion should occur when all Trays are Complete.

---

# Persistence Expectations

Implementation must follow the persistence documentation.

Required persisted information includes:

- `Tray.startingWeightGrams`
- `Tray.finalDryWeightGrams`
- `Tray.completedAt`
- `Tray.status`
- Weight Check records
- `ProductionBatch.completedAt`
- `ProductionBatch.status`

Weight values are stored in grams.

Display units are presentation concerns only.

Weight Checks are append-only historical observations.

Calculated values such as weight difference, weight loss, and yield should be derived from persisted values.

Do not store derived metrics independently unless future documentation explicitly adds that requirement.

---

# Validation Rules

Implement validation for:

- Starting Weight is numeric when provided.
- Starting Weight represents food weight only.
- Weight Check value is numeric.
- Weight Check belongs to a Running Tray.
- Weight Check records `observedAt` and `recordedAt`.
- Weight Checks cannot be added after the Tray is Completed.
- Weight Checks cannot be added to Draft, Packaged, or Cancelled Trays.
- Final Dry Weight is required when completing a Tray.
- Final Dry Weight is numeric.
- Tray completion requires explicit user action.
- Production Batch cannot complete before every Tray is Complete.

The application may warn about suspicious values, such as a large weight increase, but warnings should preserve user judgment unless a documented business rule is violated.

---

# Testing Expectations

Create tests for:

- Starting Weight entry
- Weight Check creation
- Weight Check chronological ordering
- Weight Check history retrieval
- latest weight display behavior
- weight difference calculations
- preventing Weight Checks after Tray completion
- completing a Tray with Final Dry Weight
- completing a Production Batch when all Trays are Complete
- preserving historical Weight Checks
- rejecting invalid lifecycle transitions

Tests should verify business rules rather than implementation details.

Regression tests should protect traceability and append-only Weight Check behavior.

---

# Deliverables

At the completion of Milestone 3:

- Users can enter Starting Weights in structured fields.
- Users can record Weight Checks for Running Trays.
- Users can review Weight Check history.
- Users can see latest weights and basic weight trends.
- Users can manually mark Trays Complete.
- Final Dry Weight is recorded for completed Trays.
- A Production Batch becomes Completed when every Tray is Complete.
- Fresh-to-dry yield foundations are available for later Reporting.
- Weight data is preserved as historical production information.

---

# Definition of Done

Milestone 3 is complete when:

- Starting Weight workflow is implemented.
- Weight Check workflow is implemented.
- Weight history is visible.
- Tray completion is implemented.
- Production Batch completion is implemented.
- Packaging remains unavailable until Milestone 4.
- Inventory remains unavailable until Milestone 6.
- Reporting remains unavailable until Milestone 7.
- Backend tests pass.
- Frontend tests pass.
- Linting passes.
- Formatting passes.
- Documentation remains consistent with the architecture, business rules, persistence docs, ADRs, and wireframes.

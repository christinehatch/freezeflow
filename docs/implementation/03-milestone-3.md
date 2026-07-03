# 03 - Milestone 3 - Weight Tracking

# Goal

Manage the active drying process after a Production Batch has entered the Running state.

Milestone 3 begins when the user records Starting Weights before Production starts and ends when the user explicitly completes the Production Batch after every Tray has been marked Complete.

At the completion of this milestone, users should be able to record Starting Weights, record Weight Checks, review drying history, complete individual Trays, and complete a Production Batch when all Trays have finished drying.

Packaging remains deferred to Milestone 4.

---

# Objectives

Implement:

- Starting Weight entry
- Starting Weight stored as structured weight data, not Notes
- Drying Run tracking
- Current Run Complete workflow
- Drying Run start and end timestamps
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
- Tracking each Drying Run within a Running Production Batch.
- Recording when each Drying Run starts and ends.
- Ending the current Drying Run before recording the next set of Tray weights.
- Recording repeated Weight Checks for each Running Tray.
- Viewing Weight Checks in chronological order.
- Comparing the latest Weight Check with previous Weight Checks.
- Showing current Tray drying status.
- Marking Trays Complete when the user decides drying is finished.
- Starting another Drying Run when one or more Trays still need more drying.
- Recording Final Dry Weight when a Tray is completed.
- Completing the Production Batch through explicit user confirmation after every Tray has completed.

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

The application may suggest that a Tray appears dry or stable, but the user must explicitly mark the Tray Complete.

Production Batch completion is a user-confirmed transition that is available only after every Tray has been explicitly marked Complete.

---

# Workflow Summary

The Milestone 3 workflow begins while the Production Batch is still Draft, when the user records Starting Weights before starting production.

```text
Enter Starting Weights
        ↓
Start Production Batch
        ↓
First Drying Run starts automatically
        ↓
Current Run Complete
        ↓
Record Weight Checks for Trays
        ↓
Review latest weights and trends
        ↓
Mark individual Trays Complete or run again
        ↓
Repeat Drying Runs until all Trays are Complete
        ↓
Ready to Complete Batch
        ↓
User selects Complete Batch
```

The workflow should feel like a smart production notebook:

- fast
- low-friction
- tolerant of imperfect information
- structured where structure improves traceability
- supportive of freeform production notes

Users should not need to leave the Production Batch workspace to record routine weights.

---

# Drying Runs

A Drying Run represents one freeze dryer timer interval within a Running Production Batch.

A Drying Run is not the same thing as a Production Batch.

A Drying Run is not the same thing as Tray completion.

For example:

```text
Production Batch
        ↓
Drying Run 1
        ↓
Current Run Complete
        ↓
Record Tray weights
        ↓
Drying Run 2, if needed
```

Each Drying Run should record:

- Production Batch
- status
- startedAt
- endedAt
- optional notes

Starting a Production Batch automatically creates the first Drying Run.

The user-facing action for ending a Drying Run should be:

```text
Current Run Complete
```

When the user marks the current run complete:

- the Drying Run records `endedAt`
- the application prompts the user to weigh the Trays
- Weight Checks can be recorded for Running Trays
- the user may mark one or more Trays Complete
- if any Trays remain Running, the user may start another Drying Run
- if every Tray is Complete, the Production Batch becomes ready for user-confirmed completion

Ending a Drying Run does not complete the Production Batch.

Ending a Drying Run does not automatically complete any Tray.

Drying Run duration should be derived from `startedAt` and `endedAt`.

Total drying time for a Production Batch should be derived from non-voided Drying Runs.

Total drying time should not be derived from Production Batch wall-clock duration.

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

Every Tray must have a Starting Weight before the Production Batch can start.

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
- Drying Run
- weight
- observedAt
- recordedAt
- optional notes

Weight Checks belong to Trays, not directly to Production Batches.

Weight Checks should reference the Drying Run that prompted the weighing workflow.

This allows Freezeflow to preserve which machine cycle produced each set of observations while keeping Tray weight history centered on the Tray.

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

When every Tray is Complete, the Production Batch becomes ready to complete.

The user must explicitly choose Complete Batch.

When the Batch is completed:

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
- current Drying Run status
- Current Run Complete action while a Drying Run is active
- start another Drying Run action when Trays remain Running
- Complete Batch action when every Tray is Complete
- new Weight Check input
- weight difference or stability feedback
- Tray status
- Mark Tray Complete action

The interface should support the real-world sequence:

```text
Freeze dryer cycle finishes
Current Run Complete
Weigh Tray 1
Enter Weight
Weigh Tray 2
Enter Weight
Repeat
Mark completed Trays, if any
Run again if needed
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

- Start Production Batch, which creates the first Drying Run
- start another Drying Run for a Running Production Batch
- mark Current Run Complete for the active Drying Run
- list Drying Runs for a Production Batch
- record Starting Weight for a Tray
- record Weight Check for a Tray
- list Weight Checks for a Tray
- complete Tray with Final Dry Weight
- complete Production Batch after every Tray is Complete

Endpoints should be workflow-oriented and consistent with the API Design document.

Weight Check creation should append a new historical observation.

Drying Run completion should record an end timestamp and preserve the run as historical production context.

Tray completion should be an explicit user action.

Production Batch completion should be an explicit user action after all Trays are Complete.

---

# Persistence Expectations

Implementation must follow the persistence documentation.

Required persisted information includes:

- Drying Run records
- `DryingRun.productionBatchId`
- `DryingRun.status`
- `DryingRun.startedAt`
- `DryingRun.endedAt`
- `DryingRun.notes`
- `Tray.startingWeightGrams`
- `Tray.finalDryWeightGrams`
- `Tray.completedAt`
- `Tray.status`
- Weight Check records
- Weight Check to Drying Run relationship
- `ProductionBatch.completedAt`
- `ProductionBatch.status`

Weight values are stored in grams.

Display units are presentation concerns only.

Weight Checks are append-only historical observations.

Drying Runs are historical production context and should not be deleted during normal workflow.

Calculated values such as weight difference, weight loss, and yield should be derived from persisted values.

Do not store derived metrics independently unless future documentation explicitly adds that requirement.

---

# Validation Rules

Implement validation for:

- A Drying Run belongs to a Running Production Batch.
- Only one active Drying Run may exist for a Production Batch at a time.
- A Drying Run must have `startedAt`.
- A Drying Run records `endedAt` when the user selects Current Run Complete.
- A completed Drying Run cannot be completed again.
- Starting Weight is required before Production starts.
- Starting Weight is numeric when provided.
- Starting Weight represents food weight only.
- Weight Check value is numeric.
- Weight Check belongs to a Running Tray.
- Weight Check is associated with the completed Drying Run that prompted entry.
- Every Running Tray must have a Weight Check for the completed Drying Run before another Drying Run starts.
- Weight Check records `observedAt` and `recordedAt`.
- Weight Checks cannot be added after the Tray is Completed.
- Weight Checks cannot be added to Draft, Packaged, or Cancelled Trays.
- Final Dry Weight is required when completing a Tray.
- Final Dry Weight is numeric.
- Tray completion requires explicit user action.
- Production Batch cannot complete before every Tray is Complete.
- Production Batch completion requires explicit user action.

The application may warn about suspicious values, such as a large weight increase, but warnings should preserve user judgment unless a documented business rule is violated.

---

# Testing Expectations

Create tests for:

- Drying Run start
- Current Run Complete records `endedAt`
- preventing multiple active Drying Runs for one Production Batch
- preserving Drying Run history
- voiding a mistaken Drying Run
- preserving Voided Drying Runs as history
- excluding Voided Drying Runs from total drying time
- Starting Weight entry
- Weight Check creation
- Weight Check association with a Drying Run
- Weight Check chronological ordering
- Weight Check history retrieval
- latest weight display behavior
- weight difference calculations
- preventing Weight Checks after Tray completion
- completing a Tray with Final Dry Weight
- completing a Production Batch by explicit user action when all Trays are Complete
- preserving historical Weight Checks
- rejecting invalid lifecycle transitions

Tests should verify business rules rather than implementation details.

Regression tests should protect traceability and append-only Weight Check behavior.

---

# Deliverables

At the completion of Milestone 3:

- Users can enter Starting Weights in structured fields.
- Starting Production automatically creates the first Drying Run.
- Users can start another Drying Run for a Running Production Batch.
- Users can mark the Current Run Complete when the freeze dryer cycle ends.
- Users can record Tray weights after a Drying Run completes.
- Users can start another Drying Run if any Trays still need more drying.
- Users can record Weight Checks for Running Trays.
- Users can review Weight Check history.
- Users can see latest weights and basic weight trends.
- Users can manually mark Trays Complete.
- Final Dry Weight is recorded for completed Trays.
- A Production Batch becomes ready to complete when every Tray is Complete.
- A Production Batch becomes Completed only when the user explicitly chooses Complete Batch.
- Fresh-to-dry yield foundations are available for later Reporting.
- Drying Run duration and total drying time foundations are available for later Reporting.
- Weight data is preserved as historical production information.

---

# Definition of Done

Milestone 3 is complete when:

- Starting Weight workflow is implemented.
- Drying Run workflow is implemented.
- Current Run Complete workflow is implemented.
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

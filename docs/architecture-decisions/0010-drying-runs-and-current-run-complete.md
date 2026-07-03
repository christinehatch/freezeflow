# ADR-0010 - Drying Runs and Current Run Complete

# Status

Accepted

---

# Context

Milestone 3 introduces active drying management.

Earlier documentation treated Weight Checks as the primary drying observations and left explicit Drying Run records as a future possibility.

User workflow has clarified that a Production Batch may require more than one freeze dryer cycle before every Tray is dry.

Example:

* Run 1 finishes.
* The user weighs every Running Tray.
* Some Trays are complete.
* Remaining Trays need another cycle.
* Run 2 begins for the remaining Running Trays.

Weight Checks alone record tray measurements, but they do not clearly preserve the machine-cycle context that caused those measurements.

Freezeflow needs to distinguish:

* the overall Production Batch
* each freeze dryer cycle inside that Batch
* each Tray's weight observation after a cycle
* the user's decision to complete a Tray

---

# Decision

Freezeflow will model **Drying Run** as a first-class Milestone 3 production-history record.

A Drying Run represents one freeze dryer cycle or timer interval within a Running Production Batch.

A Production Batch may have one or more Drying Runs.

Starting a Production Batch automatically creates the first Drying Run.

The user-facing action for ending the active Drying Run is:

```text
Current Run Complete
```

Current Run Complete means the freeze dryer cycle has ended and the user is ready to inspect and weigh Trays.

Current Run Complete does not mean:

* any Tray is complete
* the Production Batch is complete
* the user has finished entering Weight Checks

---

# Entity Responsibilities

## Production Batch

A Production Batch is the overall production session for one Freeze Dryer load.

It groups the Trays loaded into the Freeze Dryer and organizes the full drying workflow.

## Drying Run

A Drying Run is one machine-cycle interval within a Production Batch.

It records:

* Production Batch
* status
* startedAt
* endedAt
* optional notes

Drying Runs preserve machine runtime history.

## Tray

A Tray remains the historical production record for one selected Physical Tray in one Freeze Dryer Tray Slot.

Trays progress independently.

Some Trays may complete after an earlier Drying Run while others continue into later Drying Runs.

## Weight Check

A Weight Check is one Tray weight observation recorded after a Drying Run has ended.

Every Weight Check belongs to:

* exactly one Tray
* exactly one Drying Run

Weight Checks remain the drying observations.

Drying Runs provide the machine-cycle context for those observations.

---

# Workflow Rules

Before a Production Batch can start:

* the Batch must contain at least one Tray
* every Tray must have a Starting Weight

When a Production Batch starts:

* the Batch transitions to Running
* every Draft Tray transitions to Running
* `ProductionBatch.startedAt` is recorded
* the first Drying Run is created automatically
* the first Drying Run records `startedAt`

While a Drying Run is active:

* Running Trays are considered inside the active machine cycle
* Weight Checks are not recorded
* Trays are not automatically completed

When the user selects Current Run Complete:

* the active Drying Run records `endedAt`
* the Drying Run becomes complete
* the user may record Weight Checks for Running Trays

Before another Drying Run can start:

* every Running Tray must have a Weight Check for the completed Drying Run
* Completed Trays are excluded from later Weight Check requirements

After Weight Checks are recorded:

* the user may mark some Trays Complete
* remaining Running Trays may continue into another Drying Run
* if all Trays are Complete, the Batch becomes ready for user-confirmed completion

A Production Batch does not complete automatically.

The user must explicitly choose Complete Batch.

---

# Timestamp Semantics

`DryingRun.startedAt` represents the actual time the freeze dryer cycle started.

`DryingRun.endedAt` represents the actual time the freeze dryer cycle ended.

These are production times, not merely button-click times.

Users may correct Drying Run timestamps if they forgot to log the cycle at the exact time.

Corrections to Drying Run timestamps follow ADR-0005.

`WeightCheck.observedAt` represents the time the Tray was weighed.

`WeightCheck.recordedAt` represents the time the Weight Check was entered into Freezeflow.

---

# Historical Behavior

Drying Runs are historical production records.

Drying Runs are not deleted during normal workflow.

If a Drying Run was started by mistake, it may be marked Voided with notes.

Voided Drying Runs remain part of history but are excluded from derived drying-time calculations.

Weight Checks are append-only observations associated with non-voided Drying Runs.

---

# Derived Drying Time

Total drying time should be derived from the sum of non-voided Drying Run durations.

Drying time should not be derived from Production Batch wall-clock duration because wall time may include:

* overnight delays
* user availability delays
* waiting before weighing
* pauses between cycles

Drying Run duration is derived from `startedAt` and `endedAt`.

Fresh-to-dry yield remains derived from Starting Weight and Final Dry Weight.

---

# Alternatives Considered

## Use Weight Checks Only

Rejected.

Weight Checks record Tray observations but do not preserve the machine-cycle interval that prompted them.

This would make drying-time reporting depend on inference.

## Require the User to Start the First Drying Run Separately

Rejected.

From the operator's perspective, loading Trays, starting production, and starting the freeze dryer are one continuous action.

Requiring a second Start Drying Run action would add friction without improving traceability.

## Automatically Complete the Batch When All Trays Complete

Rejected.

Freezeflow should automate calculations, not operator judgment.

When all Trays are complete, the Batch is ready to complete, but the user confirms Complete Batch.

---

# Consequences

Milestone 3 implementation must include Drying Run persistence, API behavior, and UI states.

Production Batch completion becomes a user-confirmed workflow action.

Reports can calculate actual machine runtime from Drying Runs without confusing it with wall-clock elapsed time.

The Production Batch workspace should guide the operator through:

```text
Start Production
Current Run Complete
Record Weight Checks
Complete Trays or Start Another Drying Run
Complete Batch
```

This preserves the Smart Notebook philosophy while giving the system enough structure to avoid manual drying-time math.

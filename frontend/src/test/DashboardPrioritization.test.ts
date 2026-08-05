import { describe, expect, it } from "vitest";

import type {
  DryingRun,
  FreezeDryer,
  ProductionBatch,
  Tray,
  WeightCheck,
} from "../api/client";
import { selectDashboardHeroBatch } from "../pages/dashboardPrioritization";

const freezeDryer: FreezeDryer = {
  id: "freeze-dryer-1",
  name: "Black",
  notes: null,
  archived: false,
  tray_slot_count: 4,
  tray_slots: [],
};

describe("selectDashboardHeroBatch", () => {
  it("selects immediate action over review", () => {
    const review = createReviewBatch("review", "2026-07-22T11:00:00.000Z");
    const immediate = createReadyBatch("immediate", "2026-07-22T12:00:00.000Z");

    expect(selectDashboardHeroBatch([review, immediate])).toMatchObject({
      batch: { id: "immediate" },
      state: "ready-to-complete",
    });
  });

  it("selects review over active drying", () => {
    const active = createActiveBatch("active", "2026-07-22T08:00:00.000Z");
    const review = createReviewBatch("review", "2026-07-22T12:00:00.000Z");

    expect(selectDashboardHeroBatch([active, review])).toMatchObject({
      batch: { id: "review" },
      state: "review-required",
    });
  });

  it("selects active drying over Draft when no action is waiting", () => {
    const draft = createBatch({ id: "draft", status: "Draft" });
    const active = createActiveBatch("active", "2026-07-22T08:00:00.000Z");

    expect(selectDashboardHeroBatch([draft, active])).toMatchObject({
      batch: { id: "active" },
      state: "active-drying",
    });
  });

  it("selects the longest-waiting Batch at the same priority", () => {
    const newer = createMissingChecksBatch("newer", "2026-07-22T12:00:00.000Z");
    const older = createMissingChecksBatch("older", "2026-07-22T10:00:00.000Z");

    expect(selectDashboardHeroBatch([newer, older])).toMatchObject({
      batch: { id: "older" },
      waitingSince: "2026-07-22T10:00:00.000Z",
    });
  });

  it("uses the stable Production Batch identifier as the final tie-break", () => {
    const second = createMissingChecksBatch(
      "batch-b",
      "2026-07-22T10:00:00.000Z",
    );
    const first = createMissingChecksBatch(
      "batch-a",
      "2026-07-22T10:00:00.000Z",
    );

    expect(selectDashboardHeroBatch([second, first])?.batch.id).toBe("batch-a");
  });

  it("is independent of API response order", () => {
    const batches = [
      createActiveBatch("active", "2026-07-22T08:00:00.000Z"),
      createReviewBatch("review", "2026-07-22T09:00:00.000Z"),
      createMissingChecksBatch("immediate", "2026-07-22T10:00:00.000Z"),
    ];

    expect(selectDashboardHeroBatch(batches)?.batch.id).toBe("immediate");
    expect(selectDashboardHeroBatch([...batches].reverse())?.batch.id).toBe(
      "immediate",
    );
  });
});

function createMissingChecksBatch(id: string, endedAt: string) {
  const dryingRun = createDryingRun({
    id: `${id}-run`,
    production_batch_id: id,
    status: "Complete",
    ended_at: endedAt,
    updated_at: endedAt,
  });
  return createBatch({
    id,
    status: "Running",
    completed_at: null,
    trays: [createTray({ production_batch_id: id })],
    drying_runs: [dryingRun],
  });
}

function createReviewBatch(id: string, recordedAt: string) {
  const dryingRun = createDryingRun({
    id: `${id}-run`,
    production_batch_id: id,
    status: "Complete",
    ended_at: "2026-07-22T10:00:00.000Z",
  });
  const weightCheck = createWeightCheck({
    id: `${id}-check`,
    tray_id: `${id}-tray`,
    drying_run_id: dryingRun.id,
    recorded_at: recordedAt,
  });
  return createBatch({
    id,
    status: "Running",
    completed_at: null,
    trays: [
      createTray({
        id: `${id}-tray`,
        production_batch_id: id,
        weight_checks: [weightCheck],
      }),
    ],
    drying_runs: [dryingRun],
  });
}

function createActiveBatch(id: string, startedAt: string) {
  return createBatch({
    id,
    status: "Running",
    started_at: startedAt,
    completed_at: null,
    trays: [createTray({ production_batch_id: id })],
    drying_runs: [
      createDryingRun({
        id: `${id}-run`,
        production_batch_id: id,
        status: "Active",
        started_at: startedAt,
        created_at: startedAt,
        updated_at: startedAt,
      }),
    ],
  });
}

function createReadyBatch(id: string, completedAt: string) {
  return createBatch({
    id,
    status: "Running",
    completed_at: null,
    trays: [
      createTray({
        id: `${id}-tray`,
        production_batch_id: id,
        status: "Completed",
        completed_at: completedAt,
        final_dry_weight_grams: "300",
      }),
    ],
  });
}

function createBatch(
  overrides: Partial<ProductionBatch> = {},
): ProductionBatch {
  return {
    id: "batch-1",
    freeze_dryer_id: freezeDryer.id,
    freeze_dryer: freezeDryer,
    batch_number: "Batch 001",
    status: "Completed",
    started_at: "2026-07-22T08:00:00.000Z",
    completed_at: "2026-07-22T18:00:00.000Z",
    notes: null,
    trays: [],
    drying_runs: [],
    total_drying_seconds: 0,
    ...overrides,
  };
}

function createTray(overrides: Partial<Tray> = {}): Tray {
  return {
    id: "tray-1",
    production_batch_id: "batch-1",
    tray_slot_id: "slot-1",
    tray_slot: {
      id: "slot-1",
      freeze_dryer_id: freezeDryer.id,
      slot_number: 1,
      label: "Slot 1",
      archived: false,
    },
    physical_tray_id: "physical-tray-1",
    physical_tray: {
      id: "physical-tray-1",
      label: "Tray 1",
      tare_weight_grams: null,
      notes: null,
      archived: false,
    },
    recipe_id: null,
    recipe_name: null,
    product_name: "Pork Shoulder",
    preparation: "Cooked and shredded",
    starting_weight_grams: "1200",
    final_dry_weight_grams: null,
    completed_at: null,
    notes: null,
    status: "Running",
    weight_checks: [],
    latest_weight_grams: null,
    previous_weight_grams: null,
    packaging: null,
    ...overrides,
  };
}

function createDryingRun(overrides: Partial<DryingRun> = {}): DryingRun {
  return {
    id: "drying-run-1",
    production_batch_id: "batch-1",
    status: "Active",
    started_at: "2026-07-22T08:00:00.000Z",
    ended_at: null,
    notes: null,
    created_at: "2026-07-22T08:00:00.000Z",
    updated_at: "2026-07-22T08:00:00.000Z",
    duration_seconds: null,
    ...overrides,
  };
}

function createWeightCheck(overrides: Partial<WeightCheck> = {}): WeightCheck {
  return {
    id: "weight-check-1",
    tray_id: "tray-1",
    drying_run_id: "drying-run-1",
    weight_grams: "310",
    observed_at: "2026-07-22T10:15:00.000Z",
    recorded_at: "2026-07-22T10:16:00.000Z",
    notes: null,
    ...overrides,
  };
}

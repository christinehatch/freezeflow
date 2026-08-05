import type { DryingRun, ProductionBatch } from "../api/client";

export type DashboardHeroState =
  | "missing-weight-checks"
  | "ready-to-complete"
  | "review-required"
  | "active-drying";

export type DashboardHeroSelection = {
  batch: ProductionBatch;
  state: DashboardHeroState;
  waitingSince: string | null;
};

type RankedDashboardBatch = DashboardHeroSelection & {
  priority: number;
};

export function selectDashboardHeroBatch(
  batches: ProductionBatch[],
): DashboardHeroSelection | null {
  const rankedBatches = batches
    .map(rankDashboardBatch)
    .filter((batch): batch is RankedDashboardBatch => batch !== null)
    .sort(compareRankedBatches);

  const selection = rankedBatches[0];
  if (!selection) return null;

  return {
    batch: selection.batch,
    state: selection.state,
    waitingSince: selection.waitingSince,
  };
}

function rankDashboardBatch(
  batch: ProductionBatch,
): RankedDashboardBatch | null {
  if (batch.status !== "Running") return null;

  const runningTrays = batch.trays.filter((tray) => tray.status === "Running");
  const allTraysComplete =
    batch.trays.length > 0 &&
    batch.trays.every((tray) => tray.status === "Completed");

  if (allTraysComplete) {
    return {
      batch,
      priority: 3,
      state: "ready-to-complete",
      waitingSince:
        latestTimestamp(batch.trays.map((tray) => tray.completed_at)) ??
        batch.started_at,
    };
  }

  const latestRun = getLatestDashboardDryingRun(batch.drying_runs);
  if (latestRun?.status === "Complete") {
    const requiredChecks = runningTrays.map((tray) =>
      tray.weight_checks.find(
        (weightCheck) => weightCheck.drying_run_id === latestRun.id,
      ),
    );
    const hasMissingWeightChecks = requiredChecks.some(
      (weightCheck) => !weightCheck,
    );

    if (hasMissingWeightChecks) {
      return {
        batch,
        priority: 3,
        state: "missing-weight-checks",
        waitingSince:
          latestRun.ended_at ?? latestRun.started_at ?? batch.started_at,
      };
    }

    return {
      batch,
      priority: 2,
      state: "review-required",
      waitingSince:
        latestTimestamp(
          requiredChecks.map((weightCheck) => weightCheck?.recorded_at ?? null),
        ) ??
        latestRun.ended_at ??
        batch.started_at,
    };
  }

  return {
    batch,
    priority: 1,
    state: "active-drying",
    waitingSince: latestRun?.started_at ?? batch.started_at,
  };
}

export function getLatestDashboardDryingRun(dryingRuns: DryingRun[]) {
  return [...dryingRuns]
    .filter((dryingRun) => dryingRun.status !== "Voided")
    .sort(
      (left, right) =>
        right.started_at.localeCompare(left.started_at) ||
        left.id.localeCompare(right.id),
    )[0];
}

function compareRankedBatches(
  left: RankedDashboardBatch,
  right: RankedDashboardBatch,
) {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const leftTime = timestampValue(left.waitingSince);
  const rightTime = timestampValue(right.waitingSince);
  if (leftTime !== rightTime) return leftTime - rightTime;

  return left.batch.id.localeCompare(right.batch.id);
}

function timestampValue(timestamp: string | null) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function latestTimestamp(timestamps: Array<string | null>) {
  return timestamps.reduce<string | null>((latest, timestamp) => {
    if (!timestamp) return latest;
    if (!latest) return timestamp;
    return timestampValue(timestamp) > timestampValue(latest)
      ? timestamp
      : latest;
  }, null);
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { ProductionBatch, productionApi } from "../api/client";
import {
  Button,
  ButtonLink,
  FreezeDryerCard,
  PageHeader,
  RecentProductionRow,
  SectionHeader,
  StatusBadge,
  StatusBanner,
  Surface,
} from "../components/design-system";
import {
  type DashboardHeroSelection,
  getLatestDashboardDryingRun,
  selectDashboardHeroBatch,
} from "./dashboardPrioritization";

export function DashboardPage() {
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const freezeDryers = freezeDryersQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const runningBatches = batches.filter((batch) => batch.status === "Running");
  const draftBatches = batches.filter((batch) => batch.status === "Draft");
  const activeBatchIds = new Set(runningBatches.map((batch) => batch.id));
  const recentBatches = getRecentBatches(batches, activeBatchIds);
  const activeDryerIds = new Set(
    runningBatches.map((batch) => batch.freeze_dryer_id),
  );
  const heroSelection = selectDashboardHeroBatch(batches);
  const heroBatch = heroSelection?.batch ?? null;
  const hero = heroSelection ? getHeroContext(heroSelection) : null;
  const hasHero = Boolean(heroSelection);
  const hasAttention =
    heroSelection !== null && heroSelection.state !== "active-drying";

  return (
    <div className="dashboard">
      <PageHeader
        action={
          <ButtonLink
            to="/production"
            variant={hasHero ? "secondary" : "primary"}
          >
            + New Production Batch
          </ButtonLink>
        }
        description={getDashboardDescription({
          batchError: batchesQuery.isError,
          hasAttention,
          runningCount: runningBatches.length,
        })}
        title="Dashboard"
      />

      {batchesQuery.isLoading ? (
        <StatusBanner
          body="Freezeflow is checking current Production Batch and Freeze Dryer status."
          title="Loading Dashboard"
          tone="calm"
        />
      ) : batchesQuery.isError ? (
        <StatusBanner
          body={`Production Batches could not be loaded. ${batchesQuery.error.message}`}
          title="Dashboard attention is temporarily unavailable"
          tone="danger"
        />
      ) : heroBatch && hero && heroSelection ? (
        <StatusBanner
          action={
            <ButtonLink to={`/production/${heroBatch.id}`}>
              {hero.actionLabel}
            </ButtonLink>
          }
          badge={
            heroSelection.state === "active-drying" ? (
              <StatusBadge tone="active">In progress</StatusBadge>
            ) : (
              <StatusBadge tone="attention">Needs attention</StatusBadge>
            )
          }
          body={hero.body}
          title={hero.title}
          tone={heroSelection.state === "active-drying" ? "calm" : "attention"}
        />
      ) : (
        <StatusBanner
          badge={<StatusBadge tone="success">All clear</StatusBadge>}
          body={
            draftBatches.length > 0
              ? `${formatCount(draftBatches.length, "Draft Production Batch")} ready to continue.`
              : getCalmBody({
                  freezeDryerCount: freezeDryers.length,
                  freezeDryersError: freezeDryersQuery.isError,
                  freezeDryersLoading: freezeDryersQuery.isLoading,
                })
          }
          title="No production is running"
          tone="calm"
        />
      )}

      <section
        aria-labelledby="dashboard-freeze-dryers"
        className="dashboard__section"
      >
        <SectionHeader
          action={
            <Link className="dashboard__section-link" to="/freeze-dryers">
              View all
            </Link>
          }
          id="dashboard-freeze-dryers"
          title="Freeze Dryers"
        />
        {freezeDryersQuery.isLoading ? (
          <Surface>
            <p className="dashboard__state-copy">Loading Freeze Dryers…</p>
          </Surface>
        ) : freezeDryersQuery.isError ? (
          <Surface className="dashboard__error" role="alert">
            Freeze Dryers could not be loaded. {freezeDryersQuery.error.message}
          </Surface>
        ) : freezeDryers.length === 0 ? (
          <EmptyState
            actionLabel="Create Your First Freeze Dryer"
            actionTo="/freeze-dryers"
            title="No Freeze Dryers have been created."
          />
        ) : (
          <div className="dashboard__dryer-grid">
            {freezeDryers.map((freezeDryer) => {
              const activeBatch = runningBatches.find(
                (batch) => batch.freeze_dryer_id === freezeDryer.id,
              );
              const queuedBatch = draftBatches.find(
                (batch) => batch.freeze_dryer_id === freezeDryer.id,
              );
              const canCreate =
                !freezeDryer.archived && !activeDryerIds.has(freezeDryer.id);
              const cardSelection = activeBatch
                ? selectDashboardHeroBatch([activeBatch])
                : null;
              const cardContext = cardSelection
                ? getHeroContext(cardSelection)
                : null;

              return (
                <FreezeDryerCard
                  action={
                    activeBatch ? (
                      <ButtonLink
                        to={`/production/${activeBatch.id}`}
                        variant="secondary"
                      >
                        Open Current Batch
                      </ButtonLink>
                    ) : queuedBatch ? (
                      <ButtonLink
                        to={`/production/${queuedBatch.id}`}
                        variant="secondary"
                      >
                        Continue / Start Batch
                      </ButtonLink>
                    ) : canCreate ? (
                      <ButtonLink
                        to={`/production?freezeDryerId=${freezeDryer.id}`}
                        variant="secondary"
                      >
                        Create Production Batch
                      </ButtonLink>
                    ) : (
                      <Button disabled variant="secondary">
                        Unavailable
                      </Button>
                    )
                  }
                  detail={
                    activeBatch
                      ? cardContext?.nextStep
                      : queuedBatch
                        ? "Ready to continue setup"
                        : undefined
                  }
                  key={freezeDryer.id}
                  name={freezeDryer.name}
                  status={
                    <StatusBadge
                      tone={
                        activeBatch
                          ? "active"
                          : queuedBatch
                            ? "neutral"
                            : freezeDryer.archived
                              ? "neutral"
                              : "success"
                      }
                    >
                      {activeBatch
                        ? "Running"
                        : queuedBatch
                          ? "Draft"
                          : freezeDryer.archived
                            ? "Archived"
                            : "Idle"}
                    </StatusBadge>
                  }
                  summary={
                    activeBatch
                      ? `${activeBatch.batch_number} · ${formatCount(activeBatch.trays.length, "Tray")}`
                      : queuedBatch
                        ? `${queuedBatch.batch_number} · Draft`
                        : freezeDryer.archived
                          ? "Unavailable for new Production Batches"
                          : "Available for a new Production Batch"
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section
        aria-labelledby="dashboard-recent-production"
        className="dashboard__section"
      >
        <SectionHeader
          action={
            <Link className="dashboard__section-link" to="/production">
              View all
            </Link>
          }
          id="dashboard-recent-production"
          title="Recent Production"
        />
        {batchesQuery.isLoading ? (
          <Surface>
            <p className="dashboard__state-copy">
              Loading recent Production Batches…
            </p>
          </Surface>
        ) : batchesQuery.isError ? (
          <Surface className="dashboard__error" role="alert">
            Production history could not be loaded. {batchesQuery.error.message}
          </Surface>
        ) : recentBatches.length === 0 ? (
          <Surface>
            <p className="dashboard__state-copy">
              No recent Production Batches yet.
            </p>
          </Surface>
        ) : (
          <Surface className="dashboard__recent-surface">
            <ul className="dashboard__recent-list">
              {recentBatches.map((batch) => (
                <RecentProductionRow
                  batchNumber={batch.batch_number}
                  freezeDryerName={batch.freeze_dryer.name}
                  key={batch.id}
                  started={formatStarted(batch.started_at)}
                  status={
                    <StatusBadge tone={getBatchStatusTone(batch.status)}>
                      {batch.status}
                    </StatusBadge>
                  }
                  to={`/production/${batch.id}`}
                />
              ))}
            </ul>
          </Surface>
        )}
      </section>
    </div>
  );
}

function getDashboardDescription({
  batchError,
  hasAttention,
  runningCount,
}: {
  batchError: boolean;
  hasAttention: boolean;
  runningCount: number;
}) {
  if (batchError) return "Some production information could not be loaded.";
  if (hasAttention && runningCount === 1) {
    return "One Production Batch needs your attention.";
  }
  if (hasAttention && runningCount > 1) {
    return `${runningCount} Production Batches need your attention.`;
  }
  if (runningCount === 1) return "One Production Batch is running.";
  if (runningCount > 1)
    return `${runningCount} Production Batches are running.`;
  return "Everything is on track.";
}

function getHeroContext(selection: DashboardHeroSelection) {
  const { batch, state } = selection;
  const runningTrays = batch.trays.filter((tray) => tray.status === "Running");
  const identity = `${batch.batch_number} · ${batch.freeze_dryer.name} Freeze Dryer`;

  if (state === "ready-to-complete") {
    return {
      actionLabel: "Review Batch",
      body: `${identity} · every Tray is complete`,
      nextStep: "Next: review and complete the Batch",
      title: `${batch.batch_number} is ready to complete`,
    };
  }
  if (state === "missing-weight-checks") {
    const latestRun = getLatestDashboardDryingRun(batch.drying_runs);
    const traysMissingWeightChecks = runningTrays.filter(
      (tray) =>
        !tray.weight_checks.some(
          (weightCheck) => weightCheck.drying_run_id === latestRun?.id,
        ),
    );
    return {
      actionLabel: "Record Weight Checks",
      body: `${identity} · ${formatCount(traysMissingWeightChecks.length, "Tray")} to check`,
      nextStep: "Next: record Weight Checks",
      title: `${batch.batch_number} is ready for Weight Checks`,
    };
  }
  if (state === "review-required") {
    return {
      actionLabel: "Review Batch",
      body: `${identity} · Weight Checks recorded`,
      nextStep: "Next: review Weight Checks and continue Production",
      title: `${batch.batch_number} is ready for review`,
    };
  }
  return {
    actionLabel: "Open Current Batch",
    body: `${identity} · ${formatCount(batch.trays.length, "Tray")}`,
    nextStep: "Production is currently drying",
    title: `${batch.batch_number} is currently drying`,
  };
}

function getRecentBatches(
  batches: ProductionBatch[],
  activeBatchIds: Set<string>,
) {
  return [...batches]
    .filter((batch) => !activeBatchIds.has(batch.id))
    .sort((a, b) => {
      if (a.started_at && b.started_at) {
        return b.started_at.localeCompare(a.started_at);
      }
      if (a.started_at) return -1;
      if (b.started_at) return 1;
      return b.batch_number.localeCompare(a.batch_number);
    })
    .slice(0, 10);
}

function formatStarted(startedAt: string | null) {
  if (!startedAt) return "Not started";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(startedAt));
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getCalmBody({
  freezeDryerCount,
  freezeDryersError,
  freezeDryersLoading,
}: {
  freezeDryerCount: number;
  freezeDryersError: boolean;
  freezeDryersLoading: boolean;
}) {
  if (freezeDryersLoading) {
    return "No Production Batch is running. Freeze Dryer availability is still loading.";
  }
  if (freezeDryersError) {
    return "No Production Batch is running. Freeze Dryer availability is temporarily unavailable.";
  }
  if (freezeDryerCount === 0) {
    return "Create a Freeze Dryer when you are ready to begin.";
  }
  return `${formatCount(freezeDryerCount, "Freeze Dryer")} ready whenever you are.`;
}

function getBatchStatusTone(status: ProductionBatch["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "Cancelled") return "danger" as const;
  if (status === "Draft") return "neutral" as const;
  return "attention" as const;
}

function EmptyState({
  actionLabel,
  actionTo,
  title,
}: {
  actionLabel: string;
  actionTo: string;
  title: string;
}) {
  return (
    <Surface className="dashboard__empty">
      <p className="dashboard__empty-title">{title}</p>
      <div>
        <ButtonLink to={actionTo} variant="secondary">
          {actionLabel}
        </ButtonLink>
      </div>
    </Surface>
  );
}

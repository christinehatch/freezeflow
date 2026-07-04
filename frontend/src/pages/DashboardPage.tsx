import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { ProductionBatch, productionApi } from "../api/client";

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

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Dashboard</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            What needs attention right now.
          </p>
        </div>
        <Link className="primary-action" to="/production">
          + New Production Batch
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link className="quick-action" to="/production">
          + New Production Batch
        </Link>
        <Link className="quick-action" to="/freeze-dryers">
          Manage Freeze Dryers
        </Link>
      </section>

      <section className="panel">
        <h3 className="section-title">Needs Attention</h3>
        {runningBatches.length === 0 ? (
          <p className="text-slate-600">
            No Production Batches are currently running.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runningBatches.map((batch) => (
              <li key={batch.id}>
                <Link className="text-link" to={`/production/${batch.id}`}>
                  {batch.freeze_dryer.name} has active Production Batch{" "}
                  {batch.batch_number}.
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Freeze Dryers</h3>
          <Link className="text-link" to="/freeze-dryers">
            View all
          </Link>
        </div>
        {freezeDryers.length === 0 ? (
          <EmptyState
            actionLabel="Create Your First Freeze Dryer"
            actionTo="/freeze-dryers"
            title="No Freeze Dryers have been created."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {freezeDryers.map((freezeDryer) => {
              const activeBatch = runningBatches.find(
                (batch) => batch.freeze_dryer_id === freezeDryer.id,
              );
              const queuedBatch = draftBatches.find(
                (batch) => batch.freeze_dryer_id === freezeDryer.id,
              );
              const canCreate =
                !freezeDryer.archived && !activeDryerIds.has(freezeDryer.id);
              return (
                <article className="object-card" key={freezeDryer.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold">
                        {freezeDryer.name}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Status:{" "}
                        {activeBatch ? "Running" : queuedBatch ? "Queued" : "Idle"}
                      </p>
                    </div>
                    <StatusPill
                      status={activeBatch ? "Running" : queuedBatch ? "Queued" : "Idle"}
                    />
                  </div>
                  <p className="mt-4 text-sm text-slate-700">
                    {activeBatch
                      ? `Active Batch: ${activeBatch.batch_number}`
                      : queuedBatch
                        ? `Queued Batch: ${queuedBatch.batch_number}`
                        : "No active Production Batch"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeBatch ? (
                      <Link
                        className="secondary-action"
                        to={`/production/${activeBatch.id}`}
                      >
                        Open Current Batch
                      </Link>
                    ) : queuedBatch ? (
                      <Link
                        className="secondary-action"
                        to={`/production/${queuedBatch.id}`}
                      >
                        Continue / Start Batch
                      </Link>
                    ) : (
                      <Link
                        className="secondary-action"
                        aria-disabled={!canCreate}
                        to={
                          canCreate
                            ? `/production?freezeDryerId=${freezeDryer.id}`
                            : "/production"
                        }
                      >
                        Create Production Batch
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="section-title">Recent Production Batches</h3>
        {recentBatches.length === 0 ? (
          <p className="mt-3 text-slate-600">No Production Batches yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Freeze Dryer</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <Link
                        className="text-link"
                        to={`/production/${batch.id}`}
                      >
                        {batch.batch_number}
                      </Link>
                    </td>
                    <td>{batch.freeze_dryer.name}</td>
                    <td>{batch.status}</td>
                    <td>{formatStarted(batch.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
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

function StatusPill({ status }: { status: "Running" | "Queued" | "Idle" }) {
  return (
    <span className={status === "Running" ? "pill-running" : "pill-idle"}>
      {status}
    </span>
  );
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
    <div className="empty-state">
      <p className="font-medium">{title}</p>
      <Link className="secondary-action mt-4 inline-flex" to={actionTo}>
        {actionLabel}
      </Link>
    </div>
  );
}

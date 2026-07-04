import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { productionApi } from "../api/client";

export function TrayDetailsPage() {
  const { trayId } = useParams();
  const trayQuery = useQuery({
    queryKey: ["tray", trayId],
    queryFn: () => productionApi.getTray(trayId ?? ""),
    enabled: Boolean(trayId),
  });

  const tray = trayQuery.data;

  if (trayQuery.isLoading) {
    return <div className="panel">Loading Tray...</div>;
  }

  if (!tray) {
    return <div className="panel">Tray could not be loaded.</div>;
  }

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-600">
        <Link className="text-link" to="/">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link
          className="text-link"
          to={`/production/${tray.production_batch_id}`}
        >
          Production Batch
        </Link>{" "}
        / {tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`}
      </nav>

      <section className="workspace-header">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`} ·{" "}
            {tray.physical_tray.label}
          </p>
          <h2 className="text-3xl font-semibold">{tray.product_name}</h2>
        </div>
        <p className="text-lg font-semibold">{tray.status}</p>
      </section>

      <section className="panel">
        <h3 className="section-title">Product</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="label-text">Physical Tray</dt>
            <dd>{tray.physical_tray.label}</dd>
          </div>
          <div>
            <dt className="label-text">Tray Slot</dt>
            <dd>
              {tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`}
            </dd>
          </div>
          <div>
            <dt className="label-text">Recipe</dt>
            <dd>{tray.recipe_name ?? "No Recipe"}</dd>
          </div>
          <div>
            <dt className="label-text">Notes</dt>
            <dd>{tray.notes ?? "No notes"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="section-title">Preparation</h3>
        <p className="mt-3 whitespace-pre-wrap text-slate-700">
          {tray.preparation}
        </p>
      </section>

      <section className="panel">
        <h3 className="section-title">Production</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <dt className="label-text">Starting Weight</dt>
            <dd>{formatWeight(tray.starting_weight_grams)}</dd>
          </div>
          <div>
            <dt className="label-text">Latest Weight</dt>
            <dd>{formatWeight(tray.latest_weight_grams)}</dd>
          </div>
          <div>
            <dt className="label-text">Final Dry Weight</dt>
            <dd>{formatWeight(tray.final_dry_weight_grams)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="section-title">Weight History</h3>
        {tray.weight_checks.length === 0 ? (
          <p className="mt-3 text-slate-600">No Weight Checks recorded.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Drying Run</th>
                  <th>Observed</th>
                  <th>Weight</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tray.weight_checks.map((check, index) => (
                  <tr key={check.id}>
                    <td>Run {index + 1}</td>
                    <td>{formatDate(check.observed_at)}</td>
                    <td>{formatWeight(check.weight_grams)}</td>
                    <td>{check.notes || "No notes"}</td>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWeight(value: string | null) {
  if (value === null) return "-";
  return `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} g`;
}

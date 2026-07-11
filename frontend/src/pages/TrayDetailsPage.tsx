import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { productionApi } from "../api/client";
import { printAvery5163Labels } from "../utils/avery5163Labels";

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

  const packaging = tray.packaging;

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

      {packaging ? (
        <section className="panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="section-title">Packaging</h3>
              <p className="mt-1 text-sm text-slate-600">
                Packaged {formatDate(packaging.packaged_at)}
              </p>
            </div>
            <button
              className="secondary-action"
              type="button"
              onClick={() =>
                printAvery5163Labels(
                  packaging.packages.map((packageItem) => ({
                    packageIdentifier: packageItem.package_identifier,
                    productName: tray.product_name,
                    packageLine: `${packageItem.package_type} · ${formatWeight(packageItem.package_weight_grams)}`,
                    batchLine: `${packaging.batch_number} · ${packaging.freeze_dryer} · ${
                      tray.tray_slot.label ||
                      `Slot ${tray.tray_slot.slot_number}`
                    }`,
                    oxygenAbsorber: packageItem.oxygen_absorber,
                    storageLocation: packageItem.storage_location,
                  })),
                )
              }
            >
              Reprint Avery 5163 Labels
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Prints on Avery 5163: 2&quot; x 4&quot;, 10 labels per letter sheet.
            Use US Letter / 8.5&quot; x 11&quot;, 100% scale, with headers and
            footers off.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {packaging.packages.map((packageItem) => (
              <article
                className="rounded-md border border-slate-300 p-4"
                key={packageItem.id}
              >
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {packageItem.package_identifier}
                </p>
                <h4 className="mt-1 text-lg font-semibold">
                  {tray.product_name}
                </h4>
                <p className="text-sm text-slate-700">
                  {packageItem.package_type} ·{" "}
                  {formatWeight(packageItem.package_weight_grams)}
                </p>
                <p className="text-sm text-slate-700">
                  Storage: {packageItem.storage_location}
                </p>
                {packageItem.oxygen_absorber ? (
                  <p className="text-sm text-slate-700">
                    Oxygen absorber: {packageItem.oxygen_absorber}
                  </p>
                ) : null}
                <p className="text-sm text-slate-700">
                  Status: {packageItem.status}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

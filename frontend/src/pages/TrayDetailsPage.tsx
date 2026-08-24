import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { Tray, WeightCheck, packagingApi, productionApi } from "../api/client";
import { printAvery5163Labels } from "../utils/avery5163Labels";
import { trayPreparationSummary } from "../utils/preparation";
import { WEIGHT_UNIT_OPTIONS, WeightUnit, toGrams } from "../utils/weights";

export function TrayDetailsPage() {
  const { trayId } = useParams();
  const queryClient = useQueryClient();
  const trayQuery = useQuery({
    queryKey: ["tray", trayId],
    queryFn: () => productionApi.getTray(trayId ?? ""),
    enabled: Boolean(trayId),
  });

  const tray = trayQuery.data;
  const labelMutation = useMutation({
    mutationFn: packagingApi.labelsForPackages,
    onSuccess: (labels) =>
      printAvery5163Labels(
        labels.map((label) => ({
          packageIdentifier: label.package_identifier,
          productName: label.product_summary,
          preparationSummary: label.preparation_summary,
          freshEquivalentGrams: label.fresh_equivalent_grams,
          finishedProductWeightGrams: label.finished_product_weight_grams,
          packageType: label.package_type,
          batchLine: `${label.batch_number} · ${label.freeze_dryer}`,
          oxygenAbsorber: label.oxygen_absorber,
          packagedAt: label.packaged_at,
        })),
      ),
  });

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
            <dt className="label-text">Preparation Preset</dt>
            <dd>{tray.preparation_preset_name ?? "No Preparation Preset"}</dd>
          </div>
          <div>
            <dt className="label-text">Notes</dt>
            <dd>{tray.notes ?? "No notes"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="section-title">Preparation</h3>
        {tray.ingredients && tray.ingredients.length > 0 ? (
          <p className="mt-3 text-slate-700">
            <span className="label-text">Ingredients: </span>
            {tray.ingredients.join(", ")}
          </p>
        ) : null}
        {tray.preparation_methods && tray.preparation_methods.length > 0 ? (
          <p className="mt-3 text-slate-700">
            <span className="label-text">Preparation Methods: </span>
            {tray.preparation_methods.join(", ")}
          </p>
        ) : null}
        {(!tray.ingredients || tray.ingredients.length === 0) &&
        (!tray.preparation_methods || tray.preparation_methods.length === 0) ? (
          <p className="mt-3 whitespace-pre-wrap text-slate-700">
            {tray.preparation ?? "No preparation recorded."}
          </p>
        ) : null}
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
                Packaged{" "}
                {formatDate(packaging.completed_at ?? packaging.started_at)}
              </p>
            </div>
            <button
              className="secondary-action"
              type="button"
              disabled={labelMutation.isPending}
              onClick={() =>
                labelMutation.mutate({
                  package_ids: packaging.packages.map((item) => item.id),
                  batch_number: packaging.batch_number,
                  freeze_dryer: packaging.freeze_dryer,
                  product_summary: tray.product_name,
                  preparation_summary:
                    trayPreparationSummary(tray) ?? undefined,
                  source_starting_weight_grams: tray.starting_weight_grams,
                })
              }
            >
              Reprint Avery 5163 Labels
            </button>
          </div>
          {labelMutation.isError ? (
            <p className="mt-3 text-sm text-red-700">
              {labelMutation.error.message}
            </p>
          ) : null}
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
                  {packageItem.package_type}
                </p>
                <p className="text-sm text-slate-700">
                  Finished product:{" "}
                  {formatWeight(packageItem.finished_product_weight_grams)}
                </p>
                <p className="text-sm text-slate-700">
                  Sealed package:{" "}
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tray.weight_checks.map((check, index) => (
                  <WeightCheckHistoryRow
                    check={check}
                    key={check.id}
                    onCorrected={(correctedCheck) => {
                      queryClient.setQueryData<Tray>(
                        ["tray", trayId],
                        (currentTray) => {
                          if (!currentTray) return currentTray;
                          const latestCheck =
                            currentTray.weight_checks[
                              currentTray.weight_checks.length - 1
                            ];
                          const isLatest =
                            latestCheck?.id === correctedCheck.id;
                          return {
                            ...currentTray,
                            latest_weight_grams: isLatest
                              ? correctedCheck.weight_grams
                              : currentTray.latest_weight_grams,
                            weight_checks: currentTray.weight_checks.map(
                              (item) =>
                                item.id === correctedCheck.id
                                  ? correctedCheck
                                  : item,
                            ),
                          };
                        },
                      );
                    }}
                    runNumber={index + 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function WeightCheckHistoryRow({
  check,
  onCorrected,
  runNumber,
}: {
  check: WeightCheck;
  onCorrected: (check: WeightCheck) => void;
  runNumber: number;
}) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [weight, setWeight] = useState(check.weight_grams);
  const [displayWeight, setDisplayWeight] = useState(check.weight_grams);
  const [unit, setUnit] = useState<WeightUnit>("g");
  const [reason, setReason] = useState("");
  const correction = useMutation({
    mutationFn: productionApi.correctWeightCheck,
    onSuccess: (correctedCheck) => {
      setDisplayWeight(correctedCheck.weight_grams);
      setIsCorrecting(false);
      onCorrected(correctedCheck);
    },
  });

  return (
    <tr>
      <td>Run {runNumber}</td>
      <td>{formatDate(check.observed_at)}</td>
      <td>
        {isCorrecting ? (
          <div className="min-w-64 space-y-2">
            <div className="flex gap-2">
              <input
                aria-label={`Correct weight for Run ${runNumber}`}
                className="table-input"
                min="0"
                step="0.001"
                type="number"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
              <select
                aria-label={`Correct weight unit for Run ${runNumber}`}
                className="table-input"
                value={unit}
                onChange={(event) => setUnit(event.target.value as WeightUnit)}
              >
                {WEIGHT_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              aria-label={`Correction reason for Run ${runNumber}`}
              className="table-input"
              placeholder="reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : (
          formatWeight(displayWeight)
        )}
      </td>
      <td>{check.notes || "No notes"}</td>
      <td>
        {isCorrecting ? (
          <div className="flex gap-2">
            <button
              className="quiet-action"
              disabled={weight === "" || correction.isPending}
              onClick={() =>
                correction.mutate({
                  id: check.id,
                  body: {
                    weight_grams: toGrams(weight, unit),
                    reason: reason.trim() === "" ? null : reason.trim(),
                  },
                })
              }
              type="button"
            >
              Save Correction
            </button>
            <button
              className="quiet-action"
              onClick={() => setIsCorrecting(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="quiet-action"
            onClick={() => {
              setWeight(displayWeight);
              setUnit("g");
              setReason("");
              setIsCorrecting(true);
            }}
            type="button"
          >
            Correct Weight
          </button>
        )}
      </td>
    </tr>
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

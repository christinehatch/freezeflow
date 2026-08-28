import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { WeightCheck, packagingApi, productionApi } from "../api/client";
import { AuditHistoryViewer } from "../components/AuditHistoryViewer";
import { CorrectableField } from "../components/CorrectableField";
import { ErrorPanel, LoadingPanel } from "../components/design-system";
import { WeightCorrectableField } from "../components/WeightCorrectableField";
import { formatApiError } from "../utils/apiErrors";
import { printAvery5163Labels } from "../utils/avery5163Labels";
import { trayPreparationSummary } from "../utils/preparation";

export function TrayDetailsPage() {
  const { trayId } = useParams();
  const queryClient = useQueryClient();
  const trayQuery = useQuery({
    queryKey: ["tray", trayId],
    queryFn: () => productionApi.getTray(trayId ?? ""),
    enabled: Boolean(trayId),
  });

  const tray = trayQuery.data;

  function invalidateTray() {
    return queryClient.invalidateQueries({ queryKey: ["tray", trayId] });
  }
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
    return <LoadingPanel label="Loading Tray…" />;
  }

  if (trayQuery.isError) {
    return (
      <ErrorPanel
        message={formatApiError(trayQuery.error)}
        onRetry={() => void trayQuery.refetch()}
      />
    );
  }

  if (!tray) {
    return <ErrorPanel message="Tray could not be loaded." />;
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
        <div className="flex flex-col items-end gap-2">
          <p className="text-lg font-semibold">{tray.status}</p>
          <AuditHistoryViewer entityId={tray.id} entityType="Tray" />
        </div>
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
            <CorrectableField
              fieldId="tray-notes"
              label="Notes"
              multiline
              value={tray.notes ?? ""}
              displayValue={tray.notes ?? "No notes"}
              onSave={async (correctedValue, reason) => {
                await productionApi.correctTrayNotes({
                  id: tray.id,
                  body: { notes: correctedValue, reason },
                });
                await invalidateTray();
              }}
            />
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="section-title">Preparation</h3>
        <div className="mt-4 space-y-4">
          <CorrectableField
            fieldId="tray-product-name"
            label="Product Name"
            value={tray.product_name}
            onSave={async (correctedValue, reason) => {
              await productionApi.correctTrayPreparation({
                id: tray.id,
                body: { product_name: correctedValue, reason },
              });
              await invalidateTray();
            }}
          />
          <CorrectableField
            fieldId="tray-ingredients"
            label="Ingredients"
            value={tray.ingredients?.join(", ") ?? ""}
            displayValue={
              tray.ingredients && tray.ingredients.length > 0
                ? tray.ingredients.join(", ")
                : "No ingredients recorded."
            }
            onSave={async (correctedValue, reason) => {
              await productionApi.correctTrayPreparation({
                id: tray.id,
                body: { ingredients: parseCsvList(correctedValue), reason },
              });
              await invalidateTray();
            }}
          />
          <CorrectableField
            fieldId="tray-preparation-methods"
            label="Preparation Methods"
            value={tray.preparation_methods?.join(", ") ?? ""}
            displayValue={
              tray.preparation_methods && tray.preparation_methods.length > 0
                ? tray.preparation_methods.join(", ")
                : "No preparation methods recorded."
            }
            onSave={async (correctedValue, reason) => {
              await productionApi.correctTrayPreparation({
                id: tray.id,
                body: {
                  preparation_methods: parseCsvList(correctedValue),
                  reason,
                },
              });
              await invalidateTray();
            }}
          />
          {(!tray.ingredients || tray.ingredients.length === 0) &&
          (!tray.preparation_methods ||
            tray.preparation_methods.length === 0) ? (
            <p className="whitespace-pre-wrap text-slate-700">
              {tray.preparation ?? "No preparation recorded."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <h3 className="section-title">Production</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <WeightCorrectableField
            fieldId="tray-starting-weight"
            label="Starting Weight"
            valueGrams={tray.starting_weight_grams ?? "0"}
            onSave={async (correctedGrams, reason) => {
              await productionApi.correctTrayStartingWeight({
                id: tray.id,
                body: {
                  starting_weight_grams: correctedGrams,
                  reason,
                },
              });
              await invalidateTray();
            }}
          />
          <div>
            <dt className="label-text">Latest Weight</dt>
            <dd>{formatWeight(tray.latest_weight_grams)}</dd>
          </div>
          <WeightCorrectableField
            fieldId="tray-final-dry-weight"
            label="Final Dry Weight"
            valueGrams={tray.final_dry_weight_grams ?? "0"}
            onSave={async (correctedGrams, reason) => {
              await productionApi.correctTrayFinalDryWeight({
                id: tray.id,
                body: {
                  final_dry_weight_grams: correctedGrams,
                  reason,
                },
              });
              await invalidateTray();
            }}
          />
        </div>
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
            <p className="mt-3 text-sm text-red-700" role="alert">
              {formatApiError(labelMutation.error)}
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
                </tr>
              </thead>
              <tbody>
                {tray.weight_checks.map((check, index) => (
                  <WeightCheckHistoryRow
                    check={check}
                    key={check.id}
                    onCorrected={invalidateTray}
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
  onCorrected: () => Promise<unknown>;
  runNumber: number;
}) {
  return (
    <tr>
      <td>Run {runNumber}</td>
      <td>{formatDate(check.observed_at)}</td>
      <td>
        <WeightCorrectableField
          fieldId={`weight-check-${check.id}`}
          label={`Weight for Run ${runNumber}`}
          valueGrams={check.weight_grams}
          onSave={async (correctedGrams, reason) => {
            await productionApi.correctWeightCheck({
              id: check.id,
              body: { weight_grams: correctedGrams, reason },
            });
            await onCorrected();
          }}
        />
      </td>
      <td>{check.notes || "No notes"}</td>
    </tr>
  );
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
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

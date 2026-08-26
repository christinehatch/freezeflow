import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import {
  inventoryApi,
  packagingApi,
  productionApi,
  type PackageLabel,
  type PackagingAllocationSourceTray,
} from "../api/client";
import { AuditHistoryViewer } from "../components/AuditHistoryViewer";
import { CorrectableField } from "../components/CorrectableField";
import { CreatableStorageLocationSelect } from "../components/CreatableStorageLocationSelect";
import { PackageLabelEditor } from "../components/PackagingWorkspaceActions";
import { WeightCorrectableField } from "../components/WeightCorrectableField";
import { StatusBadge, type SelectOption } from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";
import {
  reserveAvery5163PrintOutput,
  toAvery5163Label,
} from "../utils/avery5163Labels";
import { formatGrams } from "../utils/weights";

export function PackageDetailsPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printConfirmation, setPrintConfirmation] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [moveDestination, setMoveDestination] = useState("");

  const packageQuery = useQuery({
    queryKey: ["package", packageId],
    queryFn: () => packagingApi.getPackage(packageId ?? ""),
    enabled: Boolean(packageId),
  });
  const pkg = packageQuery.data;

  const operationQuery = useQuery({
    queryKey: ["packaging-operation", pkg?.packaging_operation_id],
    queryFn: () =>
      packagingApi.getPackagingOperation(pkg?.packaging_operation_id ?? ""),
    enabled: Boolean(pkg),
  });
  const allocation = operationQuery.data?.allocations.find(
    (item) => item.id === pkg?.packaging_allocation_id,
  );

  const batchQuery = useQuery({
    queryKey: ["production-batch", operationQuery.data?.production_batch_id],
    queryFn: () =>
      productionApi.getProductionBatch(
        operationQuery.data?.production_batch_id ?? "",
      ),
    enabled: Boolean(operationQuery.data),
  });

  const storageLocationsQuery = useQuery({
    queryKey: ["storage-locations", "including-archived"],
    queryFn: () => inventoryApi.listStorageLocations({ includeArchived: true }),
  });
  const storageLocationsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const location of storageLocationsQuery.data ?? []) {
      map.set(location.id, location.name);
    }
    return map;
  }, [storageLocationsQuery.data]);
  const moveDestinationOptions: SelectOption[] = useMemo(
    () =>
      (storageLocationsQuery.data ?? [])
        .filter((location) => !location.archived)
        .filter((location) => location.id !== pkg?.storage_location_id)
        .map((location) => ({ value: location.id, label: location.name })),
    [storageLocationsQuery.data, pkg?.storage_location_id],
  );

  const storageHistoryQuery = useQuery({
    queryKey: ["package-storage-history", packageId],
    queryFn: () => inventoryApi.getPackageStorageHistory(packageId ?? ""),
    enabled: Boolean(packageId),
  });
  const statusHistoryQuery = useQuery({
    queryKey: ["package-status-history", packageId],
    queryFn: () => inventoryApi.getPackageStatusHistory(packageId ?? ""),
    enabled: Boolean(packageId),
  });

  function invalidatePackage() {
    void queryClient.invalidateQueries({ queryKey: ["package", packageId] });
    void queryClient.invalidateQueries({
      queryKey: ["package-storage-history", packageId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["package-status-history", packageId],
    });
  }

  const moveMutation = useMutation({
    mutationFn: (storageLocationId: string) =>
      inventoryApi.movePackage(pkg?.id ?? "", {
        storage_location_id: storageLocationId,
      }),
    onError: (error) => setActionError(formatApiError(error)),
    onSuccess: () => {
      setActionError(null);
      setMoveDestination("");
      invalidatePackage();
    },
  });
  const giveAwayMutation = useMutation({
    mutationFn: () => inventoryApi.giveAwayPackage(pkg?.id ?? ""),
    onError: (error) => setActionError(formatApiError(error)),
    onSuccess: () => {
      setActionError(null);
      invalidatePackage();
    },
  });
  const depleteMutation = useMutation({
    mutationFn: () => inventoryApi.depletePackage(pkg?.id ?? ""),
    onError: (error) => setActionError(formatApiError(error)),
    onSuccess: () => {
      setActionError(null);
      invalidatePackage();
    },
  });

  function goBack() {
    if (location.key === "default") {
      navigate("/inventory");
    } else {
      navigate(-1);
    }
  }

  async function reprintLabel(label: PackageLabel) {
    if (!pkg) return;
    setPrintError(null);
    setPrintConfirmation(null);
    const reserved = reserveAvery5163PrintOutput();
    if (!reserved) {
      setPrintError(
        "The browser blocked the Avery 5163 output window. No Print Event was recorded. Allow popups for Freezeflow, then try again.",
      );
      return;
    }
    try {
      const result = await packagingApi.printPackageLabels({
        package_label_ids: [label.id],
      });
      const printedLabel = result.labels[0] ?? label;
      const loaded = reserved.load([
        toAvery5163Label({ label: printedLabel, recordedPackage: pkg }),
      ]);
      if (!loaded) {
        reserved.close();
        setPrintError(
          "The Print Event was recorded, but the browser could not load the Avery 5163 output.",
        );
      } else {
        setPrintConfirmation("Print recorded.");
      }
      void queryClient.invalidateQueries({ queryKey: ["package", packageId] });
    } catch (error) {
      reserved.close();
      setPrintError(formatApiError(error));
    }
  }

  if (packageQuery.isLoading) {
    return <div className="panel">Loading Package…</div>;
  }

  if (packageQuery.isError) {
    return (
      <div className="panel">
        <p className="text-red-700" role="alert">
          {formatApiError(packageQuery.error)}
        </p>
        <button
          className="secondary-action mt-3"
          type="button"
          onClick={() => void packageQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!pkg) {
    return <div className="panel">Package could not be loaded.</div>;
  }

  const isInStorage = pkg.status === "In Storage";
  const label = pkg.label;

  return (
    <div className="space-y-8">
      <nav>
        <button className="quiet-action -ml-3" type="button" onClick={goBack}>
          &larr; Back
        </button>
      </nav>

      <section className="workspace-header">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {pkg.package_identifier}
          </p>
          <h2 className="text-3xl font-semibold">{label.display_name}</h2>
          <div className="package-header__metadata">
            <span className="package-header__location">
              {isInStorage ? "Stored in " : "Last stored in "}
              {pkg.storage_location.name}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge tone={isInStorage ? "active" : "neutral"}>
            {pkg.status}
          </StatusBadge>
          <AuditHistoryViewer entityId={pkg.id} entityType="Package" />
        </div>
      </section>

      <section className="panel">
        <h3 className="section-title">Package</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <dt className="label-text">Package Type</dt>
            <dd>{pkg.package_type.name}</dd>
          </div>
          <div>
            <dt className="label-text">Finished Product Weight</dt>
            <dd>
              {formatGrams(
                pkg.finished_product_weight_grams === null
                  ? null
                  : String(pkg.finished_product_weight_grams),
              )}
            </dd>
          </div>
          <div>
            <WeightCorrectableField
              fieldId="package-weight"
              label="Sealed Package Weight"
              valueGrams={String(pkg.package_weight_grams)}
              onSave={async (correctedGrams, reason) => {
                await packagingApi.correctPackageWeight({
                  packageId: pkg.id,
                  body: { package_weight_grams: correctedGrams, reason },
                });
                invalidatePackage();
              }}
            />
          </div>
          <div>
            <dt className="label-text">Current Storage Location</dt>
            <dd>{pkg.storage_location.name}</dd>
          </div>
          <div>
            <dt className="label-text">Oxygen Absorber</dt>
            <dd>{pkg.oxygen_absorber || "None"}</dd>
          </div>
          <div>
            <dt className="label-text">Packaged</dt>
            <dd>{formatDate(pkg.packaged_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="section-title">Package Label</h3>
          <StatusBadge
            tone={label.status === "Needs Reprint" ? "attention" : "neutral"}
          >
            {label.status}
          </StatusBadge>
        </div>
        {label.status === "Needs Reprint" ? (
          <p className="mt-2 text-sm font-medium text-amber-800" role="status">
            This label was corrected after it was last printed. Reprint it so
            the physical label matches the current content.
          </p>
        ) : null}

        {printError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {printError}
          </p>
        ) : null}
        {printConfirmation ? (
          <p className="mt-3 text-sm text-emerald-700">{printConfirmation}</p>
        ) : null}

        {isEditingLabel ? (
          <PackageLabelEditor
            formatError={formatApiError}
            label={label}
            packageIdentifier={pkg.package_identifier}
            onRefresh={() => packagingApi.getPackageLabel(pkg.id)}
            onSave={async (body) => {
              await packagingApi.updatePackageLabel({
                packageId: pkg.id,
                body,
              });
              void queryClient.invalidateQueries({
                queryKey: ["package", packageId],
              });
            }}
          />
        ) : (
          <dl className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="label-text">Subtitle / Description</dt>
              <dd>{label.description || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Ingredients Summary</dt>
              <dd>{label.ingredients_summary || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Preparation Summary</dt>
              <dd>{label.preparation_summary || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Net Weight</dt>
              <dd>{label.net_weight_display || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Fresh Equivalent</dt>
              <dd>{label.fresh_equivalent_display || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Serving Notes</dt>
              <dd>{label.serving_notes || "Not specified"}</dd>
            </div>
            <div>
              <dt className="label-text">Rehydration Instructions</dt>
              <dd>{label.rehydration_instructions || "Not specified"}</dd>
            </div>
          </dl>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="secondary-action"
            type="button"
            onClick={() => setIsEditingLabel((current) => !current)}
          >
            {isEditingLabel ? "Done Editing" : "Edit Package Label"}
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => void reprintLabel(label)}
          >
            Print / Reprint Label
          </button>
        </div>

        {label.print_events.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold">Print History</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {label.print_events.map((event) => (
                <li key={event.id}>
                  {formatDate(event.printed_at)} · Printed · {event.template}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h3 className="section-title">Production History</h3>
        {operationQuery.isLoading ? (
          <p className="mt-3 text-slate-600">Loading source Trays…</p>
        ) : allocation && allocation.source_trays.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {allocation.source_trays.map((tray) => (
              <SourceTrayCard
                batchNumber={batchQuery.data?.batch_number ?? null}
                freezeDryerName={batchQuery.data?.freeze_dryer.name ?? null}
                key={tray.id}
                tray={tray}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-slate-600">
            No source Tray traceability is available.
          </p>
        )}
      </section>

      <section className="panel">
        <h3 className="section-title">Packaging</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="label-text">Packaged</dt>
            <dd>{formatDate(pkg.packaged_at)}</dd>
          </div>
          <div>
            <dt className="label-text">Package Type</dt>
            <dd>{pkg.package_type.name}</dd>
          </div>
          <div>
            <dt className="label-text">Oxygen Absorber</dt>
            <dd>{pkg.oxygen_absorber || "None"}</dd>
          </div>
          <div>
            <CorrectableField
              fieldId="package-notes"
              label="Packaging Notes"
              multiline
              value={pkg.notes ?? ""}
              displayValue={pkg.notes || "No notes"}
              onSave={async (correctedValue, reason) => {
                await packagingApi.correctPackageNotes({
                  packageId: pkg.id,
                  body: { notes: correctedValue, reason },
                });
                invalidatePackage();
              }}
            />
          </div>
        </dl>
        {batchQuery.data ? (
          <p className="mt-3 text-sm text-slate-600">
            From{" "}
            <Link
              className="text-link"
              to={`/production/${batchQuery.data.id}`}
            >
              {batchQuery.data.batch_number}
            </Link>{" "}
            · {batchQuery.data.freeze_dryer.name}
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h3 className="section-title">Inventory History</h3>
        {actionError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {actionError}
          </p>
        ) : null}

        <InventoryHistoryTimeline
          statusHistory={statusHistoryQuery.data ?? []}
          storageHistory={storageHistoryQuery.data ?? []}
          storageLocationsById={storageLocationsById}
        />

        {isInStorage ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <CreatableStorageLocationSelect
              id="package-move-destination"
              invalidateQueryKey={["storage-locations", "including-archived"]}
              label="Move to"
              options={moveDestinationOptions}
              placeholder="Choose a Storage Location"
              value={moveDestination}
              onChange={setMoveDestination}
            />
            <button
              className="secondary-action"
              disabled={moveDestination === "" || moveMutation.isPending}
              type="button"
              onClick={() => moveMutation.mutate(moveDestination)}
            >
              {moveMutation.isPending ? "Moving…" : "Move Package"}
            </button>
            <button
              className="secondary-action"
              disabled={giveAwayMutation.isPending}
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Mark ${pkg.package_identifier} as Given Away? This removes it from active Inventory.`,
                  )
                ) {
                  giveAwayMutation.mutate();
                }
              }}
            >
              Mark Given Away
            </button>
            <button
              className="danger-action"
              disabled={depleteMutation.isPending}
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Mark ${pkg.package_identifier} as Depleted? This removes it from active Inventory.`,
                  )
                ) {
                  depleteMutation.mutate();
                }
              }}
            >
              Mark Depleted
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SourceTrayCard({
  batchNumber,
  freezeDryerName,
  tray,
}: {
  batchNumber: string | null;
  freezeDryerName: string | null;
  tray: PackagingAllocationSourceTray;
}) {
  return (
    <Link
      className="block rounded-md border border-slate-300 p-4 hover:border-teal-600"
      to={`/trays/${tray.id}`}
    >
      <p className="text-xs font-semibold uppercase text-slate-500">
        Tray Slot {tray.slot_number} · {tray.physical_tray_label}
      </p>
      <h4 className="mt-1 text-lg font-semibold">{tray.product_name}</h4>
      <p className="text-sm text-slate-700">{tray.preparation}</p>
      <p className="mt-2 text-sm text-slate-600">
        {batchNumber ?? "Batch unavailable"}
        {freezeDryerName ? ` · ${freezeDryerName}` : ""}
        {" · Final Dry Weight "}
        {formatGrams(String(tray.final_dry_weight_grams))}
      </p>
    </Link>
  );
}

type TimelineEntry = {
  key: string;
  when: string;
  description: string;
};

function InventoryHistoryTimeline({
  statusHistory,
  storageHistory,
  storageLocationsById,
}: {
  statusHistory: {
    id: string;
    previous_status: string | null;
    current_status: string;
    effective_at: string;
    notes: string | null;
  }[];
  storageHistory: {
    id: string;
    current_storage_location_id: string;
    previous_storage_location_id: string | null;
    moved_at: string;
    notes: string | null;
  }[];
  storageLocationsById: Map<string, string>;
}) {
  const entries: TimelineEntry[] = useMemo(() => {
    const statusEntries: TimelineEntry[] = statusHistory.map((entry) => ({
      key: `status-${entry.id}`,
      when: entry.effective_at,
      description:
        entry.previous_status === null
          ? `Package created ${entry.current_status}`
          : `Marked ${entry.current_status}`,
    }));
    const storageEntries: TimelineEntry[] = storageHistory
      .filter((entry) => entry.previous_storage_location_id !== null)
      .map((entry) => ({
        key: `storage-${entry.id}`,
        when: entry.moved_at,
        description: `Moved to ${
          storageLocationsById.get(entry.current_storage_location_id) ??
          "an unknown Storage Location"
        }`,
      }));
    return [...statusEntries, ...storageEntries].sort((a, b) =>
      a.when.localeCompare(b.when),
    );
  }, [statusHistory, storageHistory, storageLocationsById]);

  if (entries.length === 0) {
    return <p className="mt-3 text-slate-600">No Inventory History yet.</p>;
  }

  return (
    <ul className="mt-3 space-y-1 text-sm text-slate-700" role="list">
      {entries.map((entry) => (
        <li key={entry.key}>
          {formatDate(entry.when)} · {entry.description}
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

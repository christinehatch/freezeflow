import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router";

import {
  ApiError,
  DryingRun,
  PackagingOperation,
  PhysicalTray,
  ProductionBatch,
  Tray,
  TraySlot,
  packagingApi,
  productionApi,
} from "../api/client";
import {
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  fromGramsForInput,
  toGrams,
} from "../utils/weights";

export function ProductionBatchPage() {
  const { batchId } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [batchFreezeDryerId, setBatchFreezeDryerId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [draftPhysicalTraySelections, setDraftPhysicalTraySelections] =
    useState<Record<string, string>>({});
  const batchQuery = useQuery({
    queryKey: ["production-batch", batchId],
    queryFn: () => productionApi.getProductionBatch(batchId ?? ""),
    enabled: Boolean(batchId),
  });
  const packagingOperationQuery = useQuery({
    queryKey: ["packaging-operation-by-batch", batchId],
    queryFn: () => getBatchPackagingOperationOrNull(batchId ?? ""),
    enabled: Boolean(batchId && batchQuery.data?.status === "Completed"),
    retry: false,
  });
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const physicalTraysQuery = useQuery({
    queryKey: ["physical-trays"],
    queryFn: productionApi.listPhysicalTrays,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const startBatch = useMutation({
    mutationFn: productionApi.startProductionBatch,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const cancelBatch = useMutation({
    mutationFn: productionApi.cancelProductionBatch,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const completeBatch = useMutation({
    mutationFn: productionApi.completeProductionBatch,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const completeDryingRun = useMutation({
    mutationFn: productionApi.completeDryingRun,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const startDryingRun = useMutation({
    mutationFn: productionApi.startDryingRun,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const updateBatch = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { freeze_dryer_id?: string; notes?: string | null };
    }) => productionApi.updateProductionBatch(id, body),
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setError(null);
      setIsEditingBatch(false);
      refreshBatch(queryClient, batchId);
    },
  });

  const batch = batchQuery.data;
  const isDraft = batch?.status === "Draft";
  const freezeDryers = freezeDryersQuery.data ?? [];
  const physicalTrays = physicalTraysQuery.data ?? [];
  const unavailablePhysicalTrayIds = new Set(
    (batchesQuery.data ?? [])
      .filter(
        (productionBatch) =>
          productionBatch.id !== batch?.id &&
          (productionBatch.status === "Draft" ||
            productionBatch.status === "Running"),
      )
      .flatMap((productionBatch) =>
        productionBatch.trays.map((tray) => tray.physical_tray_id),
      ),
  );
  const activePhysicalTrays = physicalTrays.filter(
    (physicalTray) =>
      !physicalTray.archived &&
      !unavailablePhysicalTrayIds.has(physicalTray.id),
  );
  const selectableFreezeDryers = freezeDryers.filter(
    (freezeDryer) =>
      !freezeDryer.archived || freezeDryer.id === batch?.freeze_dryer_id,
  );
  const traySlots =
    batch?.freeze_dryer.tray_slots
      .filter((traySlot) => !traySlot.archived)
      .sort((a, b) => a.slot_number - b.slot_number) ?? [];
  const selectedPhysicalTrayIds = new Set([
    ...(batch?.trays.map((tray) => tray.physical_tray_id) ?? []),
    ...Object.values(draftPhysicalTraySelections).filter(
      (physicalTrayId) => physicalTrayId !== "",
    ),
  ]);
  const activeDryingRun = batch?.drying_runs.find(
    (dryingRun) => dryingRun.status === "Active",
  );
  const completedDryingRuns =
    batch?.drying_runs.filter((dryingRun) => dryingRun.status === "Complete") ??
    [];
  const latestCompletedDryingRun =
    completedDryingRuns[completedDryingRuns.length - 1];
  const hasSelectedTrays = Boolean(batch && batch.trays.length > 0);
  const allTraysHaveStartingWeight = Boolean(
    batch &&
    batch.trays.length > 0 &&
    batch.trays.every((tray) => tray.starting_weight_grams !== null),
  );
  const runningTrays =
    batch?.trays.filter((tray) => tray.status === "Running") ?? [];
  const allRunningTraysHaveLatestWeightCheck = Boolean(
    latestCompletedDryingRun &&
    runningTrays.every((tray) =>
      tray.weight_checks.some(
        (check) => check.drying_run_id === latestCompletedDryingRun.id,
      ),
    ),
  );
  const allTraysComplete = Boolean(
    batch &&
    batch.trays.length > 0 &&
    batch.trays.every((tray) => tray.status === "Completed"),
  );

  function handleBatchUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch) return;

    updateBatch.mutate({
      id: batch.id,
      body: {
        freeze_dryer_id:
          batchFreezeDryerId === batch.freeze_dryer_id
            ? undefined
            : batchFreezeDryerId,
        notes: batchNotes.trim() === "" ? null : batchNotes,
      },
    });
  }

  if (batchQuery.isLoading) {
    return <div className="panel">Loading Production Batch...</div>;
  }

  if (!batch) {
    return <div className="panel">Production Batch could not be loaded.</div>;
  }

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-600">
        <Link className="text-link" to="/">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link className="text-link" to="/production">
          Production
        </Link>{" "}
        / {batch.batch_number}
      </nav>

      <section className="workspace-header">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {batch.freeze_dryer.name}
          </p>
          <h2 className="text-3xl font-semibold">{batch.batch_number}</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{batch.status}</p>
          <p className="text-sm text-slate-600">
            {batch.started_at ? formatDate(batch.started_at) : "Not started"}
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Batch Setup</h3>
            <p className="mt-2 text-sm text-slate-600">
              {isDraft
                ? "Draft Production Batch details may be edited before production starts."
                : "Production Batch setup is locked after production starts."}
            </p>
          </div>
          {isDraft && !isEditingBatch ? (
            <button
              className="secondary-action"
              onClick={() => {
                setBatchFreezeDryerId(batch.freeze_dryer_id);
                setBatchNotes(batch.notes ?? "");
                setIsEditingBatch(true);
                setError(null);
              }}
              type="button"
            >
              Edit Batch
            </button>
          ) : null}
        </div>

        {isEditingBatch ? (
          <form
            className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr_auto]"
            onSubmit={handleBatchUpdate}
          >
            <label className="field">
              <span>Freeze Dryer</span>
              <select
                required
                value={batchFreezeDryerId}
                onChange={(event) => setBatchFreezeDryerId(event.target.value)}
              >
                {selectableFreezeDryers.map((freezeDryer) => (
                  <option key={freezeDryer.id} value={freezeDryer.id}>
                    {freezeDryer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Batch Notes</span>
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="secondary-action"
                disabled={updateBatch.isPending}
                type="submit"
              >
                Save
              </button>
              <button
                className="quiet-action"
                onClick={() => {
                  setIsEditingBatch(false);
                  setError(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <dt className="label-text">Freeze Dryer</dt>
              <dd>{batch.freeze_dryer.name}</dd>
            </div>
            <div>
              <dt className="label-text">Tray Slots</dt>
              <dd>{batch.freeze_dryer.tray_slot_count}</dd>
            </div>
            <div>
              <dt className="label-text">Batch Notes</dt>
              <dd className="whitespace-pre-wrap">
                {batch.notes || "No batch notes."}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="section-title">Freeze Dryer Slots</h3>
          <p className="text-sm text-slate-600">
            {isDraft
              ? "Select the Physical Trays used in this Production Batch."
              : "Setup is locked for this Production Batch."}
          </p>
        </div>

        {traySlots.length === 0 ? (
          <p className="mt-4 text-slate-600">
            This Freeze Dryer has no active Tray Slots configured.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Physical Tray</th>
                  <th>Product</th>
                  <th>Preparation</th>
                  <th>Starting Weight</th>
                  <th>Latest Weight</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {traySlots.map((traySlot) => {
                  const tray = batch.trays.find(
                    (batchTray) => batchTray.tray_slot_id === traySlot.id,
                  );
                  return (
                    <SlotSetupRow
                      batchId={batch.id}
                      editable={Boolean(isDraft)}
                      key={traySlot.id}
                      physicalTrays={activePhysicalTrays}
                      selectedPhysicalTrayIds={selectedPhysicalTrayIds}
                      onPhysicalTraySelectionChange={(
                        traySlotId,
                        physicalTrayId,
                      ) =>
                        setDraftPhysicalTraySelections((currentSelections) => ({
                          ...currentSelections,
                          [traySlotId]: physicalTrayId,
                        }))
                      }
                      tray={tray}
                      traySlot={traySlot}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {batch.status === "Running" || batch.status === "Completed" ? (
        <DryingWorkflowPanel
          activeDryingRun={activeDryingRun}
          allRunningTraysHaveLatestWeightCheck={
            allRunningTraysHaveLatestWeightCheck
          }
          allTraysComplete={allTraysComplete}
          batch={batch}
          completeBatch={() => completeBatch.mutate(batch.id)}
          completeDryingRun={(dryingRun) =>
            completeDryingRun.mutate({ id: dryingRun.id })
          }
          latestCompletedDryingRun={latestCompletedDryingRun}
          packagingOperation={packagingOperationQuery.data}
          packagingOperationError={packagingOperationQuery.error}
          packagingOperationLoading={packagingOperationQuery.isLoading}
          startDryingRun={() =>
            startDryingRun.mutate({ batchId: batch.id, body: {} })
          }
        />
      ) : null}

      <section className="flex flex-wrap gap-3">
        {isDraft ? (
          <button
            className="primary-action"
            disabled={
              startBatch.isPending ||
              !hasSelectedTrays ||
              !allTraysHaveStartingWeight
            }
            onClick={() => startBatch.mutate(batch.id)}
            type="button"
          >
            Start Production Batch
          </button>
        ) : null}
        {batch.status === "Draft" || batch.status === "Running" ? (
          <button
            className="danger-action"
            disabled={cancelBatch.isPending}
            onClick={() => {
              if (window.confirm("Cancel this Production Batch?")) {
                cancelBatch.mutate(batch.id);
              }
            }}
            type="button"
          >
            Cancel Batch
          </button>
        ) : null}
      </section>

      {isDraft && hasSelectedTrays && !allTraysHaveStartingWeight ? (
        <p className="text-sm text-slate-600">
          Enter a Starting Weight for every selected Tray before starting
          Production.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function SlotSetupRow({
  batchId,
  editable,
  physicalTrays,
  selectedPhysicalTrayIds,
  onPhysicalTraySelectionChange,
  tray,
  traySlot,
}: {
  batchId: string;
  editable: boolean;
  physicalTrays: PhysicalTray[];
  selectedPhysicalTrayIds: Set<string>;
  onPhysicalTraySelectionChange: (
    traySlotId: string,
    physicalTrayId: string,
  ) => void;
  tray?: Tray;
  traySlot: TraySlot;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(!tray);
  const [physicalTrayId, setPhysicalTrayId] = useState(
    tray?.physical_tray_id ?? "",
  );
  const [productName, setProductName] = useState(tray?.product_name ?? "");
  const [preparation, setPreparation] = useState(tray?.preparation ?? "");
  const initialStartingWeight = fromGramsForInput(
    tray?.starting_weight_grams ?? null,
  );
  const [startingWeight, setStartingWeight] = useState(
    initialStartingWeight.value,
  );
  const [startingWeightUnit, setStartingWeightUnit] = useState<WeightUnit>(
    initialStartingWeight.unit,
  );
  const [notes, setNotes] = useState(tray?.notes ?? "");
  const addTray = useMutation({
    mutationFn: productionApi.addTray,
    onSuccess: () => {
      setIsEditing(false);
      refreshBatch(queryClient, batchId);
    },
  });
  const updateTray = useMutation({
    mutationFn: productionApi.updateTray,
    onSuccess: () => {
      setIsEditing(false);
      refreshBatch(queryClient, batchId);
    },
  });
  const deleteTray = useMutation({
    mutationFn: productionApi.deleteTray,
    onSuccess: () => {
      onPhysicalTraySelectionChange(traySlot.id, "");
      refreshBatch(queryClient, batchId);
    },
  });

  const slotLabel = traySlot.label || `Slot ${traySlot.slot_number}`;
  const availablePhysicalTrays = physicalTrays.filter(
    (physicalTray) =>
      physicalTray.id === physicalTrayId ||
      physicalTray.id === tray?.physical_tray_id ||
      !selectedPhysicalTrayIds.has(physicalTray.id),
  );

  function handleSave() {
    const body = {
      tray_slot_id: traySlot.id,
      physical_tray_id: physicalTrayId,
      product_name: productName,
      preparation,
      starting_weight_grams: toGrams(startingWeight, startingWeightUnit),
      notes: notes.trim() === "" ? null : notes,
    };

    if (tray) {
      updateTray.mutate({ id: tray.id, body });
    } else {
      addTray.mutate({ batchId, body });
    }
  }

  if (!tray && !editable) {
    return (
      <tr>
        <td>{slotLabel}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>Empty</td>
        <td></td>
      </tr>
    );
  }

  if (editable && isEditing) {
    return (
      <tr>
        <td>{slotLabel}</td>
        <td>
          <select
            className="table-input"
            required
            value={physicalTrayId}
            onChange={(event) => {
              setPhysicalTrayId(event.target.value);
              onPhysicalTraySelectionChange(traySlot.id, event.target.value);
            }}
          >
            <option value="">Select Tray</option>
            {availablePhysicalTrays.map((physicalTray) => (
              <option key={physicalTray.id} value={physicalTray.id}>
                {physicalTray.label}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input
            className="table-input"
            required
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
          />
        </td>
        <td>
          <input
            className="table-input"
            required
            value={preparation}
            onChange={(event) => setPreparation(event.target.value)}
          />
        </td>
        <td>
          <WeightInput
            required
            unit={startingWeightUnit}
            value={startingWeight}
            onUnitChange={setStartingWeightUnit}
            onValueChange={setStartingWeight}
          />
        </td>
        <td>{tray ? formatGrams(tray.latest_weight_grams) : "-"}</td>
        <td>
          <input
            className="table-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </td>
        <td>{tray?.status ?? "Draft"}</td>
        <td className="flex gap-2">
          <button
            className="secondary-action"
            disabled={
              physicalTrayId === "" ||
              productName.trim() === "" ||
              preparation.trim() === "" ||
              startingWeight === "" ||
              addTray.isPending ||
              updateTray.isPending
            }
            onClick={handleSave}
            type="button"
          >
            Save
          </button>
          {tray ? (
            <button
              className="quiet-action"
              onClick={() => {
                setPhysicalTrayId(tray.physical_tray_id);
                onPhysicalTraySelectionChange(
                  traySlot.id,
                  tray.physical_tray_id,
                );
                setProductName(tray.product_name);
                setPreparation(tray.preparation);
                const friendlyWeight = fromGramsForInput(
                  tray.starting_weight_grams,
                );
                setStartingWeight(friendlyWeight.value);
                setStartingWeightUnit(friendlyWeight.unit);
                setNotes(tray.notes ?? "");
                setIsEditing(false);
              }}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </td>
      </tr>
    );
  }

  if (!tray) {
    return (
      <tr>
        <td>{slotLabel}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>Empty</td>
        <td>
          <button
            className="quiet-action"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            Select Tray
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{slotLabel}</td>
      <td>{tray.physical_tray.label}</td>
      <td>
        <Link className="text-link" to={`/trays/${tray.id}`}>
          {tray.product_name}
        </Link>
      </td>
      <td>{tray.preparation}</td>
      <td>
        {(editable && tray.status === "Draft") ||
        (tray.status === "Running" &&
          tray.starting_weight_grams === null &&
          tray.weight_checks.length === 0) ? (
          <StartingWeightCell batchId={batchId} tray={tray} />
        ) : (
          formatGrams(tray.starting_weight_grams)
        )}
      </td>
      <td>{formatGrams(tray.latest_weight_grams)}</td>
      <td>{tray.notes || "No notes"}</td>
      <td>{tray.status}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <Link className="quiet-action" to={`/trays/${tray.id}`}>
            View
          </Link>
          {editable && tray.status === "Draft" ? (
            <>
              <button
                className="quiet-action"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Edit
              </button>
              <button
                className="quiet-action"
                onClick={() => deleteTray.mutate(tray.id)}
                type="button"
              >
                Clear
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function StartingWeightCell({
  batchId,
  tray,
}: {
  batchId: string;
  tray: Tray;
}) {
  const queryClient = useQueryClient();
  const initialStartingWeight = fromGramsForInput(tray.starting_weight_grams);
  const [startingWeight, setStartingWeight] = useState(
    initialStartingWeight.value,
  );
  const [startingWeightUnit, setStartingWeightUnit] = useState<WeightUnit>(
    initialStartingWeight.unit,
  );
  const recordStartingWeight = useMutation({
    mutationFn: productionApi.recordStartingWeight,
    onSuccess: () => refreshBatch(queryClient, batchId),
  });

  return (
    <div className="flex min-w-36 gap-2">
      <WeightInput
        unit={startingWeightUnit}
        value={startingWeight}
        onUnitChange={setStartingWeightUnit}
        onValueChange={setStartingWeight}
      />
      <button
        className="quiet-action"
        disabled={startingWeight === "" || recordStartingWeight.isPending}
        onClick={() =>
          recordStartingWeight.mutate({
            id: tray.id,
            body: {
              starting_weight_grams: toGrams(
                startingWeight,
                startingWeightUnit,
              ),
            },
          })
        }
        type="button"
      >
        Save
      </button>
    </div>
  );
}

function DryingWorkflowPanel({
  activeDryingRun,
  allRunningTraysHaveLatestWeightCheck,
  allTraysComplete,
  batch,
  completeBatch,
  completeDryingRun,
  latestCompletedDryingRun,
  packagingOperation,
  packagingOperationError,
  packagingOperationLoading,
  startDryingRun,
}: {
  activeDryingRun?: DryingRun;
  allRunningTraysHaveLatestWeightCheck: boolean;
  allTraysComplete: boolean;
  batch: ProductionBatch;
  completeBatch: () => void;
  completeDryingRun: (dryingRun: DryingRun) => void;
  latestCompletedDryingRun?: DryingRun;
  packagingOperation: PackagingOperation | null | undefined;
  packagingOperationError: Error | null;
  packagingOperationLoading: boolean;
  startDryingRun: () => void;
}) {
  const runningTrays = batch.trays.filter((tray) => tray.status === "Running");
  const allRunningTraysHaveStartingWeight = runningTrays.every(
    (tray) => tray.starting_weight_grams !== null,
  );

  if (batch.status === "Completed") {
    const packagingAction =
      packagingOperation?.status === "Open"
        ? "Continue Packaging"
        : packagingOperation?.status === "Completed"
          ? "View Packaging"
          : "Start Packaging";

    return (
      <section className="panel">
        <h3 className="section-title">Drying Complete</h3>
        <p className="mt-2 text-slate-600">
          This Production Batch is complete and ready for Packaging.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Total drying time: {formatDuration(batch.total_drying_seconds)}
        </p>
        {packagingOperationError ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            Packaging status could not be loaded. Open Packaging to try again.
          </p>
        ) : null}
        {packagingOperationLoading ? (
          <p className="mt-4 text-sm text-slate-600">
            Loading Packaging status...
          </p>
        ) : (
          <Link
            className="primary-action mt-4"
            to={
              packagingOperation
                ? `/packaging?batch=${batch.id}&workspace=1`
                : `/packaging?batch=${batch.id}`
            }
          >
            {packagingAction}
          </Link>
        )}
      </section>
    );
  }

  if (activeDryingRun) {
    return (
      <section className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="section-title">Current Drying Run</h3>
            <p className="mt-2 text-sm text-slate-600">
              Started {formatDate(activeDryingRun.started_at)}
            </p>
          </div>
          <button
            className="primary-action"
            onClick={() => completeDryingRun(activeDryingRun)}
            type="button"
          >
            Current Run Complete
          </button>
        </div>
      </section>
    );
  }

  if (allTraysComplete) {
    return (
      <section className="panel">
        <h3 className="section-title">All Trays Complete</h3>
        <p className="mt-2 text-slate-600">
          Review the Batch before moving it to Packaging.
        </p>
        <button
          className="primary-action mt-4"
          onClick={completeBatch}
          type="button"
        >
          Complete Batch
        </button>
      </section>
    );
  }

  if (!latestCompletedDryingRun) {
    return (
      <section className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="section-title">Drying Progress</h3>
            <p className="mt-2 text-slate-600">
              {allRunningTraysHaveStartingWeight
                ? "No Drying Run is currently active."
                : "Enter missing Starting Weights before starting the next Drying Run."}
            </p>
          </div>
          {runningTrays.length > 0 ? (
            <button
              className="primary-action"
              disabled={!allRunningTraysHaveStartingWeight}
              onClick={startDryingRun}
              type="button"
            >
              Start Drying Run
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="section-title">Record Weight Checks</h3>
          <p className="mt-2 text-sm text-slate-600">
            Drying Run completed{" "}
            {formatDate(latestCompletedDryingRun.ended_at ?? "")}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Total drying time: {formatDuration(batch.total_drying_seconds)}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Product</th>
              <th>Last Weight</th>
              <th>New Weight</th>
              <th>Change</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batch.trays.map((tray) => (
              <WeightEntryRow
                batchId={batch.id}
                dryingRun={latestCompletedDryingRun}
                key={tray.id}
                tray={tray}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {runningTrays.length > 0 ? (
          <button
            className="secondary-action"
            disabled={!allRunningTraysHaveLatestWeightCheck}
            onClick={startDryingRun}
            type="button"
          >
            Start Another Drying Run
          </button>
        ) : null}
        {!allRunningTraysHaveLatestWeightCheck ? (
          <p className="self-center text-sm text-slate-600">
            Every Running Tray needs a Weight Check before another Drying Run.
          </p>
        ) : null}
      </div>
    </section>
  );
}

async function getBatchPackagingOperationOrNull(batchId: string) {
  try {
    return await packagingApi.getBatchPackagingOperation(batchId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function WeightEntryRow({
  batchId,
  dryingRun,
  tray,
}: {
  batchId: string;
  dryingRun: DryingRun;
  tray: Tray;
}) {
  const queryClient = useQueryClient();
  const existingCheck = tray.weight_checks.find(
    (check) => check.drying_run_id === dryingRun.id,
  );
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("g");
  const [notes, setNotes] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedWeight, setCorrectedWeight] = useState("");
  const [correctedWeightUnit, setCorrectedWeightUnit] =
    useState<WeightUnit>("g");
  const [correctionReason, setCorrectionReason] = useState("");
  const baselineWeight = existingCheck
    ? tray.previous_weight_grams
    : tray.latest_weight_grams;
  const newWeight =
    existingCheck?.weight_grams ??
    (weight === "" ? null : toGrams(weight, weightUnit));
  const recordWeightCheck = useMutation({
    mutationFn: productionApi.recordWeightCheck,
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const correctWeightCheck = useMutation({
    mutationFn: productionApi.correctWeightCheck,
    onSuccess: () => {
      setIsCorrecting(false);
      refreshBatch(queryClient, batchId);
    },
  });
  const hasLargeIncrease =
    baselineWeight !== null &&
    newWeight !== null &&
    newWeight !== "" &&
    Number(newWeight) > Number(baselineWeight) * 1.1;

  if (tray.status === "Completed") {
    return (
      <tr>
        <td>{tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`}</td>
        <td>{tray.product_name}</td>
        <td>{formatGrams(tray.final_dry_weight_grams)}</td>
        <td>Done</td>
        <td>
          {formatDifference(
            tray.previous_weight_grams,
            tray.latest_weight_grams,
          )}
        </td>
        <td>Completed</td>
        <td>
          <Link className="quiet-action" to={`/trays/${tray.id}`}>
            View
          </Link>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`}</td>
      <td>
        <Link className="text-link" to={`/trays/${tray.id}`}>
          {tray.product_name}
        </Link>
      </td>
      <td>{formatGrams(baselineWeight)}</td>
      <td>
        {existingCheck ? (
          isCorrecting ? (
            <div className="min-w-72 space-y-2">
              <WeightInput
                unit={correctedWeightUnit}
                value={correctedWeight}
                onUnitChange={setCorrectedWeightUnit}
                onValueChange={setCorrectedWeight}
              />
              <input
                aria-label="Correction reason"
                className="table-input"
                placeholder="reason (optional)"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="quiet-action"
                  disabled={
                    correctedWeight === "" || correctWeightCheck.isPending
                  }
                  onClick={() =>
                    correctWeightCheck.mutate({
                      id: existingCheck.id,
                      body: {
                        weight_grams: toGrams(
                          correctedWeight,
                          correctedWeightUnit,
                        ),
                        reason:
                          correctionReason.trim() === ""
                            ? null
                            : correctionReason.trim(),
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>{formatGrams(existingCheck.weight_grams)}</span>
              <button
                className="quiet-action"
                onClick={() => {
                  setCorrectedWeight(existingCheck.weight_grams);
                  setCorrectedWeightUnit("g");
                  setCorrectionReason("");
                  setIsCorrecting(true);
                }}
                type="button"
              >
                Correct
              </button>
            </div>
          )
        ) : (
          <div className="min-w-[30rem] space-y-2">
            <div className="grid grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.5fr)_auto] items-end gap-2">
              <div className="field">
                <span>Weight</span>
                <WeightInput
                  ariaLabel={`New weight for ${tray.product_name} in ${tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`}`}
                  placeholder="Enter weight"
                  unit={weightUnit}
                  value={weight}
                  onUnitChange={setWeightUnit}
                  onValueChange={setWeight}
                />
              </div>
              <label className="field">
                <span>Notes (optional)</span>
                <input
                  className="table-input"
                  placeholder="Production notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button
                className="quiet-action"
                disabled={weight === "" || recordWeightCheck.isPending}
                onClick={() =>
                  recordWeightCheck.mutate({
                    id: tray.id,
                    body: {
                      drying_run_id: dryingRun.id,
                      weight_grams: toGrams(weight, weightUnit),
                      observed_at: new Date().toISOString(),
                      notes: notes.trim() === "" ? null : notes,
                    },
                  })
                }
                type="button"
              >
                {recordWeightCheck.isPending ? "Saving..." : "Save Weight"}
              </button>
            </div>
            {weight === "" ? (
              <p className="text-xs text-slate-600">
                Enter a new weight to enable Save Weight.
              </p>
            ) : null}
            {hasLargeIncrease ? (
              <p className="text-sm font-medium text-red-700" role="alert">
                Check the value and unit: this is more than 10% above the last
                weight.
              </p>
            ) : null}
            {recordWeightCheck.isError ? (
              <p className="text-sm font-medium text-red-700" role="alert">
                Weight Check could not be saved.{" "}
                {recordWeightCheck.error.message}
              </p>
            ) : null}
          </div>
        )}
      </td>
      <td>{formatDifference(baselineWeight, newWeight)}</td>
      <td>{tray.status}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          {existingCheck ? (
            <CompleteTrayButton
              batchId={batchId}
              key={tray.latest_weight_grams}
              tray={tray}
            />
          ) : null}
          <Link className="quiet-action" to={`/trays/${tray.id}`}>
            View
          </Link>
        </div>
      </td>
    </tr>
  );
}

function CompleteTrayButton({
  batchId,
  tray,
}: {
  batchId: string;
  tray: Tray;
}) {
  const queryClient = useQueryClient();
  const [finalDryWeight, setFinalDryWeight] = useState(
    tray.latest_weight_grams ?? "",
  );
  const [finalDryWeightUnit, setFinalDryWeightUnit] = useState<WeightUnit>("g");
  const completeTray = useMutation({
    mutationFn: productionApi.completeTray,
    onSuccess: () => refreshBatch(queryClient, batchId),
  });

  return (
    <div className="flex min-w-40 gap-2">
      <WeightInput
        unit={finalDryWeightUnit}
        value={finalDryWeight}
        onUnitChange={setFinalDryWeightUnit}
        onValueChange={setFinalDryWeight}
      />
      <button
        className="quiet-action"
        disabled={finalDryWeight === "" || completeTray.isPending}
        onClick={() =>
          completeTray.mutate({
            id: tray.id,
            body: {
              final_dry_weight_grams: toGrams(
                finalDryWeight,
                finalDryWeightUnit,
              ),
            },
          })
        }
        type="button"
      >
        Mark Complete
      </button>
    </div>
  );
}

function WeightInput({
  ariaLabel,
  placeholder,
  required = false,
  unit,
  value,
  onUnitChange,
  onValueChange,
}: {
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
  unit: WeightUnit;
  value: string;
  onUnitChange: (unit: WeightUnit) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-40 gap-2">
      <input
        aria-label={ariaLabel}
        className="table-input"
        min="0"
        placeholder={placeholder ?? unit}
        required={required}
        step="0.001"
        type="number"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <select
        aria-label={ariaLabel ? `${ariaLabel} unit` : undefined}
        className="table-input"
        value={unit}
        onChange={(event) => onUnitChange(event.target.value as WeightUnit)}
      >
        {WEIGHT_UNIT_OPTIONS.map((weightUnit) => (
          <option key={weightUnit.value} value={weightUnit.value}>
            {weightUnit.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function refreshBatch(
  queryClient: ReturnType<typeof useQueryClient>,
  batchId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["production-batch", batchId],
  });
  void queryClient.invalidateQueries({ queryKey: ["production-batches"] });
}

function formatDate(value: string) {
  if (value === "") return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDifference(previous: string | null, next: string | null) {
  if (previous === null || next === null || next === "") return "-";
  const difference = Number(next) - Number(previous);
  const prefix = difference > 0 ? "+" : "";
  return `${prefix}${difference.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} g`;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "0 h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

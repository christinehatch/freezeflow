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
import {
  Button,
  Field,
  NumberField,
  Select,
  StatusBadge,
  TextField,
} from "../components/design-system";

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
  const completedTrayCount =
    batch?.trays.filter((tray) => tray.status === "Completed").length ?? 0;
  const runningTrayCount = runningTrays.length;
  const weightCheckCardsAvailable = Boolean(
    batch?.status === "Running" &&
    !activeDryingRun &&
    !allTraysComplete &&
    latestCompletedDryingRun,
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
    <div className="production-batch-page">
      <nav className="production-breadcrumbs">
        <Link className="text-link" to="/">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link className="text-link" to="/production">
          Production
        </Link>{" "}
        / {batch.batch_number}
      </nav>

      <header className="workspace-header production-batch-header">
        <div className="production-batch-header__copy">
          <h2>{batch.batch_number}</h2>
          <div className="production-batch-header__metadata">
            <StatusBadge tone={batchStatusTone(batch.status)}>
              {batch.status}
            </StatusBadge>
            <span className="production-batch-header__meta-item">
              <CalendarIcon />
              {batch.started_at
                ? `Started ${formatDate(batch.started_at)}`
                : "Not started"}
            </span>
            <span aria-hidden="true" className="production-batch-header__dot">
              •
            </span>
            <span>Freeze Dryer: {batch.freeze_dryer.name}</span>
            <span aria-hidden="true" className="production-batch-header__dot">
              •
            </span>
            <span>{batch.freeze_dryer.tray_slot_count} Tray Slots</span>
          </div>
        </div>
        {isDraft && !isEditingBatch ? (
          <Button
            variant="secondary"
            onClick={() => {
              setBatchFreezeDryerId(batch.freeze_dryer_id);
              setBatchNotes(batch.notes ?? "");
              setIsEditingBatch(true);
              setError(null);
            }}
            type="button"
          >
            Edit Batch
          </Button>
        ) : null}
      </header>

      <div className="production-overview-grid">
        <section className="panel production-section-card production-setup-card">
          <div className="production-section-card__header">
            <h3 className="section-title">Batch Setup</h3>
            <p>
              <LockIcon />
              {isDraft
                ? "Setup can be edited until Production starts."
                : "Setup is locked for this Production Batch."}
            </p>
          </div>

          {isEditingBatch ? (
            <form
              className="production-setup-form"
              onSubmit={handleBatchUpdate}
            >
              <Field htmlFor="batch-freeze-dryer" label="Freeze Dryer">
                <Select
                  id="batch-freeze-dryer"
                  onChange={setBatchFreezeDryerId}
                  options={selectableFreezeDryers.map((freezeDryer) => ({
                    label: freezeDryer.name,
                    value: freezeDryer.id,
                  }))}
                  value={batchFreezeDryerId}
                />
              </Field>
              <Field htmlFor="batch-notes" label="Batch Notes">
                <TextField
                  id="batch-notes"
                  value={batchNotes}
                  onChange={(event) => setBatchNotes(event.target.value)}
                />
              </Field>
              <div className="production-setup-form__actions">
                <Button disabled={updateBatch.isPending} type="submit">
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setIsEditingBatch(false);
                    setError(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <dl className="production-setup-facts">
              <div>
                <dt>Freeze Dryer</dt>
                <dd>{batch.freeze_dryer.name}</dd>
              </div>
              <div>
                <dt>Tray Slots</dt>
                <dd>{batch.freeze_dryer.tray_slot_count}</dd>
              </div>
              <div>
                <dt>Batch Notes</dt>
                <dd>{batch.notes || "No batch notes."}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="panel production-section-card production-progress-card">
          <div className="production-section-card__header">
            <h3 className="section-title">Batch Progress</h3>
          </div>
          <dl className="production-progress-facts">
            <ProgressFact label="Total Trays" value={batch.trays.length} />
            <ProgressFact label="Trays Complete" value={completedTrayCount} />
            <ProgressFact label="Trays Running" value={runningTrayCount} />
            <ProgressFact
              label="Total Drying Time"
              value={formatDuration(batch.total_drying_seconds)}
            />
          </dl>
          <div
            aria-label={`${completedTrayCount} of ${batch.trays.length} Trays complete`}
            className="production-tray-progress"
          >
            {batch.trays.map((tray) => (
              <span
                className={`production-tray-progress__segment production-tray-progress__segment--${tray.status.toLowerCase()}`}
                key={tray.id}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="panel production-section-card production-slots-card">
        <div className="production-section-card__header">
          <h3 className="section-title">Freeze Dryer Slots</h3>
          <p>
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
          <div className="production-slot-table-wrap">
            <table className="data-table production-slot-table">
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
                      weightCheckTargetAvailable={weightCheckCardsAvailable}
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
  weightCheckTargetAvailable,
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
  weightCheckTargetAvailable: boolean;
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
        <td>
          <TrayStatus status="Empty" />
        </td>
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
        <td>
          <TrayStatus status={tray?.status ?? "Draft"} />
        </td>
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
        <td>
          <TrayStatus status="Empty" />
        </td>
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
      <td>
        <TrayStatus status={tray.status} />
      </td>
      <td>
        <div className="flex flex-wrap gap-2">
          {weightCheckTargetAvailable ? (
            <a
              aria-label={`View Weight Check for ${tray.product_name}`}
              className="secondary-action production-slot-view"
              href={`#${weightCheckTargetId(tray.id)}`}
            >
              View
            </a>
          ) : (
            <Link
              className="secondary-action production-slot-view"
              to={`/trays/${tray.id}`}
            >
              View
            </Link>
          )}
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

      <div className="production-weight-list" role="list">
        {batch.trays.map((tray) => (
          <WeightEntryCard
            batchId={batch.id}
            dryingRun={latestCompletedDryingRun}
            key={tray.id}
            tray={tray}
          />
        ))}
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

function WeightEntryCard({
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
      <article
        aria-label={`${tray.product_name}, completed`}
        className="production-weight-card production-weight-card--completed"
        id={weightCheckTargetId(tray.id)}
        role="listitem"
        tabIndex={-1}
      >
        <div className="production-weight-card__identity">
          <p className="production-weight-card__eyebrow">
            {traySlotLabel(tray)}
          </p>
          <p className="production-weight-card__product">{tray.product_name}</p>
        </div>
        <div className="production-weight-card__completed-summary">
          <span>{formatGrams(tray.final_dry_weight_grams)}</span>
          <span>
            {formatDifference(
              tray.previous_weight_grams,
              tray.latest_weight_grams,
            )}{" "}
            change
          </span>
        </div>
        <StatusBadge tone="success">Completed</StatusBadge>
        <Link className="quiet-action" to={`/trays/${tray.id}`}>
          View history
        </Link>
      </article>
    );
  }

  return (
    <article
      aria-label={`${tray.product_name}, ${traySlotLabel(tray)}`}
      className="production-weight-card"
      id={weightCheckTargetId(tray.id)}
      role="listitem"
      tabIndex={-1}
    >
      <header className="production-weight-card__header">
        <div className="production-weight-card__identity">
          <p className="production-weight-card__eyebrow">
            {traySlotLabel(tray)}
          </p>
          <Link className="text-link" to={`/trays/${tray.id}`}>
            {tray.product_name}
          </Link>
        </div>
        <StatusBadge tone="active">{tray.status}</StatusBadge>
      </header>

      <dl className="production-weight-card__metrics">
        <WeightMetric label="Last Weight" value={formatGrams(baselineWeight)} />
        <WeightMetric
          label="New Weight"
          value={
            existingCheck
              ? formatGrams(existingCheck.weight_grams)
              : "Not recorded"
          }
        />
        <WeightMetric
          label="Change"
          value={formatDifference(baselineWeight, newWeight)}
        />
      </dl>

      {existingCheck ? (
        isCorrecting ? (
          <div className="production-weight-card__correction">
            <Field
              htmlFor={`correction-weight-${tray.id}`}
              label="Corrected Weight"
            >
              <DesignSystemWeightInput
                ariaLabel={`Corrected Weight for ${tray.product_name} in ${traySlotLabel(tray)}`}
                id={`correction-weight-${tray.id}`}
                unit={correctedWeightUnit}
                value={correctedWeight}
                onUnitChange={setCorrectedWeightUnit}
                onValueChange={setCorrectedWeight}
              />
            </Field>
            <Field
              htmlFor={`correction-reason-${tray.id}`}
              label="Correction reason"
              optional
            >
              <TextField
                id={`correction-reason-${tray.id}`}
                placeholder="reason (optional)"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              />
            </Field>
            <div className="production-weight-card__form-actions">
              <Button
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
              </Button>
              <Button
                onClick={() => setIsCorrecting(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="production-weight-card__completion">
            <CompleteTrayButton
              batchId={batchId}
              key={tray.latest_weight_grams}
              tray={tray}
            />
            <div className="production-weight-card__secondary-actions">
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
              <Link className="quiet-action" to={`/trays/${tray.id}`}>
                View history
              </Link>
            </div>
          </div>
        )
      ) : (
        <form
          className="production-weight-card__entry"
          onSubmit={(event) => {
            event.preventDefault();
            if (weight === "" || recordWeightCheck.isPending) return;
            recordWeightCheck.mutate({
              id: tray.id,
              body: {
                drying_run_id: dryingRun.id,
                weight_grams: toGrams(weight, weightUnit),
                observed_at: new Date().toISOString(),
                notes: notes.trim() === "" ? null : notes,
              },
            });
          }}
        >
          <Field htmlFor={`new-weight-${tray.id}`} label="New Weight">
            <DesignSystemWeightInput
              ariaLabel={`New weight for ${tray.product_name} in ${traySlotLabel(tray)}`}
              id={`new-weight-${tray.id}`}
              placeholder="Enter weight"
              unit={weightUnit}
              value={weight}
              onUnitChange={setWeightUnit}
              onValueChange={setWeight}
            />
          </Field>
          <Field htmlFor={`weight-notes-${tray.id}`} label="Notes" optional>
            <TextField
              id={`weight-notes-${tray.id}`}
              placeholder="Production notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <Button
            disabled={weight === "" || recordWeightCheck.isPending}
            type="submit"
          >
            {recordWeightCheck.isPending ? "Saving..." : "Save Weight"}
          </Button>
          <div className="production-weight-card__messages">
            {weight === "" ? (
              <p>Enter a new weight to enable Save Weight.</p>
            ) : null}
            {hasLargeIncrease ? (
              <p className="production-weight-card__error" role="alert">
                Check the value and unit: this is more than 10% above the last
                weight.
              </p>
            ) : null}
            {recordWeightCheck.isError ? (
              <p className="production-weight-card__error" role="alert">
                Weight Check could not be saved.{" "}
                {recordWeightCheck.error.message}
              </p>
            ) : null}
          </div>
        </form>
      )}
    </article>
  );
}

function WeightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="production-weight-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProgressFact({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TrayStatus({ status }: { status: string }) {
  return (
    <span className="production-tray-status">
      <span
        aria-hidden="true"
        className={`production-tray-status__dot production-tray-status__dot--${status.toLowerCase()}`}
      />
      {status}
    </span>
  );
}

function batchStatusTone(status: string) {
  if (status === "Running") return "active" as const;
  if (status === "Completed") return "success" as const;
  if (status === "Cancelled") return "danger" as const;
  return "neutral" as const;
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <rect height="11" rx="2" stroke="currentColor" width="12" x="2" y="3" />
      <path d="M5 1.75v2.5M11 1.75v2.5M2 6h12" stroke="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 16 16"
      width="15"
    >
      <rect height="7" rx="1.5" stroke="currentColor" width="10" x="3" y="7" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" />
    </svg>
  );
}

function traySlotLabel(tray: Tray) {
  return tray.tray_slot.label || `Slot ${tray.tray_slot.slot_number}`;
}

function weightCheckTargetId(trayId: string) {
  return `weight-check-${trayId}`;
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
    <div className="production-complete-tray">
      <Field
        htmlFor={`finished-weight-${tray.id}`}
        label="Finished Product Weight"
      >
        <DesignSystemWeightInput
          ariaLabel={`Finished Product Weight for ${tray.product_name} in ${traySlotLabel(tray)}`}
          id={`finished-weight-${tray.id}`}
          unit={finalDryWeightUnit}
          value={finalDryWeight}
          onUnitChange={setFinalDryWeightUnit}
          onValueChange={setFinalDryWeight}
        />
      </Field>
      <Button
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
        {completeTray.isPending ? "Completing..." : "Mark Complete"}
      </Button>
    </div>
  );
}

function DesignSystemWeightInput({
  ariaLabel,
  id,
  placeholder,
  unit,
  value,
  onUnitChange,
  onValueChange,
}: {
  ariaLabel?: string;
  id: string;
  placeholder?: string;
  unit: WeightUnit;
  value: string;
  onUnitChange: (unit: WeightUnit) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="production-weight-input">
      <NumberField
        aria-label={ariaLabel}
        id={id}
        min="0"
        placeholder={placeholder}
        step="0.001"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Select
        aria-label={ariaLabel ? `${ariaLabel} unit` : "Weight unit"}
        className="production-weight-input__unit"
        id={`${id}-unit`}
        onChange={(nextUnit) => onUnitChange(nextUnit as WeightUnit)}
        options={WEIGHT_UNIT_OPTIONS.map((weightUnit) => ({
          label: weightUnit.label,
          value: weightUnit.value,
        }))}
        value={unit}
      />
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

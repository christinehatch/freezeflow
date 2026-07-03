import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router";

import { PhysicalTray, Tray, TraySlot, productionApi } from "../api/client";

export function ProductionBatchPage() {
  const { batchId } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [batchFreezeDryerId, setBatchFreezeDryerId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const batchQuery = useQuery({
    queryKey: ["production-batch", batchId],
    queryFn: () => productionApi.getProductionBatch(batchId ?? ""),
    enabled: Boolean(batchId),
  });
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const physicalTraysQuery = useQuery({
    queryKey: ["physical-trays"],
    queryFn: productionApi.listPhysicalTrays,
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
  const activePhysicalTrays = physicalTrays.filter(
    (physicalTray) => !physicalTray.archived,
  );
  const selectableFreezeDryers = freezeDryers.filter(
    (freezeDryer) =>
      !freezeDryer.archived || freezeDryer.id === batch?.freeze_dryer_id,
  );
  const traySlots =
    batch?.freeze_dryer.tray_slots
      .filter((traySlot) => !traySlot.archived)
      .sort((a, b) => a.slot_number - b.slot_number) ?? [];
  const selectedPhysicalTrayIds = new Set(
    batch?.trays.map((tray) => tray.physical_tray_id) ?? [],
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

      <section className="flex flex-wrap gap-3">
        {isDraft ? (
          <button
            className="primary-action"
            disabled={startBatch.isPending}
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

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function SlotSetupRow({
  batchId,
  editable,
  physicalTrays,
  selectedPhysicalTrayIds,
  tray,
  traySlot,
}: {
  batchId: string;
  editable: boolean;
  physicalTrays: PhysicalTray[];
  selectedPhysicalTrayIds: Set<string>;
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
  const [notes, setNotes] = useState(tray?.notes ?? "");
  const addTray = useMutation({
    mutationFn: productionApi.addTray,
    onSuccess: () => refreshBatch(queryClient, batchId),
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
    onSuccess: () => refreshBatch(queryClient, batchId),
  });

  const slotLabel = traySlot.label || `Slot ${traySlot.slot_number}`;
  const availablePhysicalTrays = physicalTrays.filter(
    (physicalTray) =>
      physicalTray.id === tray?.physical_tray_id ||
      !selectedPhysicalTrayIds.has(physicalTray.id),
  );

  function handleSave() {
    const body = {
      tray_slot_id: traySlot.id,
      physical_tray_id: physicalTrayId,
      product_name: productName,
      preparation,
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
            onChange={(event) => setPhysicalTrayId(event.target.value)}
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
                setProductName(tray.product_name);
                setPreparation(tray.preparation);
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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

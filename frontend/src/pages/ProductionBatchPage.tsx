import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router";

import { Tray, productionApi } from "../api/client";

export function ProductionBatchPage() {
  const { batchId } = useParams();
  const queryClient = useQueryClient();
  const [trayNumber, setTrayNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [preparation, setPreparation] = useState("");
  const [notes, setNotes] = useState("");
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
  const addTray = useMutation({
    mutationFn: productionApi.addTray,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setTrayNumber("");
      setProductName("");
      setPreparation("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({
        queryKey: ["production-batch", batchId],
      });
      void queryClient.invalidateQueries({ queryKey: ["production-batches"] });
    },
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
  const selectableFreezeDryers = freezeDryers.filter(
    (freezeDryer) =>
      !freezeDryer.archived || freezeDryer.id === batch?.freeze_dryer_id,
  );

  function handleAddTray(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batchId) return;
    addTray.mutate({
      batchId,
      body: {
        tray_number: Number(trayNumber),
        product_name: productName,
        preparation,
        notes: notes.trim() === "" ? null : notes,
      },
    });
  }

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
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="label-text">Freeze Dryer</dt>
              <dd>{batch.freeze_dryer.name}</dd>
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
          <h3 className="section-title">Trays</h3>
          <p className="text-sm text-slate-600">
            {isDraft
              ? "Add trays before starting production."
              : "Setup is locked for this Production Batch."}
          </p>
        </div>

        {batch.trays.length === 0 ? (
          <p className="mt-4 text-slate-600">
            No Trays have been added to this Draft Production Batch.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tray</th>
                  <th>Product</th>
                  <th>Preparation Summary</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batch.trays.map((tray) => (
                  <TrayRow
                    batchId={batch.id}
                    editable={isDraft && tray.status === "Draft"}
                    key={tray.id}
                    tray={tray}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isDraft ? (
          <form
            className="mt-6 grid gap-4 md:grid-cols-[8rem_1fr_2fr_1fr_auto]"
            onSubmit={handleAddTray}
          >
            <label className="field">
              <span>Tray</span>
              <input
                min="1"
                required
                type="number"
                value={trayNumber}
                onChange={(event) => setTrayNumber(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Product</span>
              <input
                required
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Preparation</span>
              <input
                required
                value={preparation}
                onChange={(event) => setPreparation(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <button className="secondary-action self-end" type="submit">
              + Add Tray
            </button>
          </form>
        ) : null}
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

function TrayRow({
  batchId,
  editable,
  tray,
}: {
  batchId: string;
  editable: boolean;
  tray: Tray;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [trayNumber, setTrayNumber] = useState(String(tray.tray_number));
  const [productName, setProductName] = useState(tray.product_name);
  const [preparation, setPreparation] = useState(tray.preparation);
  const [notes, setNotes] = useState(tray.notes ?? "");
  const updateTray = useMutation({
    mutationFn: productionApi.updateTray,
    onSuccess: () => refreshBatch(queryClient, batchId),
  });
  const deleteTray = useMutation({
    mutationFn: productionApi.deleteTray,
    onSuccess: () => refreshBatch(queryClient, batchId),
  });

  if (isEditing) {
    return (
      <tr>
        <td>
          <input
            className="table-input"
            type="number"
            value={trayNumber}
            onChange={(event) => setTrayNumber(event.target.value)}
          />
        </td>
        <td>
          <input
            className="table-input"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
          />
        </td>
        <td>
          <input
            className="table-input"
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
        <td>{tray.status}</td>
        <td className="flex gap-2">
          <button
            className="secondary-action"
            onClick={() => {
              updateTray.mutate({
                id: tray.id,
                body: {
                  tray_number: Number(trayNumber),
                  product_name: productName,
                  preparation,
                  notes: notes.trim() === "" ? null : notes,
                },
              });
              setIsEditing(false);
            }}
            type="button"
          >
            Save
          </button>
          <button
            className="quiet-action"
            onClick={() => setIsEditing(false)}
            type="button"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{tray.tray_number}</td>
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
          {editable ? (
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
                Remove
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link } from "react-router";

import { FreezeDryer, ProductionBatch, productionApi } from "../api/client";

export function FreezeDryersPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const saveFreezeDryer = useMutation({
    mutationFn: productionApi.createFreezeDryer,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setName("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
    },
  });
  const freezeDryers = freezeDryersQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const activeBatches = batches.filter((batch) => batch.status === "Running");
  const activeDryers = freezeDryers.filter(
    (freezeDryer) => !freezeDryer.archived,
  );
  const archivedDryers = freezeDryers.filter(
    (freezeDryer) => freezeDryer.archived,
  );

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveFreezeDryer.mutate({
      name,
      notes: notes.trim() === "" ? null : notes,
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-semibold">Freeze Dryers</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Manage the physical machines available for production.
        </p>
      </section>

      <form
        className="panel grid gap-4 md:grid-cols-[1fr_2fr_auto]"
        onSubmit={handleCreate}
      >
        <label className="field">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          className="primary-action self-end"
          disabled={saveFreezeDryer.isPending}
          type="submit"
        >
          + New Freeze Dryer
        </button>
        {error ? (
          <p className="md:col-span-3 text-sm text-red-700">{error}</p>
        ) : null}
      </form>

      <section>
        <h3 className="section-title">Active Freeze Dryers</h3>
        {activeDryers.length === 0 ? (
          <div className="empty-state mt-3">
            No active Freeze Dryers have been created.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {activeDryers.map((freezeDryer) => (
              <FreezeDryerCard
                activeBatch={activeBatches.find(
                  (batch) => batch.freeze_dryer_id === freezeDryer.id,
                )}
                freezeDryer={freezeDryer}
                key={freezeDryer.id}
              />
            ))}
          </div>
        )}
      </section>

      {archivedDryers.length > 0 ? (
        <section className="panel">
          <h3 className="section-title">Archived Freeze Dryers</h3>
          <div className="mt-3 space-y-3">
            {archivedDryers.map((freezeDryer) => (
              <ArchivedFreezeDryerRow
                freezeDryer={freezeDryer}
                key={freezeDryer.id}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FreezeDryerCard({
  activeBatch,
  freezeDryer,
}: {
  activeBatch?: ProductionBatch;
  freezeDryer: FreezeDryer;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(freezeDryer.name);
  const [notes, setNotes] = useState(freezeDryer.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateFreezeDryer = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; notes?: string | null; archived?: boolean };
    }) => productionApi.updateFreezeDryer(id, body),
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setError(null);
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
    },
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFreezeDryer.mutate({
      id: freezeDryer.id,
      body: {
        name,
        notes: notes.trim() === "" ? null : notes,
      },
    });
  }

  if (isEditing) {
    return (
      <article className="object-card">
        <form className="space-y-4" onSubmit={handleSave}>
          <label className="field">
            <span>Name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="secondary-action"
              disabled={updateFreezeDryer.isPending}
              type="submit"
            >
              Save
            </button>
            <button
              className="quiet-action"
              onClick={() => {
                setName(freezeDryer.name);
                setNotes(freezeDryer.notes ?? "");
                setIsEditing(false);
                setError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
      </article>
    );
  }

  return (
    <article className="object-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">{freezeDryer.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {freezeDryer.notes || "No notes"}
          </p>
        </div>
        <span className={activeBatch ? "pill-running" : "pill-idle"}>
          {activeBatch ? "Running" : "Idle"}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-700">
        {activeBatch
          ? `Active Batch: ${activeBatch.batch_number}`
          : "No active Production Batch"}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {activeBatch ? (
          <Link className="secondary-action" to={`/production/${activeBatch.id}`}>
            Open Current Batch
          </Link>
        ) : (
          <Link
            className="secondary-action"
            to={`/production?freezeDryerId=${freezeDryer.id}`}
          >
            Create Production Batch
          </Link>
        )}
        <button
          className="quiet-action"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          Edit
        </button>
        <button
          className="quiet-action"
          disabled={updateFreezeDryer.isPending}
          onClick={() =>
            updateFreezeDryer.mutate({
              id: freezeDryer.id,
              body: { archived: true },
            })
          }
          type="button"
        >
          Archive
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </article>
  );
}

function ArchivedFreezeDryerRow({ freezeDryer }: { freezeDryer: FreezeDryer }) {
  const queryClient = useQueryClient();
  const restoreFreezeDryer = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { archived: boolean };
    }) => productionApi.updateFreezeDryer(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
    },
  });

  return (
    <div className="row-line">
      <span>{freezeDryer.name}</span>
      <button
        className="secondary-action"
        onClick={() =>
          restoreFreezeDryer.mutate({
            id: freezeDryer.id,
            body: { archived: false },
          })
        }
        type="button"
      >
        Restore
      </button>
    </div>
  );
}

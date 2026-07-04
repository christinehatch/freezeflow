import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link } from "react-router";

import {
  FreezeDryer,
  PhysicalTray,
  ProductionBatch,
  productionApi,
} from "../api/client";
import {
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  toGrams,
} from "../utils/weights";

export function FreezeDryersPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [traySlotCount, setTraySlotCount] = useState("4");
  const [physicalTrayLabel, setPhysicalTrayLabel] = useState("");
  const [physicalTrayTareWeight, setPhysicalTrayTareWeight] = useState("");
  const [physicalTrayTareWeightUnit, setPhysicalTrayTareWeightUnit] =
    useState<WeightUnit>("g");
  const [physicalTrayNotes, setPhysicalTrayNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const physicalTraysQuery = useQuery({
    queryKey: ["physical-trays"],
    queryFn: productionApi.listPhysicalTrays,
  });
  const saveFreezeDryer = useMutation({
    mutationFn: productionApi.createFreezeDryer,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setName("");
      setNotes("");
      setTraySlotCount("4");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
    },
  });
  const savePhysicalTray = useMutation({
    mutationFn: productionApi.createPhysicalTray,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: () => {
      setPhysicalTrayLabel("");
      setPhysicalTrayTareWeight("");
      setPhysicalTrayTareWeightUnit("g");
      setPhysicalTrayNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["physical-trays"] });
    },
  });
  const freezeDryers = freezeDryersQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const physicalTrays = physicalTraysQuery.data ?? [];
  const activeBatches = batches.filter((batch) => batch.status === "Running");
  const draftBatches = batches.filter((batch) => batch.status === "Draft");
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
      tray_slot_count: Number(traySlotCount),
    });
  }

  function handleCreatePhysicalTray(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    savePhysicalTray.mutate({
      label: physicalTrayLabel,
      tare_weight_grams:
        physicalTrayTareWeight === ""
          ? null
          : toGrams(physicalTrayTareWeight, physicalTrayTareWeightUnit),
      notes: physicalTrayNotes.trim() === "" ? null : physicalTrayNotes,
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
        className="panel grid gap-4 md:grid-cols-[1fr_8rem_2fr_auto]"
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
          <span>Tray Slots</span>
          <input
            min="1"
            required
            type="number"
            value={traySlotCount}
            onChange={(event) => setTraySlotCount(event.target.value)}
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
          <p className="md:col-span-4 text-sm text-red-700">{error}</p>
        ) : null}
      </form>

      <section className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Physical Trays</h3>
            <p className="mt-2 text-sm text-slate-600">
              Reusable trays owned by the client. They can be selected for any
              Freeze Dryer slot during Production Batch setup. Tare Weight is
              reusable tray setup; production food weights are recorded on the
              selected slot inside a Production Batch.
            </p>
          </div>
        </div>
        <form
          className="mt-4 grid gap-4 md:grid-cols-[1fr_10rem_2fr_auto]"
          onSubmit={handleCreatePhysicalTray}
        >
          <label className="field">
            <span>Label</span>
            <input
              required
              value={physicalTrayLabel}
              onChange={(event) => setPhysicalTrayLabel(event.target.value)}
              placeholder="Tray 1"
            />
          </label>
          <label className="field">
            <span>Tare Weight</span>
            <WeightInput
              unit={physicalTrayTareWeightUnit}
              value={physicalTrayTareWeight}
              onUnitChange={setPhysicalTrayTareWeightUnit}
              onValueChange={setPhysicalTrayTareWeight}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <input
              value={physicalTrayNotes}
              onChange={(event) => setPhysicalTrayNotes(event.target.value)}
            />
          </label>
          <button
            className="secondary-action self-end"
            disabled={savePhysicalTray.isPending}
            type="submit"
          >
            + Add Physical Tray
          </button>
        </form>
        {physicalTrays.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No Physical Trays have been created.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {physicalTrays.map((physicalTray) => (
              <PhysicalTrayRow
                key={physicalTray.id}
                physicalTray={physicalTray}
              />
            ))}
          </div>
        )}
      </section>

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
                queuedBatch={draftBatches.find(
                  (batch) => batch.freeze_dryer_id === freezeDryer.id,
                )}
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
  queuedBatch,
}: {
  activeBatch?: ProductionBatch;
  freezeDryer: FreezeDryer;
  queuedBatch?: ProductionBatch;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(freezeDryer.name);
  const [notes, setNotes] = useState(freezeDryer.notes ?? "");
  const [traySlotCount, setTraySlotCount] = useState(
    String(freezeDryer.tray_slot_count),
  );
  const [error, setError] = useState<string | null>(null);
  const updateFreezeDryer = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        name?: string;
        notes?: string | null;
        archived?: boolean;
        tray_slot_count?: number;
      };
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
        tray_slot_count: Number(traySlotCount),
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
          <label className="field">
            <span>Tray Slots</span>
            <input
              min="1"
              required
              type="number"
              value={traySlotCount}
              onChange={(event) => setTraySlotCount(event.target.value)}
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
                setTraySlotCount(String(freezeDryer.tray_slot_count));
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
          <p className="mt-2 text-sm text-slate-600">
            {freezeDryer.tray_slot_count} Tray Slots
          </p>
        </div>
        <span className={activeBatch ? "pill-running" : "pill-idle"}>
          {activeBatch ? "Running" : queuedBatch ? "Queued" : "Idle"}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-700">
        {activeBatch
          ? `Active Batch: ${activeBatch.batch_number}`
          : queuedBatch
            ? `Queued Batch: ${queuedBatch.batch_number}`
            : "No active Production Batch"}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {activeBatch ? (
          <Link
            className="secondary-action"
            to={`/production/${activeBatch.id}`}
          >
            Open Current Batch
          </Link>
        ) : queuedBatch ? (
          <Link
            className="secondary-action"
            to={`/production/${queuedBatch.id}`}
          >
            Continue / Start Batch
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
    mutationFn: ({ id, body }: { id: string; body: { archived: boolean } }) =>
      productionApi.updateFreezeDryer(id, body),
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

function PhysicalTrayRow({ physicalTray }: { physicalTray: PhysicalTray }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(physicalTray.label);
  const [tareWeight, setTareWeight] = useState(
    physicalTray.tare_weight_grams ?? "",
  );
  const [tareWeightUnit, setTareWeightUnit] = useState<WeightUnit>("g");
  const [notes, setNotes] = useState(physicalTray.notes ?? "");
  const updatePhysicalTray = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        label?: string;
        tare_weight_grams?: string | null;
        notes?: string | null;
        archived?: boolean;
      };
    }) => productionApi.updatePhysicalTray(id, body),
    onSuccess: () => {
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["physical-trays"] });
    },
  });

  if (isEditing) {
    return (
      <form
        className="rounded-md border border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          updatePhysicalTray.mutate({
            id: physicalTray.id,
            body: {
              label,
              tare_weight_grams:
                tareWeight === "" ? null : toGrams(tareWeight, tareWeightUnit),
              notes: notes.trim() === "" ? null : notes,
            },
          });
        }}
      >
        <label className="field">
          <span>Label</span>
          <input
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label className="field mt-3">
          <span>Tare Weight</span>
          <WeightInput
            unit={tareWeightUnit}
            value={tareWeight}
            onUnitChange={setTareWeightUnit}
            onValueChange={setTareWeight}
          />
        </label>
        <label className="field mt-3">
          <span>Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button className="secondary-action" type="submit">
            Save
          </button>
          <button
            className="quiet-action"
            onClick={() => {
              setLabel(physicalTray.label);
              setTareWeight(physicalTray.tare_weight_grams ?? "");
              setTareWeightUnit("g");
              setNotes(physicalTray.notes ?? "");
              setIsEditing(false);
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="row-line">
      <div>
        <p className="font-semibold">{physicalTray.label}</p>
        <p className="text-sm text-slate-600">
          Tare Weight: {formatGrams(physicalTray.tare_weight_grams, 3)}
        </p>
        <p className="text-sm text-slate-600">
          {physicalTray.notes || "No notes"}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className="quiet-action"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          Edit
        </button>
        <button
          className="quiet-action"
          disabled={updatePhysicalTray.isPending}
          onClick={() =>
            updatePhysicalTray.mutate({
              id: physicalTray.id,
              body: { archived: !physicalTray.archived },
            })
          }
          type="button"
        >
          {physicalTray.archived ? "Restore" : "Archive"}
        </button>
      </div>
    </div>
  );
}

function WeightInput({
  unit,
  value,
  onUnitChange,
  onValueChange,
}: {
  unit: WeightUnit;
  value: string;
  onUnitChange: (unit: WeightUnit) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        className="table-input"
        min="0"
        placeholder={unit}
        step="0.001"
        type="number"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <select
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

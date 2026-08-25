import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { productionApi } from "../api/client";
import { ButtonLink } from "../components/design-system";

export function ProductionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const activeFreezeDryers =
    freezeDryersQuery.data?.filter((freezeDryer) => !freezeDryer.archived) ??
    [];
  const batches = batchesQuery.data;
  const productionBatches = useMemo(() => batches ?? [], [batches]);
  const [freezeDryerId, setFreezeDryerId] = useState(
    searchParams.get("freezeDryerId") ?? "",
  );
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createBatch = useMutation({
    mutationFn: productionApi.createProductionBatch,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onSuccess: (batch) => {
      setBatchNumber("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      void navigate(`/production/${batch.id}`);
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createBatch.mutate({
      freeze_dryer_id: freezeDryerId,
      batch_number: batchNumber,
      notes: notes.trim() === "" ? null : notes,
    });
  }

  useEffect(() => {
    if (batchNumber === "" && !batchesQuery.isLoading) {
      setBatchNumber(nextBatchNumber(productionBatches));
    }
  }, [batchNumber, batchesQuery.isLoading, productionBatches]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold">Production</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Create Draft Production Batches and organize trays before drying
            starts.
          </p>
        </div>
        <ButtonLink to="/production/preparation-presets" variant="secondary">
          Preparation Presets
        </ButtonLink>
      </section>

      <form
        className="panel grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto]"
        onSubmit={handleCreate}
      >
        <label className="field">
          <span>Freeze Dryer</span>
          <select
            required
            value={freezeDryerId}
            onChange={(event) => setFreezeDryerId(event.target.value)}
          >
            <option value="">Select</option>
            {activeFreezeDryers.map((freezeDryer) => (
              <option key={freezeDryer.id} value={freezeDryer.id}>
                {freezeDryer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Batch Number</span>
          <input
            required
            value={batchNumber}
            onChange={(event) => setBatchNumber(event.target.value)}
            placeholder={nextBatchNumber(productionBatches)}
          />
        </label>
        <label className="field">
          <span>Batch Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="fast notebook notes"
          />
        </label>
        <button className="primary-action self-end" type="submit">
          Create Draft
        </button>
        {error ? (
          <p className="md:col-span-4 text-sm text-red-700">{error}</p>
        ) : null}
        {freezeDryersQuery.isError ? (
          <p className="md:col-span-4 text-sm text-red-700" role="alert">
            Freeze Dryers could not be loaded. {freezeDryersQuery.error.message}
          </p>
        ) : null}
      </form>

      <section className="panel">
        <h3 className="section-title">Production Batches</h3>
        {batchesQuery.isError ? (
          <p className="mt-3 text-red-700" role="alert">
            Production Batches could not be loaded. {batchesQuery.error.message}
          </p>
        ) : productionBatches.length === 0 ? (
          <p className="mt-3 text-slate-600">
            No Production Batches exist. Create a Draft batch to begin setup.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Freeze Dryer</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productionBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <Link
                        className="text-link"
                        to={`/production/${batch.id}`}
                      >
                        {batch.batch_number}
                      </Link>
                    </td>
                    <td>{batch.freeze_dryer.name}</td>
                    <td>{batch.status}</td>
                    <td>
                      {batch.started_at
                        ? formatDate(batch.started_at)
                        : "Not started"}
                    </td>
                    <td>
                      <Link
                        className="secondary-action"
                        to={`/production/${batch.id}`}
                      >
                        {batch.status === "Draft"
                          ? "Continue / Start"
                          : batch.status === "Running"
                            ? "Open Workspace"
                            : "View"}
                      </Link>
                    </td>
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

function nextBatchNumber(batches: { batch_number: string }[]) {
  return `Batch ${String(batches.length + 1).padStart(3, "0")}`;
}

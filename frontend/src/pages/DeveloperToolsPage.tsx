import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { developerToolsApi, type DevToolResult } from "../api/client";

type DeveloperAction = {
  id: string;
  label: string;
  description: string;
  confirmation: string;
  run: () => Promise<DevToolResult>;
};

const actionGroups: { title: string; actions: DeveloperAction[] }[] = [
  {
    title: "Database",
    actions: [
      {
        id: "reset",
        label: "Reset Database",
        description:
          "Remove all application records while preserving the schema.",
        confirmation:
          "Reset the database and permanently remove all current data?",
        run: developerToolsApi.reset,
      },
      {
        id: "empty",
        label: "Seed Empty Database",
        description:
          "Replace current data with a clean, empty application state.",
        confirmation: "Replace all current data with an empty database?",
        run: developerToolsApi.seedEmpty,
      },
    ],
  },
  {
    title: "Demo Scenarios",
    actions: [
      {
        id: "basic",
        label: "Seed Basic Demo",
        description:
          "Create a realistic cross-milestone workflow and inventory.",
        confirmation: "Replace current data with the Basic Demo scenario?",
        run: developerToolsApi.seedBasic,
      },
      {
        id: "busy",
        label: "Seed Busy Production Day",
        description:
          "Run both Freeze Dryers with queued and completed work nearby.",
        confirmation: "Replace current data with a Busy Production Day?",
        run: developerToolsApi.seedBusyProductionDay,
      },
      {
        id: "inventory",
        label: "Seed Inventory",
        description:
          "Create Packages that are stored, given away, and depleted.",
        confirmation: "Replace current data with the Inventory scenario?",
        run: developerToolsApi.seedInventory,
      },
      {
        id: "packaging",
        label: "Seed Packaging",
        description:
          "Create completed Trays ready for Packaging plus package history.",
        confirmation: "Replace current data with the Packaging scenario?",
        run: developerToolsApi.seedPackaging,
      },
      {
        id: "weights",
        label: "Seed Weight History",
        description:
          "Create several Drying Runs with decreasing Weight Checks.",
        confirmation: "Replace current data with the Weight History scenario?",
        run: developerToolsApi.seedWeightHistory,
      },
    ],
  },
  {
    title: "Stress and Edge Cases",
    actions: [
      {
        id: "random-batches",
        label: "Create 100 Random Batches",
        description:
          "Replace current data with deterministic high-volume test data.",
        confirmation:
          "Replace current data with 100 generated Production Batches?",
        run: () => developerToolsApi.createRandomBatches(100),
      },
      {
        id: "edge-cases",
        label: "Create Edge Cases",
        description: "Add archived setup records and preserved voided history.",
        confirmation: "Replace current data with the Edge Cases scenario?",
        run: developerToolsApi.seedEdgeCases,
      },
    ],
  },
  {
    title: "Modify Existing Data",
    actions: [
      {
        id: "randomize-dates",
        label: "Randomize Dates",
        description:
          "Shift lifecycle dates while preserving their chronological order.",
        confirmation: "Randomize dates in the current database?",
        run: developerToolsApi.randomizeDates,
      },
      {
        id: "randomize-weights",
        label: "Randomize Weights",
        description:
          "Change weights while preserving decreasing drying history.",
        confirmation: "Randomize weights in the current database?",
        run: developerToolsApi.randomizeWeights,
      },
    ],
  },
];

function readableCountName(name: string) {
  return name.replace(/_/g, " ");
}

export function DeveloperToolsPage() {
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<DevToolResult | null>(null);
  const mutation = useMutation({
    mutationFn: (action: DeveloperAction) => action.run(),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries();
    },
    onSettled: () => setActiveAction(null),
  });

  function runAction(action: DeveloperAction) {
    if (!window.confirm(action.confirmation)) return;
    setResult(null);
    setActiveAction(action.id);
    mutation.mutate(action);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold">Developer Tools</h2>
        <p className="mt-2 text-slate-600">
          Build predictable local datasets for workflow testing.
        </p>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
        <p className="font-semibold">Local development database</p>
        <p className="mt-1 text-sm">
          Seed actions replace existing records. These tools are unavailable in
          production.
        </p>
      </div>

      {actionGroups.map((group) => (
        <section
          className="rounded-md border border-slate-200 bg-white p-5"
          key={group.title}
        >
          <h3 className="text-xl font-semibold">{group.title}</h3>
          <div className="mt-4 divide-y divide-slate-200">
            {group.actions.map((action) => (
              <div
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={action.id}
              >
                <div>
                  <p className="font-medium">{action.label}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {action.description}
                  </p>
                </div>
                <button
                  className="min-w-52 rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={mutation.isPending}
                  onClick={() => runAction(action)}
                  type="button"
                >
                  {activeAction === action.id ? "Working..." : action.label}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {mutation.isError ? (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          {mutation.error.message}
        </div>
      ) : null}

      {result ? (
        <section
          className="rounded-md border border-emerald-300 bg-emerald-50 p-5"
          aria-live="polite"
        >
          <h3 className="text-lg font-semibold">Developer action complete</h3>
          <p className="mt-1">{result.message}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(result.counts).map(([name, count]) => (
              <div className="rounded-md bg-white px-3 py-2" key={name}>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  {readableCountName(name)}
                </dt>
                <dd className="mt-1 text-xl font-semibold">{count}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

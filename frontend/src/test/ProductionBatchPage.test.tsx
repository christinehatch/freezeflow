import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FreezeDryer,
  PackagingOperation,
  PhysicalTray,
  ProductionBatch,
  Tray,
} from "../api/client";
import { ProductionBatchPage } from "../pages/ProductionBatchPage";

const freezeDryer: FreezeDryer = {
  id: "freeze-dryer-1",
  name: "black",
  notes: null,
  archived: false,
  tray_slot_count: 2,
  tray_slots: [
    {
      id: "slot-1",
      freeze_dryer_id: "freeze-dryer-1",
      slot_number: 1,
      label: null,
      archived: false,
    },
    {
      id: "slot-2",
      freeze_dryer_id: "freeze-dryer-1",
      slot_number: 2,
      label: null,
      archived: false,
    },
  ],
};

const physicalTrays: PhysicalTray[] = [
  {
    id: "physical-tray-1",
    label: "Imported Tray 1",
    tare_weight_grams: null,
    notes: null,
    archived: false,
  },
  {
    id: "physical-tray-2",
    label: "Imported Tray 2",
    tare_weight_grams: null,
    notes: null,
    archived: false,
  },
];

const draftBatchBase: ProductionBatch = {
  id: "batch-1",
  freeze_dryer_id: "freeze-dryer-1",
  freeze_dryer: freezeDryer,
  batch_number: "Batch 001",
  status: "Draft",
  started_at: null,
  completed_at: null,
  notes: "testing setup",
  trays: [],
  drying_runs: [],
  total_drying_seconds: 0,
};

describe("ProductionBatchPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("supports the Milestone 2 draft setup flow for selecting a physical tray into a freeze dryer slot", async () => {
    const user = userEvent.setup();
    const testState = createProductionTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderProductionBatchPage();

    expect(
      await screen.findByRole("heading", { name: "Batch 001" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select the Physical Trays used in this Production Batch.",
      ),
    ).toBeInTheDocument();

    const slotOneRow = await findRow("Slot 1");
    await user.selectOptions(
      within(slotOneRow).getAllByRole("combobox")[0],
      "physical-tray-1",
    );
    await user.type(within(slotOneRow).getAllByRole("textbox")[0], "Apples");
    await user.type(within(slotOneRow).getAllByRole("textbox")[1], "sliced");
    await user.clear(within(slotOneRow).getByRole("spinbutton"));
    await user.type(within(slotOneRow).getByRole("spinbutton"), "2.05");
    await user.selectOptions(
      within(slotOneRow).getAllByRole("combobox")[1],
      "lb",
    );
    await user.click(within(slotOneRow).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("link", { name: "Apples" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Imported Tray 1")).toBeInTheDocument();
    expect(screen.getByText("929.9 g")).toBeInTheDocument();

    const addTrayCall = fetchMock().mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/api/v1/production-batches/batch-1/trays") &&
        init?.method === "POST",
    );
    expect(addTrayCall).toBeDefined();
    expect(JSON.parse(String(addTrayCall?.[1]?.body))).toMatchObject({
      tray_slot_id: "slot-1",
      physical_tray_id: "physical-tray-1",
      product_name: "Apples",
      preparation: "sliced",
      starting_weight_grams: "929.864",
    });

    expect(
      screen.getByRole("button", { name: "Start Production Batch" }),
    ).toBeEnabled();
  });

  it("supports the Milestone 3 drying workflow from start through explicit batch completion", async () => {
    const user = userEvent.setup();
    const testState = createProductionTestState({
      trays: [createTray({ status: "Draft" })],
    });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderProductionBatchPage();

    expect(
      await screen.findByRole("link", { name: "Apples" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start Production Batch" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Current Drying Run" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "Current Run Complete" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Record Weight Checks" }),
    ).toBeInTheDocument();

    const weightRow = await findLastRow("Apples");
    const weightInput = within(weightRow).getByRole("spinbutton");
    const weightUnit = within(weightRow).getByRole("combobox");
    expect(weightUnit).toHaveValue("g");
    await user.clear(weightInput);
    await user.type(weightInput, "1100");
    expect(within(weightRow).getByRole("alert")).toHaveTextContent(
      "Check the value and unit",
    );
    await user.clear(weightInput);
    await user.type(weightInput, "8.4");
    await user.selectOptions(weightUnit, "oz");
    await user.click(
      within(weightRow).getByRole("button", { name: "Save Weight" }),
    );

    const savedWeightRow = await findLastRow("Apples");
    await user.click(
      within(savedWeightRow).getByRole("button", { name: "Correct" }),
    );
    const correctionInput =
      within(savedWeightRow).getAllByRole("spinbutton")[0];
    await user.clear(correctionInput);
    await user.type(correctionInput, "240");
    await user.type(
      within(savedWeightRow).getByRole("textbox", {
        name: "Correction reason",
      }),
      "Wrong unit selected",
    );
    await user.click(
      within(savedWeightRow).getByRole("button", { name: "Save Correction" }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Mark Complete" }),
    );

    expect(
      await screen.findByRole("heading", { name: "All Trays Complete" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Complete Batch" }));

    expect(
      await screen.findByRole("heading", { name: "Drying Complete" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Start Packaging" }),
    ).toHaveAttribute("href", "/packaging?batch=batch-1");

    const calls = fetchMock().mock.calls.map(([input, init]) => ({
      path: String(input).replace(/^.*\/api\/v1/, ""),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/production-batches/batch-1/start",
          method: "POST",
        }),
        expect.objectContaining({
          path: "/drying-runs/drying-run-1/complete",
          method: "POST",
        }),
        expect.objectContaining({
          path: "/trays/tray-1/weight-checks",
          method: "POST",
          body: expect.objectContaining({
            drying_run_id: "drying-run-1",
            weight_grams: "238.136",
          }),
        }),
        expect.objectContaining({
          path: "/weight-checks/weight-check-1/correct",
          method: "POST",
          body: {
            weight_grams: "240.000",
            reason: "Wrong unit selected",
          },
        }),
        expect.objectContaining({
          path: "/trays/tray-1/complete",
          method: "POST",
          body: { final_dry_weight_grams: "240.000" },
        }),
        expect.objectContaining({
          path: "/production-batches/batch-1/complete",
          method: "POST",
        }),
      ]),
    );
  });

  it("links a completed Batch to its existing Open Packaging Operation", async () => {
    const testState = createProductionTestState(
      {
        status: "Completed",
        completed_at: "2026-07-08T01:00:00.000Z",
      },
      createPackagingOperation("Open"),
    );
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderProductionBatchPage();

    expect(
      await screen.findByRole("link", { name: "Continue Packaging" }),
    ).toHaveAttribute("href", "/packaging?batch=batch-1&workspace=1");
  });

  it("links a completed Batch to its Completed Packaging Operation", async () => {
    const testState = createProductionTestState(
      {
        status: "Completed",
        completed_at: "2026-07-08T01:00:00.000Z",
      },
      createPackagingOperation("Completed"),
    );
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderProductionBatchPage();

    expect(
      await screen.findByRole("link", { name: "View Packaging" }),
    ).toHaveAttribute("href", "/packaging?batch=batch-1&workspace=1");
  });
});

function renderProductionBatchPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return renderWithProviders(
    <MemoryRouter initialEntries={["/production/batch-1"]}>
      <Routes>
        <Route path="/production/:batchId" element={<ProductionBatchPage />} />
      </Routes>
    </MemoryRouter>,
    queryClient,
  );
}

function renderWithProviders(ui: ReactNode, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

async function findRow(text: string) {
  const cell = await screen.findByText(text);
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`Could not find row for ${text}`);
  }
  return row;
}

async function findLastRow(text: string) {
  const cells = await screen.findAllByText(text);
  const row = cells[cells.length - 1].closest("tr");
  if (!row) {
    throw new Error(`Could not find row for ${text}`);
  }
  return row;
}

function createProductionTestState(
  overrides: Partial<ProductionBatch> = {},
  packagingOperation: PackagingOperation | null = null,
) {
  const state: { batch: ProductionBatch } = {
    batch: {
      ...draftBatchBase,
      ...overrides,
    },
  };

  function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (
      url.endsWith("/api/v1/production-batches/batch-1") &&
      method === "GET"
    ) {
      return jsonResponse(state.batch);
    }

    if (url.endsWith("/api/v1/freeze-dryers") && method === "GET") {
      return jsonResponse([freezeDryer]);
    }

    if (url.endsWith("/api/v1/physical-trays") && method === "GET") {
      return jsonResponse(physicalTrays);
    }

    if (url.endsWith("/api/v1/production-batches") && method === "GET") {
      return jsonResponse([state.batch]);
    }

    if (
      url.endsWith("/api/v1/production-batches/batch-1/packaging-operation") &&
      method === "GET"
    ) {
      return packagingOperation
        ? jsonResponse(packagingOperation)
        : errorResponse(404, {
            detail: {
              code: "PACKAGING_OPERATION_NOT_FOUND",
              message: "Packaging Operation does not exist.",
            },
          });
    }

    if (
      url.endsWith("/api/v1/production-batches/batch-1/trays") &&
      method === "POST"
    ) {
      const body = parseBody(init);
      const tray = createTray({
        physical_tray_id: String(body.physical_tray_id),
        product_name: String(body.product_name),
        preparation: String(body.preparation),
        starting_weight_grams: String(body.starting_weight_grams),
        notes: body.notes === null ? null : String(body.notes ?? ""),
      });
      state.batch = { ...state.batch, trays: [tray] };
      return jsonResponse(tray);
    }

    if (
      url.endsWith("/api/v1/production-batches/batch-1/start") &&
      method === "POST"
    ) {
      state.batch = {
        ...state.batch,
        status: "Running",
        started_at: "2026-07-07T18:00:00.000Z",
        trays: state.batch.trays.map((tray) => ({
          ...tray,
          status: "Running",
        })),
        drying_runs: [
          {
            id: "drying-run-1",
            production_batch_id: "batch-1",
            status: "Active",
            started_at: "2026-07-07T18:00:00.000Z",
            ended_at: null,
            notes: null,
            created_at: "2026-07-07T18:00:00.000Z",
            updated_at: "2026-07-07T18:00:00.000Z",
            duration_seconds: null,
          },
        ],
      };
      return jsonResponse(state.batch);
    }

    if (
      url.endsWith("/api/v1/drying-runs/drying-run-1/complete") &&
      method === "POST"
    ) {
      state.batch = {
        ...state.batch,
        drying_runs: state.batch.drying_runs.map((dryingRun) => ({
          ...dryingRun,
          status: "Complete",
          ended_at: "2026-07-08T00:45:00.000Z",
          duration_seconds: 24_300,
        })),
        total_drying_seconds: 24_300,
      };
      return jsonResponse(state.batch.drying_runs[0]);
    }

    if (
      url.endsWith("/api/v1/trays/tray-1/weight-checks") &&
      method === "POST"
    ) {
      const body = parseBody(init);
      const weightCheck = {
        id: "weight-check-1",
        tray_id: "tray-1",
        drying_run_id: String(body.drying_run_id),
        weight_grams: String(body.weight_grams),
        observed_at: String(body.observed_at),
        recorded_at: "2026-07-08T00:50:00.000Z",
        notes: body.notes === null ? null : String(body.notes ?? ""),
      };
      state.batch = {
        ...state.batch,
        trays: state.batch.trays.map((tray) =>
          tray.id === "tray-1"
            ? {
                ...tray,
                previous_weight_grams: tray.latest_weight_grams,
                latest_weight_grams: weightCheck.weight_grams,
                weight_checks: [weightCheck],
              }
            : tray,
        ),
      };
      return jsonResponse(weightCheck);
    }

    if (
      url.endsWith("/api/v1/weight-checks/weight-check-1/correct") &&
      method === "POST"
    ) {
      const body = parseBody(init);
      let correctedWeightCheck = state.batch.trays[0].weight_checks[0];
      state.batch = {
        ...state.batch,
        trays: state.batch.trays.map((tray) => {
          if (tray.id !== "tray-1") return tray;
          correctedWeightCheck = {
            ...tray.weight_checks[0],
            weight_grams: String(body.weight_grams),
          };
          return {
            ...tray,
            latest_weight_grams: correctedWeightCheck.weight_grams,
            weight_checks: [correctedWeightCheck],
          };
        }),
      };
      return jsonResponse(correctedWeightCheck);
    }

    if (url.endsWith("/api/v1/trays/tray-1/complete") && method === "POST") {
      const body = parseBody(init);
      state.batch = {
        ...state.batch,
        trays: state.batch.trays.map((tray) =>
          tray.id === "tray-1"
            ? {
                ...tray,
                status: "Completed",
                completed_at: "2026-07-08T00:55:00.000Z",
                final_dry_weight_grams: String(body.final_dry_weight_grams),
              }
            : tray,
        ),
      };
      return jsonResponse(state.batch.trays[0]);
    }

    if (
      url.endsWith("/api/v1/production-batches/batch-1/complete") &&
      method === "POST"
    ) {
      state.batch = {
        ...state.batch,
        status: "Completed",
        completed_at: "2026-07-08T01:00:00.000Z",
      };
      return jsonResponse(state.batch);
    }

    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ detail: `Unhandled test request: ${url}` }),
    } as Response);
  }

  return { fetch };
}

function createTray(
  overrides: Partial<{
    physical_tray_id: string;
    product_name: string;
    preparation: string;
    starting_weight_grams: string;
    notes: string | null;
    status: Tray["status"];
  }> = {},
): Tray {
  const physicalTrayId = overrides.physical_tray_id ?? "physical-tray-1";
  const physicalTray =
    physicalTrays.find((tray) => tray.id === physicalTrayId) ??
    physicalTrays[0];

  return {
    id: "tray-1",
    production_batch_id: "batch-1",
    tray_slot_id: "slot-1",
    tray_slot: freezeDryer.tray_slots[0],
    physical_tray_id: physicalTray.id,
    physical_tray: physicalTray,
    recipe_id: null,
    recipe_name: null,
    product_name: overrides.product_name ?? "Apples",
    preparation: overrides.preparation ?? "sliced",
    starting_weight_grams: overrides.starting_weight_grams ?? "929.864",
    final_dry_weight_grams: null,
    completed_at: null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "Draft",
    weight_checks: [],
    latest_weight_grams: overrides.starting_weight_grams ?? "929.864",
    previous_weight_grams: null,
    packaging: null,
  };
}

function parseBody(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)) : {};
}

function createPackagingOperation(
  status: PackagingOperation["status"],
): PackagingOperation {
  return {
    id: "packaging-operation-1",
    production_batch_id: "batch-1",
    status,
    started_at: "2026-07-08T01:05:00.000Z",
    completed_at: status === "Completed" ? "2026-07-08T02:00:00.000Z" : null,
    notes: null,
    created_at: "2026-07-08T01:05:00.000Z",
    updated_at: "2026-07-08T01:05:00.000Z",
    allocations: [],
    packages: [],
  };
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data, meta: {} }),
  } as Response);
}

function errorResponse(status: number, data: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

function fetchMock() {
  return vi.mocked(fetch);
}

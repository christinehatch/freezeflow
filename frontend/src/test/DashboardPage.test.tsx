import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import type { FreezeDryer, ProductionBatch, Tray } from "../api/client";
import { DashboardPage } from "../pages/DashboardPage";

const black = createFreezeDryer({
  id: "freeze-dryer-black",
  name: "Black",
});
const white = createFreezeDryer({
  id: "freeze-dryer-white",
  name: "White",
});

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("presents the calm state with one page-level creation action", async () => {
    mockDashboardApi({
      freezeDryers: [black, white],
      productionBatches: [
        createBatch({
          id: "batch-complete",
          batch_number: "Batch 005",
          freeze_dryer: black,
          freeze_dryer_id: black.id,
        }),
      ],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "No production is running",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("All clear")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "+ New Production Batch" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "+ New Production Batch" }),
    ).toHaveAttribute("href", "/production");
    expect(screen.getAllByText("Idle")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Batch 005" })).toHaveAttribute(
      "href",
      "/production/batch-complete",
    );
    expect(
      screen
        .getAllByRole("link", { name: "View all" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/freeze-dryers", "/production"]);
  });

  it("promotes a running Batch into the attention hero and preserves actions", async () => {
    const runningBatch = createBatch({
      id: "batch-running",
      batch_number: "Batch 007",
      status: "Running",
      completed_at: null,
      freeze_dryer: black,
      freeze_dryer_id: black.id,
      trays: [createRunningTray()],
      drying_runs: [
        {
          id: "drying-run-1",
          production_batch_id: "batch-running",
          status: "Complete",
          started_at: "2026-07-22T08:00:00.000Z",
          ended_at: "2026-07-22T18:00:00.000Z",
          notes: null,
          created_at: "2026-07-22T08:00:00.000Z",
          updated_at: "2026-07-22T18:00:00.000Z",
          duration_seconds: 36_000,
        },
      ],
    });
    mockDashboardApi({
      freezeDryers: [black, white],
      productionBatches: [runningBatch],
    });

    renderDashboard();

    const hero = await screen.findByRole("heading", {
      name: "Batch 007 is ready for Weight Checks",
    });
    const banner = hero.closest("section");
    expect(banner).not.toBeNull();
    expect(
      within(banner as HTMLElement).getByRole("link", {
        name: "Record Weight Checks",
      }),
    ).toHaveAttribute("href", "/production/batch-running");
    expect(
      screen.getByRole("link", { name: "+ New Production Batch" }),
    ).toHaveClass("ds-button--secondary");
    expect(
      screen.getByRole("link", { name: "Open Current Batch" }),
    ).toHaveAttribute("href", "/production/batch-running");
    expect(screen.queryByRole("link", { name: "Batch 007" })).toBeNull();
  });

  it("keeps Draft Batch and Freeze Dryer navigation context intact", async () => {
    mockDashboardApi({
      freezeDryers: [black, white],
      productionBatches: [
        createBatch({
          id: "batch-draft",
          batch_number: "Batch 008",
          status: "Draft",
          started_at: null,
          completed_at: null,
          freeze_dryer: black,
          freeze_dryer_id: black.id,
        }),
      ],
    });

    renderDashboard();

    expect(
      await screen.findByRole("link", { name: "Continue / Start Batch" }),
    ).toHaveAttribute("href", "/production/batch-draft");
    expect(
      screen.getByRole("link", { name: "Create Production Batch" }),
    ).toHaveAttribute("href", `/production?freezeDryerId=${white.id}`);
    expect(screen.getByRole("link", { name: "Batch 008" })).toHaveAttribute(
      "href",
      "/production/batch-draft",
    );
  });

  it("waits for authoritative Production Batches before showing a calm state", async () => {
    const productionBatches = deferred<ProductionBatch[]>();
    mockDashboardApi({
      freezeDryers: [black],
      productionBatches: productionBatches.promise,
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Loading Dashboard" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Idle")).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();

    await act(async () => productionBatches.resolve([]));

    expect(
      await screen.findByRole("heading", { name: "No production is running" }),
    ).toBeInTheDocument();
  });

  it("describes independent Freeze Dryer loading without contradicting Batch state", async () => {
    const freezeDryers = deferred<FreezeDryer[]>();
    mockDashboardApi({
      freezeDryers: freezeDryers.promise,
      productionBatches: [],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "No production is running" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Freeze Dryer availability is still loading/),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading Freeze Dryers…")).toBeInTheDocument();

    await act(async () => freezeDryers.resolve([black]));

    expect(await screen.findByText("Idle")).toBeInTheDocument();
  });

  it("keeps query failures in their correct Dashboard regions", async () => {
    mockDashboardApi({
      freezeDryers: new Error("dryer service unavailable"),
      productionBatches: [],
    });

    const firstRender = renderDashboard();

    expect(
      await screen.findByText(
        /Freeze Dryer availability is temporarily unavailable/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Freeze Dryers could not be loaded/),
    ).toHaveAttribute("role", "alert");

    firstRender.unmount();
    mockDashboardApi({
      freezeDryers: [black],
      productionBatches: new Error("batch service unavailable"),
    });
    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Dashboard attention is temporarily unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("provides useful empty states without duplicating the page action", async () => {
    mockDashboardApi({ freezeDryers: [], productionBatches: [] });

    renderDashboard();

    expect(
      await screen.findByRole("link", {
        name: "Create Your First Freeze Dryer",
      }),
    ).toHaveAttribute("href", "/freeze-dryers");
    expect(screen.getByText("No recent Production Batches yet.")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "+ New Production Batch" }),
    ).toHaveLength(1);
  });

  it("makes an archived Freeze Dryer unavailable for new Production", async () => {
    const archived = createFreezeDryer({
      id: "freeze-dryer-archived",
      name: "Retired",
      archived: true,
    });
    mockDashboardApi({ freezeDryers: [archived], productionBatches: [] });

    renderDashboard();

    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Create Production Batch" }),
    ).toBeNull();
  });

  it("uses documented active-run and ready-to-complete handoffs", async () => {
    const activeRunBatch = createBatch({
      id: "batch-active-run",
      batch_number: "Batch 010",
      status: "Running",
      completed_at: null,
      freeze_dryer: black,
      freeze_dryer_id: black.id,
      trays: [createRunningTray({ production_batch_id: "batch-active-run" })],
      drying_runs: [
        {
          id: "active-run",
          production_batch_id: "batch-active-run",
          status: "Active",
          started_at: "2026-07-22T08:00:00.000Z",
          ended_at: null,
          notes: null,
          created_at: "2026-07-22T08:00:00.000Z",
          updated_at: "2026-07-22T08:00:00.000Z",
          duration_seconds: null,
        },
      ],
    });
    mockDashboardApi({
      freezeDryers: [black],
      productionBatches: [activeRunBatch],
    });

    const firstRender = renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Batch 010 is currently drying",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Open Current Batch" })[0],
    ).toHaveAttribute("href", "/production/batch-active-run");

    firstRender.unmount();
    const completedTray = createRunningTray({
      id: "tray-complete",
      production_batch_id: "batch-ready",
      status: "Completed",
      final_dry_weight_grams: "300",
      completed_at: "2026-07-22T18:00:00.000Z",
    });
    mockDashboardApi({
      freezeDryers: [black],
      productionBatches: [
        createBatch({
          id: "batch-ready",
          batch_number: "Batch 011",
          status: "Running",
          completed_at: null,
          freeze_dryer: black,
          freeze_dryer_id: black.id,
          trays: [completedTray],
        }),
      ],
    });
    renderDashboard();

    expect(
      await screen.findByRole("link", { name: "Review Batch" }),
    ).toHaveAttribute("href", "/production/batch-ready");
  });

  it("uses a generic review handoff after the latest Weight Checks are recorded", async () => {
    const checkedTray = createRunningTray({
      production_batch_id: "batch-checked",
      weight_checks: [
        {
          id: "weight-check-1",
          tray_id: "tray-1",
          drying_run_id: "drying-run-complete",
          weight_grams: "310",
          observed_at: "2026-07-22T18:15:00.000Z",
          recorded_at: "2026-07-22T18:16:00.000Z",
          notes: null,
        },
      ],
    });
    mockDashboardApi({
      freezeDryers: [black],
      productionBatches: [
        createBatch({
          id: "batch-checked",
          batch_number: "Batch 014",
          status: "Running",
          completed_at: null,
          freeze_dryer: black,
          freeze_dryer_id: black.id,
          trays: [checkedTray],
          drying_runs: [
            {
              id: "drying-run-complete",
              production_batch_id: "batch-checked",
              status: "Complete",
              started_at: "2026-07-22T08:00:00.000Z",
              ended_at: "2026-07-22T18:00:00.000Z",
              notes: null,
              created_at: "2026-07-22T08:00:00.000Z",
              updated_at: "2026-07-22T18:00:00.000Z",
              duration_seconds: 36_000,
            },
          ],
        }),
      ],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Batch 014 is ready for review",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Batch" })).toHaveAttribute(
      "href",
      "/production/batch-checked",
    );
    expect(screen.queryByText("Record Weight Checks")).toBeNull();
  });

  it("uses stable prioritization instead of response order when several Batches run", async () => {
    const first = createBatch({
      id: "batch-first",
      batch_number: "Batch 012",
      status: "Running",
      completed_at: null,
      freeze_dryer: black,
      freeze_dryer_id: black.id,
      trays: [createRunningTray({ production_batch_id: "batch-first" })],
    });
    const second = createBatch({
      id: "batch-second",
      batch_number: "Batch 013",
      status: "Running",
      completed_at: null,
      freeze_dryer: white,
      freeze_dryer_id: white.id,
      trays: [createRunningTray({ production_batch_id: "batch-second" })],
    });
    mockDashboardApi({
      freezeDryers: [black, white],
      productionBatches: [second, first],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Batch 012 is currently drying",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 Production Batches are running."),
    ).toBeInTheDocument();
  });
});

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockDashboardApi({
  freezeDryers,
  productionBatches,
}: {
  freezeDryers: FreezeDryer[] | Promise<FreezeDryer[]> | Error;
  productionBatches: ProductionBatch[] | Promise<ProductionBatch[]> | Error;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const value = url.endsWith("/freeze-dryers")
        ? freezeDryers
        : productionBatches;
      if (value instanceof Error) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () =>
            Promise.resolve({
              success: false,
              error: { code: "UNAVAILABLE", message: value.message },
            }),
        } as Response);
      }
      return Promise.resolve(value).then(
        (data) =>
          ({
            ok: true,
            json: () => Promise.resolve({ success: true, data, meta: {} }),
          }) as Response,
      );
    }),
  );
}

function createFreezeDryer(overrides: Partial<FreezeDryer> = {}): FreezeDryer {
  return {
    id: "freeze-dryer-1",
    name: "Black",
    notes: null,
    archived: false,
    tray_slot_count: 4,
    tray_slots: [],
    ...overrides,
  };
}

function createBatch(
  overrides: Partial<ProductionBatch> = {},
): ProductionBatch {
  return {
    id: "batch-1",
    freeze_dryer_id: black.id,
    freeze_dryer: black,
    batch_number: "Batch 005",
    status: "Completed",
    started_at: "2026-07-08T08:00:00.000Z",
    completed_at: "2026-07-08T18:00:00.000Z",
    notes: null,
    trays: [],
    drying_runs: [],
    total_drying_seconds: 36_000,
    ...overrides,
  };
}

function createRunningTray(overrides: Partial<Tray> = {}): Tray {
  return {
    id: "tray-1",
    production_batch_id: "batch-running",
    tray_slot_id: "slot-1",
    tray_slot: {
      id: "slot-1",
      freeze_dryer_id: black.id,
      slot_number: 1,
      label: "Slot 1",
      archived: false,
    },
    physical_tray_id: "physical-tray-1",
    physical_tray: {
      id: "physical-tray-1",
      label: "Tray 1",
      tare_weight_grams: null,
      notes: null,
      archived: false,
    },
    recipe_id: null,
    recipe_name: null,
    product_name: "Pork Shoulder",
    preparation: "Cooked and shredded",
    starting_weight_grams: "1200",
    final_dry_weight_grams: null,
    completed_at: null,
    notes: null,
    status: "Running",
    weight_checks: [],
    latest_weight_grams: null,
    previous_weight_grams: null,
    packaging: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportsPage } from "../pages/ReportsPage";

const FREEZE_DRYERS = [
  { id: "fd-black", name: "Black", archived: false },
  { id: "fd-white", name: "White", archived: false },
];

const PREPARATION_PRESETS = [
  {
    id: "preset-1",
    name: "Sliced Chicken",
    product_name: "Chicken",
    ingredients: ["Chicken"],
    preparation_methods: ["Sliced"],
    notes: null,
    archived: false,
  },
];

const PRODUCTION_BATCHES = [{ id: "batch-1", batch_number: "Batch 001" }];

const PRODUCT_NAMES = ["Chicken", "Apples"];

const FREEZE_DRYER_PERFORMANCE_ROWS = [
  {
    freeze_dryer_id: "fd-black",
    freeze_dryer_name: "Black",
    completed_production_batch_count: 2,
    average_dry_time_seconds: 43200,
    average_weight_loss_percent: "77.5",
    average_time_to_completion_seconds: 46800,
  },
];

const PRODUCT_HISTORY_ROWS = [
  {
    product_name: "Chicken",
    times_produced: 3,
    average_drying_time_seconds: 43200,
    average_yield_percent: "25.0",
    last_batch_completed_at: "2026-08-20T00:00:00Z",
  },
];

const PREPARATION_HISTORY_ROWS = [
  {
    preparation_preset_name: "Sliced Chicken",
    used_preset: true,
    times_used: 3,
    average_drying_time_seconds: 43200,
    average_yield_percent: "25.0",
    last_used_completed_at: "2026-08-20T00:00:00Z",
  },
  {
    preparation_preset_name: "No Preset",
    used_preset: false,
    times_used: 1,
    average_drying_time_seconds: 36000,
    average_yield_percent: "30.0",
    last_used_completed_at: "2026-08-15T00:00:00Z",
  },
];

const DRYING_TIME_ROWS = [
  {
    production_batch_id: "batch-1",
    batch_number: "Batch 001",
    freeze_dryer_name: "Black",
    completed_at: "2026-08-20T00:00:00Z",
    total_drying_time_seconds: 43200,
    drying_run_count: 1,
    voided_drying_run_count: 0,
  },
];

const PRODUCTION_HISTORY_ROWS = [
  {
    production_batch_id: "batch-1",
    batch_number: "Batch 001",
    freeze_dryer_name: "Black",
    completed_at: "2026-08-20T00:00:00Z",
    tray_count: 2,
    products: ["Chicken", "Apples"],
    total_drying_time_seconds: 43200,
  },
];

const INVENTORY_SUMMARY = {
  packages_in_storage: 5,
  packages_given_away: 2,
  packages_depleted: 1,
  total_packaged_weight_grams: "900.000",
  total_dried_weight_grams: "1925.000",
  most_common_products: [{ product_name: "Chicken", package_count: 4 }],
};

describe("ReportsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders Freeze Dryer Performance by default, with only its own filters", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse(FREEZE_DRYER_PERFORMANCE_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Black" })).toBeVisible();
    expect(screen.getByText("12 h")).toBeVisible();
    expect(screen.getByText("77.5%")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("13 h")).toBeVisible();

    expect(
      screen.getByRole("combobox", { name: "Freeze Dryer" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Product" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Preparation Preset" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Production Batch" }),
    ).not.toBeInTheDocument();
  });

  it("switches to Product History, showing only its filter and its table", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      if (url.pathname.endsWith("/reports/product-history")) {
        return apiResponse(PRODUCT_HISTORY_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No production history is available yet.");

    await selectReportType(user, "Product History");

    expect(await screen.findByText("Chicken")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("12 h")).toBeVisible();
    expect(screen.getByText("25%")).toBeVisible();
    expect(screen.getByText("Aug 20, 2026")).toBeVisible();

    expect(screen.getByRole("combobox", { name: "Product" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Freeze Dryer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Preparation Preset" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Production Batch" }),
    ).not.toBeInTheDocument();
  });

  it("switches to Preparation History and shows a Tray's-with-no-Preset bucket as its own row", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      if (url.pathname.endsWith("/reports/preparation-history")) {
        return apiResponse(PREPARATION_HISTORY_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No production history is available yet.");

    await selectReportType(user, "Preparation History");

    expect(await screen.findByText("Sliced Chicken")).toBeVisible();
    const noPresetRow = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("No Preset"));
    expect(noPresetRow).toHaveTextContent("(no Preparation Preset used)");

    expect(
      screen.getByRole("combobox", { name: "Preparation Preset" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Freeze Dryer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Product" }),
    ).not.toBeInTheDocument();
  });

  it("switches to Drying Time, showing Freeze Dryer and Production Batch filters", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      if (url.pathname.endsWith("/reports/drying-time")) {
        return apiResponse(DRYING_TIME_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No production history is available yet.");

    await selectReportType(user, "Drying Time");

    expect(await screen.findByText("Batch 001")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("0")).toBeVisible();

    expect(
      screen.getByRole("combobox", { name: "Freeze Dryer" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Production Batch" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Product" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Preparation Preset" }),
    ).not.toBeInTheDocument();
  });

  it("switches to Production History, showing every filter and the full row", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      if (url.pathname.endsWith("/reports/production-history")) {
        return apiResponse(PRODUCTION_HISTORY_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No production history is available yet.");

    await selectReportType(user, "Production History");

    expect(await screen.findByText("Batch 001")).toBeVisible();
    expect(screen.getByText("Chicken, Apples")).toBeVisible();

    expect(
      screen.getByRole("combobox", { name: "Freeze Dryer" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Preparation Preset" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Production Batch" }),
    ).toBeVisible();
  });

  it("switches to Inventory Summary, showing counts, weight totals, and Most Common Products", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      if (url.pathname.endsWith("/reports/inventory-summary")) {
        return apiResponse(INVENTORY_SUMMARY);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No production history is available yet.");

    await selectReportType(user, "Inventory Summary");

    expect(await screen.findByText("5")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("900 g")).toBeVisible();
    expect(screen.getByText("1,925 g")).toBeVisible();
    expect(
      screen.getByText("not expected to match", { exact: false }),
    ).toBeVisible();
    expect(screen.getByText("Chicken")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();

    expect(screen.getByRole("combobox", { name: "Product" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Freeze Dryer" }),
    ).not.toBeInTheDocument();
  });

  it("narrows Freeze Dryer Performance by Freeze Dryer and sends the matching query param", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        if (url.searchParams.get("freeze_dryer_id") === "fd-black") {
          return apiResponse([FREEZE_DRYER_PERFORMANCE_ROWS[0]]);
        }
        return apiResponse(FREEZE_DRYER_PERFORMANCE_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Black" });

    await user.click(screen.getByRole("combobox", { name: "Freeze Dryer" }));
    await user.click(screen.getByRole("option", { name: "Black" }));

    await waitFor(() => {
      const filteredCall = fetch.mock.calls.find(([requestInput]) => {
        const url = new URL(String(requestInput));
        return (
          url.pathname.endsWith("/reports/freeze-dryer-performance") &&
          url.searchParams.get("freeze_dryer_id") === "fd-black"
        );
      });
      expect(filteredCall).toBeDefined();
    });
  });

  it("shows the No Data state when no records exist yet and no filters are applied", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(
      await screen.findByText("No production history is available yet."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Create Production Batches to begin collecting historical insights.",
      ),
    ).toBeVisible();
  });

  it("shows the Empty state when a filtered query returns zero rows", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        if (url.searchParams.get("freeze_dryer_id") === "fd-white") {
          return apiResponse([]);
        }
        return apiResponse(FREEZE_DRYER_PERFORMANCE_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Black" });

    await user.click(screen.getByRole("combobox", { name: "Freeze Dryer" }));
    await user.click(screen.getByRole("option", { name: "White" }));

    expect(
      await screen.findByText(
        "No matching production history was found for the selected filters.",
      ),
    ).toBeVisible();
  });

  it("shows an Error state and Retry re-issues the request with filters intact", async () => {
    const user = userEvent.setup();
    let shouldFail = true;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const dropdown = dropdownResponse(url);
      if (dropdown) return dropdown;
      if (url.pathname.endsWith("/reports/freeze-dryer-performance")) {
        if (url.searchParams.get("freeze_dryer_id") !== "fd-black") {
          throw new Error(`Unexpected request: ${url.toString()}`);
        }
        if (shouldFail) {
          return apiResponse(
            { detail: { message: "Report generation failed." } },
            500,
          );
        }
        return apiResponse(FREEZE_DRYER_PERFORMANCE_ROWS);
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage([
      "/reports?report=freeze-dryer-performance&freeze_dryer_id=fd-black",
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Report generation failed.",
    );
    expect(
      screen.getByRole("combobox", { name: "Freeze Dryer" }),
    ).toHaveTextContent("Black");

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Black" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Freeze Dryer" }),
    ).toHaveTextContent("Black");
  });
});

async function selectReportType(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("combobox", { name: "Report" }));
  await user.click(screen.getByRole("option", { name: label }));
}

function dropdownResponse(url: URL): Response | null {
  if (url.pathname === "/api/v1/freeze-dryers") {
    return apiResponse(FREEZE_DRYERS);
  }
  if (url.pathname === "/api/v1/preparation-presets") {
    return apiResponse(PREPARATION_PRESETS);
  }
  if (url.pathname === "/api/v1/production-batches") {
    return apiResponse(PRODUCTION_BATCHES);
  }
  if (url.pathname === "/api/v1/reports/product-names") {
    return apiResponse(PRODUCT_NAMES);
  }
  return null;
}

function renderPage(initialEntries: string[] = ["/reports"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<ReportsPage />} path="/reports" />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function apiResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ success: status < 400, data, meta: {} }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

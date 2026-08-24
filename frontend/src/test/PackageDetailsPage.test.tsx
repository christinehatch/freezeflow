import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Package,
  PackagingOperation,
  ProductionBatch,
  StorageLocation,
} from "../api/client";
import { PackageDetailsPage } from "../pages/PackageDetailsPage";

const STORAGE_LOCATIONS: StorageLocation[] = [
  { id: "bin-a", name: "Bin A", notes: null, archived: false },
  { id: "bin-b", name: "Bin B", notes: null, archived: false },
  { id: "old-bin", name: "Old Bin", notes: null, archived: true },
];

function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "package-1",
    packaging_allocation_id: "allocation-1",
    packaging_operation_id: "operation-1",
    package_type_id: "package-type-1",
    package_type: {
      id: "package-type-1",
      name: "Quart Mylar",
      default_oxygen_absorber: null,
      default_label_template: null,
      notes: null,
      archived: false,
    },
    package_identifier: "PKG-2026-000001",
    packaged_at: "2026-05-03T00:00:00Z",
    package_weight_grams: "245.000",
    finished_product_weight_grams: "240.000",
    oxygen_absorber: "500cc",
    storage_location_id: "bin-a",
    storage_location: STORAGE_LOCATIONS[0],
    status: "In Storage",
    notes: "Gift size.",
    label: {
      id: "label-1",
      package_id: "package-1",
      status: "Ready",
      display_name: "Taco Chicken",
      description: "Chicken and vegetables",
      ingredients_summary: "Chicken, cabbage, onion",
      preparation_summary: "Cubed and seasoned",
      rehydration_instructions: "Add 2 cups water",
      serving_notes: "Two-cup meal",
      net_weight_display: "8.2 oz",
      fresh_equivalent_display: "2 lb fresh",
      created_at: "2026-05-03T00:00:00Z",
      updated_at: "2026-05-03T00:00:00Z",
      print_events: [],
    },
    ...overrides,
  } as Package;
}

const OPERATION: PackagingOperation = {
  id: "operation-1",
  production_batch_id: "batch-1",
  status: "Open",
  started_at: "2026-05-03T00:00:00Z",
  completed_at: null,
  notes: null,
  created_at: "2026-05-03T00:00:00Z",
  updated_at: "2026-05-03T00:00:00Z",
  packages: [],
  allocations: [
    {
      id: "allocation-1",
      packaging_operation_id: "operation-1",
      notes: null,
      created_at: "2026-05-03T00:00:00Z",
      updated_at: "2026-05-03T00:00:00Z",
      selected_weight_grams: "500.000",
      allocated_weight_grams: "500.000",
      total_recorded_loss_weight_grams: "0.000",
      remaining_weight_grams: "0.000",
      bagged_weight_grams: "500.000",
      remaining_to_bag_grams: "0.000",
      planned_packages: [],
      packages: [],
      packaging_losses: [],
      source_trays: [
        {
          id: "tray-1",
          production_batch_id: "batch-1",
          tray_slot_id: "slot-1",
          slot_number: 1,
          physical_tray_id: "physical-tray-1",
          physical_tray_label: "Tray A",
          product_name: "Taco Chicken",
          preparation: "Cubed and seasoned.",
          final_dry_weight_grams: "116.500",
          notes: null,
          status: "Completed",
        },
      ],
    },
  ],
};

const BATCH: ProductionBatch = {
  id: "batch-1",
  freeze_dryer_id: "freeze-dryer-1",
  freeze_dryer: {
    id: "freeze-dryer-1",
    name: "Black Freeze Dryer",
    notes: null,
    archived: false,
    tray_slot_count: 5,
    tray_slots: [],
  },
  batch_number: "Batch 24",
  status: "Completed",
  started_at: "2026-05-01T00:00:00Z",
  completed_at: "2026-05-03T00:00:00Z",
  notes: null,
  trays: [],
  drying_runs: [],
  total_drying_seconds: 0,
};

describe("PackageDetailsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders Package identity, Package Label, and Production/Packaging traceability", async () => {
    const fetch = baseFetch(makePackage());
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(await screen.findByText("Taco Chicken")).toBeVisible();
    expect(screen.getByText("PKG-2026-000001")).toBeVisible();
    expect(screen.getByText("In Storage")).toBeVisible();
    expect(screen.getAllByText("Quart Mylar").length).toBeGreaterThan(0);
    expect(screen.getByText("Bin A")).toBeVisible();
    expect(screen.getByText("Chicken, cabbage, onion")).toBeVisible();

    expect(await screen.findByText("Tray A", { exact: false })).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getAllByText("Batch 24", { exact: false }).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText("Black Freeze Dryer", { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("moves an In Storage Package, excluding the current and archived Storage Locations from the destination list", async () => {
    const user = userEvent.setup();
    let currentPackage = makePackage();
    const fetch = baseFetch(currentPackage, {
      onMove: (body) => {
        currentPackage = {
          ...currentPackage,
          storage_location_id: body.storage_location_id,
          storage_location: STORAGE_LOCATIONS.find(
            (location) => location.id === body.storage_location_id,
          )!,
        };
        return currentPackage;
      },
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("Taco Chicken");

    await user.click(screen.getByRole("combobox", { name: "Move to" }));
    expect(screen.getByRole("option", { name: "Bin B" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Bin A" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Old Bin" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Bin B" }));
    await user.click(screen.getByRole("button", { name: "Move Package" }));

    await waitFor(() =>
      expect(screen.getAllByText("Bin B").length).toBeGreaterThan(0),
    );
  });

  it("surfaces a rejected Move as an inline error", async () => {
    const user = userEvent.setup();
    const fetch = baseFetch(makePackage(), { moveShouldFail: true });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("Taco Chicken");

    await user.click(screen.getByRole("combobox", { name: "Move to" }));
    await user.click(screen.getByRole("option", { name: "Bin B" }));
    await user.click(screen.getByRole("button", { name: "Move Package" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Package is already in that Storage Location.",
    );
  });

  it("confirms before marking a Package Given Away, and hides actions once terminal", async () => {
    const user = userEvent.setup();
    let currentPackage = makePackage();
    const fetch = baseFetch(currentPackage, {
      onGiveAway: () => {
        currentPackage = { ...currentPackage, status: "Given Away" };
        return currentPackage;
      },
    });
    vi.stubGlobal("fetch", fetch);
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    renderPage();
    await screen.findByText("Taco Chicken");

    await user.click(screen.getByRole("button", { name: "Mark Given Away" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("PKG-2026-000001"),
    );
    expect(await screen.findByText("Given Away")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Mark Given Away" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Depleted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Move to" }),
    ).not.toBeInTheDocument();
  });

  it("does not mark a Package Given Away when confirmation is declined", async () => {
    const user = userEvent.setup();
    const giveAway = vi.fn();
    const fetch = baseFetch(makePackage(), { onGiveAway: giveAway });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );

    renderPage();
    await screen.findByText("Taco Chicken");

    await user.click(screen.getByRole("button", { name: "Mark Given Away" }));

    expect(giveAway).not.toHaveBeenCalled();
    expect(screen.getByText("In Storage")).toBeVisible();
  });
});

function baseFetch(
  initialPackage: Package,
  options: {
    onMove?: (body: { storage_location_id: string }) => Package;
    onGiveAway?: () => Package;
    moveShouldFail?: boolean;
  } = {},
) {
  let currentPackage = initialPackage;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const url = String(input);

    if (
      url.endsWith(`/api/v1/packages/${currentPackage.id}`) &&
      method === "GET"
    ) {
      return apiResponse(currentPackage);
    }
    if (url.endsWith("/api/v1/packaging-operations/operation-1")) {
      return apiResponse(OPERATION);
    }
    if (url.endsWith("/api/v1/production-batches/batch-1")) {
      return apiResponse(BATCH);
    }
    if (url.includes("/api/v1/storage-locations")) {
      return apiResponse(STORAGE_LOCATIONS);
    }
    if (url.endsWith(`/api/v1/packages/${currentPackage.id}/storage-history`)) {
      return apiResponse([]);
    }
    if (url.endsWith(`/api/v1/packages/${currentPackage.id}/status-history`)) {
      return apiResponse([
        {
          id: "status-1",
          package_id: currentPackage.id,
          previous_status: null,
          current_status: "In Storage",
          effective_at: "2026-05-03T00:00:00Z",
          recorded_at: "2026-05-03T00:00:00Z",
          notes: null,
        },
      ]);
    }
    if (
      url.endsWith(`/api/v1/packages/${currentPackage.id}/move`) &&
      method === "POST"
    ) {
      if (options.moveShouldFail) {
        return apiResponse(
          {
            detail: {
              message: "Package is already in that Storage Location.",
            },
          },
          400,
        );
      }
      const body = JSON.parse(String(init?.body));
      currentPackage = options.onMove?.(body) ?? currentPackage;
      return apiResponse(currentPackage);
    }
    if (
      url.endsWith(`/api/v1/packages/${currentPackage.id}/give-away`) &&
      method === "POST"
    ) {
      currentPackage = options.onGiveAway?.() ?? currentPackage;
      return apiResponse(currentPackage);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/packages/package-1"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<PackageDetailsPage />} path="/packages/:packageId" />
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

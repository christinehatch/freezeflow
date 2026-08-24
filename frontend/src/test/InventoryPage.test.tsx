import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Package, ProductGroup, StorageLocation } from "../api/client";
import { InventoryPage } from "../pages/InventoryPage";

const STORAGE_LOCATIONS: StorageLocation[] = [
  { id: "bin-a", name: "Bin A", notes: null, archived: false },
];

const PRODUCT_GROUPS: ProductGroup[] = [
  {
    product_name: "Chicken",
    available_package_count: 2,
    storage_locations: ["Bin A"],
    oldest_packaged_at: "2026-05-03T00:00:00Z",
    newest_packaged_at: "2026-07-18T00:00:00Z",
  },
  {
    product_name: "Strawberries",
    available_package_count: 1,
    storage_locations: ["Bin A"],
    oldest_packaged_at: "2026-06-01T00:00:00Z",
    newest_packaged_at: "2026-06-01T00:00:00Z",
  },
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
    oxygen_absorber: null,
    storage_location_id: "bin-a",
    storage_location: STORAGE_LOCATIONS[0],
    status: "In Storage",
    notes: null,
    label: {
      id: "label-1",
      package_id: "package-1",
      status: "Ready",
      display_name: "Chicken",
      description: null,
      ingredients_summary: null,
      preparation_summary: null,
      rehydration_instructions: null,
      serving_notes: null,
      net_weight_display: null,
      fresh_equivalent_display: null,
      created_at: "2026-05-03T00:00:00Z",
      updated_at: "2026-05-03T00:00:00Z",
      print_events: [],
    },
    ...overrides,
  } as Package;
}

describe("InventoryPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("browses Product groups by default and opens a group into its Packages", async () => {
    const user = userEvent.setup();
    const chickenPackages = [
      makePackage({ id: "package-1" }),
      makePackage({ id: "package-2", package_identifier: "PKG-2026-000002" }),
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/storage-locations")) {
        return apiResponse(STORAGE_LOCATIONS);
      }
      if (url.endsWith("/api/v1/inventory/products")) {
        return apiResponse(PRODUCT_GROUPS);
      }
      if (url.includes("/api/v1/inventory?") && url.includes("Chicken")) {
        return apiResponse(chickenPackages);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(await screen.findByText("Chicken")).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "p" &&
          element.textContent === "2 Packages · Bin A · Oldest May 3, 2026",
      ),
    ).toBeVisible();
    expect(screen.getByText("Strawberries")).toBeVisible();

    await user.click(screen.getByText("Chicken"));

    expect(
      await screen.findByText("PKG-2026-000001", { exact: false }),
    ).toBeVisible();
    expect(screen.getByText("PKG-2026-000002", { exact: false })).toBeVisible();
    expect(screen.getByText("Chicken · 2 Packages")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "← Back to Products" }),
    );

    expect(await screen.findByText("Strawberries")).toBeVisible();
    expect(screen.queryByText("Chicken · 2 Packages")).not.toBeInTheDocument();
  });

  it("switches to a flat Package list when searching, and back to groups when cleared", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/storage-locations")) {
        return apiResponse(STORAGE_LOCATIONS);
      }
      if (url.endsWith("/api/v1/inventory/products")) {
        return apiResponse(PRODUCT_GROUPS);
      }
      if (url.includes("/api/v1/inventory?query=Straw")) {
        return apiResponse([
          makePackage({
            id: "package-3",
            label: { ...makePackage().label, display_name: "Strawberries" },
          }),
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("Chicken");

    await user.type(screen.getByLabelText("Search"), "Straw");

    expect(await screen.findByText("Strawberries")).toBeVisible();
    expect(
      screen.queryByText("2 Packages", { exact: false }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Search" }));

    expect(await screen.findByText("Chicken")).toBeVisible();
    expect(screen.getByText("Strawberries")).toBeVisible();
  });

  it("combines a Storage Location filter with the search view", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/storage-locations")) {
        return apiResponse(STORAGE_LOCATIONS);
      }
      if (url.endsWith("/api/v1/inventory/products")) {
        return apiResponse(PRODUCT_GROUPS);
      }
      if (
        url.includes("/api/v1/inventory?") &&
        url.includes("storage_location_id=bin-a")
      ) {
        return apiResponse([makePackage()]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("Chicken");

    await user.click(
      screen.getByRole("combobox", { name: "Storage Location" }),
    );
    await user.click(screen.getByRole("option", { name: "Bin A" }));

    expect(
      await screen.findByText("PKG-2026-000001", { exact: false }),
    ).toBeVisible();
  });

  it("shows an empty state when no Packages match, and an error state when the search fails", async () => {
    const user = userEvent.setup();
    let searchShouldFail = false;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/storage-locations")) {
        return apiResponse(STORAGE_LOCATIONS);
      }
      if (url.endsWith("/api/v1/inventory/products")) {
        return apiResponse(PRODUCT_GROUPS);
      }
      if (url.includes("/api/v1/inventory?")) {
        if (searchShouldFail) {
          return apiResponse(
            { detail: { message: "Inventory search failed." } },
            500,
          );
        }
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("Chicken");

    await user.type(screen.getByLabelText("Search"), "Nothing here");
    expect(
      await screen.findByText("No Packages matched your search."),
    ).toBeVisible();

    searchShouldFail = true;
    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "Boom");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Inventory search failed.",
      ),
    );
  });

  it("keeps the open Product group in the URL, so navigating back restores it instead of the top-level list", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/storage-locations")) {
        return apiResponse(STORAGE_LOCATIONS);
      }
      if (url.endsWith("/api/v1/inventory/products")) {
        return apiResponse(PRODUCT_GROUPS);
      }
      if (url.includes("/api/v1/inventory?") && url.includes("Chicken")) {
        return apiResponse([makePackage()]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage(["/inventory?product=Chicken"]);

    expect(await screen.findByText("Chicken · 1 Package")).toBeVisible();
    expect(screen.queryByText("Strawberries")).not.toBeInTheDocument();
  });
});

function renderPage(initialEntries: string[] = ["/inventory"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <InventoryPage />
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

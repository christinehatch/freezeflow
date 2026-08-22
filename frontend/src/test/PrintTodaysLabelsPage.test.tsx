import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackageEligibleForPrint, PackageLabel } from "../api/client";
import { PrintTodaysLabelsPage } from "../pages/PrintTodaysLabelsPage";

describe("PrintTodaysLabelsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows an empty state when nothing is eligible today", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse([])),
    );

    renderPage();

    expect(
      await screen.findByText(
        "No Package Labels packaged today are Ready or Needs Reprint yet.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to Packaging" }),
    ).toHaveAttribute("href", "/packaging");
  });

  it("lists eligible Package Labels across Batches, selects, and previews Avery output", async () => {
    const user = userEvent.setup();
    const packages = [
      createEligiblePackage({
        id: "package-1",
        package_identifier: "PKG-2026-000001",
        batch_number: "Batch 020",
        label: createLabel({
          id: "label-1",
          display_name: "Pork Shoulder",
          status: "Ready",
        }),
      }),
      createEligiblePackage({
        id: "package-2",
        package_identifier: "PKG-2026-000002",
        batch_number: "Batch 021",
        label: createLabel({
          id: "label-2",
          display_name: "Apples",
          status: "Needs Reprint",
        }),
      }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/v1/package-labels/eligible-today")) {
          return apiResponse(packages);
        }
        if (
          url.endsWith("/api/v1/package-labels/preview") &&
          method === "POST"
        ) {
          const body = JSON.parse(String(init?.body)) as {
            package_label_ids: string[];
          };
          const previewed = packages
            .filter((item) => body.package_label_ids.includes(item.label.id))
            .map((item) => item.label);
          return apiResponse(previewed);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderPage();

    await screen.findByText("Pork Shoulder");
    expect(screen.getByText("Apples")).toBeVisible();
    expect(screen.getByText(/Batch 020/)).toBeVisible();
    expect(screen.getByText(/Batch 021/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Select All" }));
    expect(screen.getByText("2 labels selected")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Preview Avery 5163" }),
    );

    const preview = within(await screen.findByLabelText("Avery 5163 sheet 1"));
    expect(preview.getByText("Pork Shoulder")).toBeVisible();
    expect(preview.getByText("Apples")).toBeVisible();
    expect(screen.getByText("2 previewed · 1 sheet")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear Selection" }));
    expect(screen.getByText("0 labels selected")).toBeVisible();
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PrintTodaysLabelsPage />
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

function createLabel(overrides: Partial<PackageLabel> = {}): PackageLabel {
  return {
    id: "label-1",
    package_id: "package-1",
    status: "Ready",
    display_name: "Display Name",
    description: null,
    ingredients_summary: null,
    preparation_summary: null,
    rehydration_instructions: null,
    serving_notes: null,
    net_weight_display: "100.0 g",
    fresh_equivalent_display: "300.0 g fresh",
    created_at: "2026-08-22T18:00:00.000Z",
    updated_at: "2026-08-22T18:00:00.000Z",
    print_events: [],
    ...overrides,
  };
}

function createEligiblePackage(
  overrides: Partial<PackageEligibleForPrint> = {},
): PackageEligibleForPrint {
  return {
    id: "package-1",
    packaging_allocation_id: "allocation-1",
    packaging_operation_id: "operation-1",
    package_type_id: "package-type-1",
    package_type: {
      id: "package-type-1",
      name: "Quart Mylar",
      default_oxygen_absorber: "500cc",
      default_label_template: null,
      notes: null,
      archived: false,
    },
    package_identifier: "PKG-2026-000001",
    packaged_at: "2026-08-22T18:00:00.000Z",
    package_weight_grams: "110.0",
    finished_product_weight_grams: "100.0",
    oxygen_absorber: "500cc",
    storage_location_id: "storage-1",
    storage_location: {
      id: "storage-1",
      name: "Unassigned",
      notes: null,
      archived: false,
    },
    status: "In Storage",
    notes: null,
    label: createLabel(),
    production_batch_id: "batch-1",
    batch_number: "Batch 020",
    ...overrides,
  };
}

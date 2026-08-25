import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Package, StorageLocation } from "../api/client";
import { StorageLocationsPage } from "../pages/StorageLocationsPage";

describe("StorageLocationsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates, archives, and restores Storage Locations outside the active Inventory workflow", async () => {
    const user = userEvent.setup();
    let storageLocations: StorageLocation[] = [
      { id: "unassigned-1", name: "Unassigned", notes: null, archived: false },
    ];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (
          url.endsWith("/api/v1/storage-locations?include_archived=true") &&
          method === "GET"
        ) {
          return apiResponse(storageLocations);
        }
        if (url.endsWith("/api/v1/storage-locations") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          const created: StorageLocation = {
            id: "storage-location-1",
            name: body.name,
            notes: body.notes,
            archived: false,
          };
          storageLocations = [...storageLocations, created];
          return apiResponse(created, 201);
        }
        if (
          url.endsWith(
            "/api/v1/storage-locations/storage-location-1/archive",
          ) &&
          method === "POST"
        ) {
          storageLocations = storageLocations.map((location) =>
            location.id === "storage-location-1"
              ? { ...location, archived: true }
              : location,
          );
          return apiResponse(
            storageLocations.find(
              (location) => location.id === "storage-location-1",
            ),
          );
        }
        if (
          url.endsWith(
            "/api/v1/storage-locations/storage-location-1/restore",
          ) &&
          method === "POST"
        ) {
          storageLocations = storageLocations.map((location) =>
            location.id === "storage-location-1"
              ? { ...location, archived: false }
              : location,
          );
          return apiResponse(
            storageLocations.find(
              (location) => location.id === "storage-location-1",
            ),
          );
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Unassigned" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "← Back" })).toBeVisible();

    const unassignedCard = screen
      .getByRole("heading", { name: "Unassigned" })
      .closest(".storage-location-card") as HTMLElement;
    expect(
      within(unassignedCard).getByRole("button", { name: "Archive" }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Garage Freezer");
    await user.type(screen.getByLabelText("Notes"), "Cool and dry");
    await user.click(
      screen.getByRole("button", { name: "Add Storage Location" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Garage Freezer" }),
    ).toBeVisible();
    expect(screen.getByText("Cool and dry")).toBeVisible();

    const garageCard = screen
      .getByRole("heading", { name: "Garage Freezer" })
      .closest(".storage-location-card") as HTMLElement;
    await user.click(
      within(garageCard).getByRole("button", { name: "Archive" }),
    );

    await screen.findByRole("heading", { name: "Archived Storage Locations" });
    const archivedCard = screen
      .getByRole("heading", { name: "Garage Freezer" })
      .closest(".storage-location-card") as HTMLElement;
    expect(
      within(archivedCard).getByRole("button", { name: "Restore" }),
    ).toBeVisible();

    await user.click(
      within(archivedCard).getByRole("button", { name: "Restore" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Archived Storage Locations" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Garage Freezer" }),
    ).toBeVisible();
  });

  it("edits a Storage Location's name and notes, and links to its filtered Inventory view", async () => {
    const user = userEvent.setup();
    let storageLocations: StorageLocation[] = [
      {
        id: "bin-1",
        name: "Garage Freezer",
        notes: "Cool and dry",
        archived: false,
      },
    ];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (
          url.endsWith("/api/v1/storage-locations?include_archived=true") &&
          method === "GET"
        ) {
          return apiResponse(storageLocations);
        }
        if (
          url.endsWith("/api/v1/storage-locations/bin-1") &&
          method === "PATCH"
        ) {
          const body = JSON.parse(String(init?.body));
          storageLocations = storageLocations.map((location) =>
            location.id === "bin-1" ? { ...location, ...body } : location,
          );
          return apiResponse(storageLocations[0]);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Garage Freezer" });

    const card = screen
      .getByRole("heading", { name: "Garage Freezer" })
      .closest(".storage-location-card") as HTMLElement;
    expect(
      within(card).getByRole("link", { name: "View Contents" }),
    ).toHaveAttribute("href", "/inventory?location=bin-1");

    await user.click(within(card).getByRole("button", { name: "Edit" }));

    const nameInput = within(card).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Chest Freezer");
    const notesInput = within(card).getByLabelText("Notes");
    await user.clear(notesInput);
    await user.type(notesInput, "Moved to the garage corner");
    await user.click(within(card).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("heading", { name: "Chest Freezer" }),
    ).toBeVisible();
    expect(screen.getByText("Moved to the garage corner")).toBeVisible();
    const patchCall = fetch.mock.calls.find(
      ([requestInput, requestInit]) =>
        String(requestInput).endsWith("/api/v1/storage-locations/bin-1") &&
        requestInit?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      name: "Chest Freezer",
      notes: "Moved to the garage corner",
    });
  });

  it("edits Unassigned's notes without sending a rename", async () => {
    const user = userEvent.setup();
    let storageLocations: StorageLocation[] = [
      {
        id: "unassigned-1",
        name: "Unassigned",
        notes: null,
        archived: false,
      },
    ];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (
          url.endsWith("/api/v1/storage-locations?include_archived=true") &&
          method === "GET"
        ) {
          return apiResponse(storageLocations);
        }
        if (
          url.endsWith("/api/v1/storage-locations/unassigned-1") &&
          method === "PATCH"
        ) {
          const body = JSON.parse(String(init?.body));
          storageLocations = storageLocations.map((location) =>
            location.id === "unassigned-1"
              ? { ...location, ...body }
              : location,
          );
          return apiResponse(storageLocations[0]);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Unassigned" });

    const card = screen
      .getByRole("heading", { name: "Unassigned" })
      .closest(".storage-location-card") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Edit" }));

    expect(within(card).getByLabelText("Name")).toBeDisabled();
    await user.type(
      within(card).getByLabelText("Notes"),
      "Default fallback bin",
    );
    await user.click(within(card).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Default fallback bin")).toBeVisible();
    });
    const patchCall = fetch.mock.calls.find(
      ([requestInput, requestInit]) =>
        String(requestInput).endsWith(
          "/api/v1/storage-locations/unassigned-1",
        ) && requestInit?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      notes: "Default fallback bin",
    });
  });

  it("shows structured backend validation and clears it after a successful retry", async () => {
    const user = userEvent.setup();
    let rejectCreate = true;
    let storageLocations: StorageLocation[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") return apiResponse(storageLocations);
        if (rejectCreate) {
          return apiResponse(
            {
              detail: {
                code: "business_rule_violation",
                message: 'A Storage Location named "Pantry" already exists.',
              },
            },
            400,
          );
        }
        const body = JSON.parse(String(init?.body));
        const created: StorageLocation = {
          id: "storage-location-1",
          name: body.name,
          notes: null,
          archived: false,
        };
        storageLocations = [created];
        return apiResponse(created, 201);
      }),
    );

    renderPage();
    await screen.findByText("No active Storage Locations yet.");
    await user.type(screen.getByLabelText("Name"), "Pantry");
    await user.click(
      screen.getByRole("button", { name: "Add Storage Location" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'A Storage Location named "Pantry" already exists.',
    );

    rejectCreate = false;
    await user.click(
      screen.getByRole("button", { name: "Add Storage Location" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("heading", { name: "Pantry" }),
    ).toBeVisible();
  });

  it("returns to whichever page it was opened from, Inventory or Packaging", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/storage-locations?include_archived=true")) {
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage(["/packaging", "/inventory/storage-locations"], 1);
    await screen.findByText("No active Storage Locations yet.");

    await user.click(screen.getByRole("button", { name: "← Back" }));

    expect(await screen.findByText("Origin view: /packaging")).toBeVisible();
  });

  it("prints a bin's contents when it has Packages", async () => {
    const user = userEvent.setup();
    const { createObjectURL, openSpy } = mockPrintPopup();
    const storageLocations: StorageLocation[] = [
      { id: "bin-1", name: "Garage Freezer", notes: null, archived: false },
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/storage-locations?include_archived=true")) {
        return apiResponse(storageLocations);
      }
      if (
        url.includes("/api/v1/inventory?") &&
        url.includes("storage_location_id=bin-1")
      ) {
        return apiResponse([makePackage("Chicken", storageLocations[0])]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Garage Freezer" });

    await user.click(screen.getByRole("button", { name: "Print Contents" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalled();
    expect(
      screen.queryByText("nothing in it", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("shows an inline message and creates no PDF when a bin is empty", async () => {
    const user = userEvent.setup();
    const { createObjectURL } = mockPrintPopup();
    const storageLocations: StorageLocation[] = [
      { id: "bin-1", name: "Garage Freezer", notes: null, archived: false },
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/storage-locations?include_archived=true")) {
        return apiResponse(storageLocations);
      }
      if (
        url.includes("/api/v1/inventory?") &&
        url.includes("storage_location_id=bin-1")
      ) {
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Garage Freezer" });

    await user.click(screen.getByRole("button", { name: "Print Contents" }));

    expect(
      await screen.findByText("Garage Freezer has nothing in it to print."),
    ).toBeVisible();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("Print All Bins includes only non-empty active Storage Locations", async () => {
    const user = userEvent.setup();
    const { createObjectURL } = mockPrintPopup();
    const storageLocations: StorageLocation[] = [
      { id: "bin-1", name: "Bin With Stock", notes: null, archived: false },
      { id: "bin-2", name: "Empty Bin", notes: null, archived: false },
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/storage-locations?include_archived=true")) {
        return apiResponse(storageLocations);
      }
      if (
        url.includes("/api/v1/inventory?") &&
        url.includes("storage_location_id=bin-1")
      ) {
        return apiResponse([makePackage("Apples", storageLocations[0])]);
      }
      if (
        url.includes("/api/v1/inventory?") &&
        url.includes("storage_location_id=bin-2")
      ) {
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Bin With Stock" });

    await user.click(screen.getByRole("button", { name: "Print All Bins" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    const inventoryCalls = fetch.mock.calls.filter(([requestInput]) =>
      String(requestInput).includes("/api/v1/inventory?"),
    );
    expect(inventoryCalls).toHaveLength(2);
    expect(
      screen.queryByText("nothing to print", { exact: false }),
    ).not.toBeInTheDocument();
  });
});

function renderPage(
  initialEntries: string[] = ["/inventory/storage-locations"],
  initialIndex?: number,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            element={<StorageLocationsPage />}
            path="/inventory/storage-locations"
          />
          <Route element={<OriginProbe />} path="/inventory" />
          <Route element={<OriginProbe />} path="/packaging" />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function OriginProbe() {
  const location = useLocation();
  return <div>Origin view: {location.pathname + location.search}</div>;
}

function mockPrintPopup() {
  const openSpy = vi.spyOn(window, "open").mockReturnValue({
    closed: false,
    close: vi.fn(),
    document: {
      title: "",
      body: { replaceChildren: vi.fn(), append: vi.fn() },
      createElement: vi.fn(() => ({
        textContent: "",
        style: { cssText: "" },
      })),
    },
    location: { replace: vi.fn() },
  } as unknown as Window);
  const createObjectURL = vi.fn(() => "blob:print-test");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  return { createObjectURL, openSpy };
}

function makePackage(
  productName: string,
  storageLocation: StorageLocation,
): Package {
  return {
    id: `package-${productName}`,
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
    storage_location_id: storageLocation.id,
    storage_location: storageLocation,
    status: "In Storage",
    notes: null,
    label: {
      id: "label-1",
      package_id: "package-1",
      status: "Ready",
      display_name: productName,
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
  };
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

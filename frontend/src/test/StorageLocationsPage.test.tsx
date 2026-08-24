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

import type { StorageLocation } from "../api/client";
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

function apiResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ success: status < 400, data, meta: {} }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

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

import type { PreparationPreset } from "../api/client";
import { PreparationPresetsPage } from "../pages/PreparationPresetsPage";

describe("PreparationPresetsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates, archives, and restores Preparation Presets", async () => {
    const user = userEvent.setup();
    let presets: PreparationPreset[] = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (
          url.endsWith("/api/v1/preparation-presets?include_archived=true") &&
          method === "GET"
        ) {
          return apiResponse(presets);
        }
        if (url.includes("/api/v1/preparation-presets/suggestions")) {
          return apiResponse([]);
        }
        if (url.endsWith("/api/v1/preparation-presets") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          const created: PreparationPreset = {
            id: "preset-1",
            name: body.name,
            product_name: body.product_name,
            ingredients: body.ingredients,
            preparation_methods: body.preparation_methods,
            notes: body.notes,
            archived: false,
          };
          presets = [...presets, created];
          return apiResponse(created, 201);
        }
        if (
          url.endsWith("/api/v1/preparation-presets/preset-1/archive") &&
          method === "POST"
        ) {
          presets = presets.map((preset) =>
            preset.id === "preset-1" ? { ...preset, archived: true } : preset,
          );
          return apiResponse(
            presets.find((preset) => preset.id === "preset-1"),
          );
        }
        if (
          url.endsWith("/api/v1/preparation-presets/preset-1/restore") &&
          method === "POST"
        ) {
          presets = presets.map((preset) =>
            preset.id === "preset-1" ? { ...preset, archived: false } : preset,
          );
          return apiResponse(
            presets.find((preset) => preset.id === "preset-1"),
          );
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No active Preparation Presets yet.");

    await user.type(screen.getByLabelText("Name"), "Sliced Apples");
    await user.type(screen.getByLabelText("Product Name"), "Apples");
    const ingredientsField = screen.getByRole("combobox", {
      name: "Ingredients",
    });
    await user.type(ingredientsField, "Apples{Enter}");
    const methodsField = screen.getByRole("combobox", {
      name: "Preparation Methods",
    });
    await user.type(methodsField, "Sliced{Enter}");
    await user.click(
      screen.getByRole("button", { name: "Add Preparation Preset" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Sliced Apples" }),
    ).toBeVisible();

    const card = screen
      .getByRole("heading", { name: "Sliced Apples" })
      .closest(".preparation-preset-card") as HTMLElement;
    expect(
      card.querySelector(".preparation-preset-card__product"),
    ).toHaveTextContent("Apples");
    expect(card).toHaveTextContent("Ingredients: Apples");
    expect(card).toHaveTextContent("Preparation Methods: Sliced");
    await user.click(within(card).getByRole("button", { name: "Archive" }));

    await screen.findByRole("heading", {
      name: "Archived Preparation Presets",
    });
    const archivedCard = screen
      .getByRole("heading", { name: "Sliced Apples" })
      .closest(".preparation-preset-card") as HTMLElement;
    await user.click(
      within(archivedCard).getByRole("button", { name: "Restore" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", {
          name: "Archived Preparation Presets",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Sliced Apples" }),
    ).toBeVisible();
  });

  it("edits a Preparation Preset's fields in place", async () => {
    const user = userEvent.setup();
    let presets: PreparationPreset[] = [
      {
        id: "preset-1",
        name: "Sliced Apples",
        product_name: "Apples",
        ingredients: ["Apples"],
        preparation_methods: ["Sliced"],
        notes: null,
        archived: false,
      },
    ];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (
          url.endsWith("/api/v1/preparation-presets?include_archived=true") &&
          method === "GET"
        ) {
          return apiResponse(presets);
        }
        if (url.includes("/api/v1/preparation-presets/suggestions")) {
          return apiResponse([]);
        }
        if (
          url.endsWith("/api/v1/preparation-presets/preset-1") &&
          method === "PATCH"
        ) {
          const body = JSON.parse(String(init?.body));
          presets = presets.map((preset) =>
            preset.id === "preset-1" ? { ...preset, ...body } : preset,
          );
          return apiResponse(presets[0]);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByRole("heading", { name: "Sliced Apples" });

    const card = screen
      .getByRole("heading", { name: "Sliced Apples" })
      .closest(".preparation-preset-card") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Edit" }));

    const nameInput = within(card).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Thin Sliced Apples");
    await user.click(within(card).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("heading", { name: "Thin Sliced Apples" }),
    ).toBeVisible();
    const patchCall = fetch.mock.calls.find(
      ([requestInput, requestInit]) =>
        String(requestInput).endsWith("/api/v1/preparation-presets/preset-1") &&
        requestInit?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      name: "Thin Sliced Apples",
      product_name: "Apples",
      ingredients: ["Apples"],
      preparation_methods: ["Sliced"],
      notes: null,
    });
  });

  it("shows structured backend validation and clears it after a successful retry", async () => {
    const user = userEvent.setup();
    let rejectCreate = true;
    let presets: PreparationPreset[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/api/v1/preparation-presets/suggestions")) {
          return apiResponse([]);
        }
        if (method === "GET") return apiResponse(presets);
        if (rejectCreate) {
          return apiResponse(
            {
              detail: {
                code: "business_rule_violation",
                message:
                  'A Preparation Preset named "Taco Chicken" already exists.',
              },
            },
            400,
          );
        }
        const body = JSON.parse(String(init?.body));
        const created: PreparationPreset = {
          id: "preset-1",
          name: body.name,
          product_name: body.product_name,
          ingredients: body.ingredients,
          preparation_methods: body.preparation_methods,
          notes: null,
          archived: false,
        };
        presets = [created];
        return apiResponse(created, 201);
      }),
    );

    renderPage();
    await screen.findByText("No active Preparation Presets yet.");
    await user.type(screen.getByLabelText("Name"), "Taco Chicken");
    await user.type(screen.getByLabelText("Product Name"), "Taco Chicken");
    await user.click(
      screen.getByRole("button", { name: "Add Preparation Preset" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'A Preparation Preset named "Taco Chicken" already exists.',
    );

    rejectCreate = false;
    await user.click(
      screen.getByRole("button", { name: "Add Preparation Preset" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("heading", { name: "Taco Chicken" }),
    ).toBeVisible();
  });

  it("returns to the Production landing page", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/preparation-presets/suggestions")) {
        return apiResponse([]);
      }
      if (url.endsWith("/api/v1/preparation-presets?include_archived=true")) {
        return apiResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderPage();
    await screen.findByText("No active Preparation Presets yet.");

    await user.click(screen.getByRole("button", { name: "← Back" }));

    expect(await screen.findByText("Origin view: /production")).toBeVisible();
  });
});

function renderPage(
  initialEntries: string[] = ["/production/preparation-presets"],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            element={<PreparationPresetsPage />}
            path="/production/preparation-presets"
          />
          <Route element={<OriginProbe />} path="/production" />
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

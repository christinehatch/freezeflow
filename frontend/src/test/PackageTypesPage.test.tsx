import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackageType } from "../api/client";
import { PackageTypesPage } from "../pages/PackageTypesPage";

describe("PackageTypesPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates and archives Package Types outside the active Packaging workflow", async () => {
    const user = userEvent.setup();
    let packageTypes: PackageType[] = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        if (url.endsWith("/api/v1/package-types") && method === "GET") {
          return apiResponse(packageTypes);
        }
        if (url.endsWith("/api/v1/package-types") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          const created: PackageType = {
            id: "package-type-1",
            name: body.name,
            default_oxygen_absorber: body.default_oxygen_absorber,
            default_label_template: body.default_label_template,
            notes: body.notes,
            archived: false,
          };
          packageTypes = [created];
          return apiResponse(created);
        }
        if (
          url.endsWith("/api/v1/package-types/package-type-1") &&
          method === "PATCH"
        ) {
          const archived = { ...packageTypes[0], archived: true };
          packageTypes = [];
          return apiResponse(archived);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderPage();

    expect(
      await screen.findByText("No active Package Types yet."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to Packaging" }),
    ).toHaveAttribute("href", "/packaging");

    await user.type(screen.getByLabelText("Name"), "Quart Mylar");
    await user.type(screen.getByLabelText("Default Oxygen Absorber"), "500cc");
    await user.type(
      screen.getByLabelText("Default Label Template"),
      "avery-5163",
    );
    await user.type(screen.getByLabelText("Notes"), "Everyday pouch");
    await user.click(screen.getByRole("button", { name: "Add Package Type" }));

    expect(
      await screen.findByRole("heading", { name: "Quart Mylar" }),
    ).toBeVisible();
    expect(screen.getByText("500cc · avery-5163")).toBeVisible();
    expect(screen.getByText("Everyday pouch")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByText("No active Package Types yet."),
    ).toBeVisible();
  });

  it("shows structured backend validation and clears it after a successful retry", async () => {
    const user = userEvent.setup();
    let rejectCreate = true;
    let packageTypes: PackageType[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") return apiResponse(packageTypes);
        if (rejectCreate) {
          return apiResponse(
            {
              detail: {
                code: "PACKAGE_TYPE_INVALID",
                message: "Package Type requires review.",
                errors: [
                  { loc: ["body", "name"], msg: "Name already exists." },
                ],
              },
            },
            422,
          );
        }
        const body = JSON.parse(String(init?.body));
        const created: PackageType = {
          id: "package-type-1",
          name: body.name,
          default_oxygen_absorber: null,
          default_label_template: null,
          notes: null,
          archived: false,
        };
        packageTypes = [created];
        return apiResponse(created);
      }),
    );

    renderPage();
    await screen.findByText("No active Package Types yet.");
    await user.type(screen.getByLabelText("Name"), "Quart Mylar");
    await user.click(screen.getByRole("button", { name: "Add Package Type" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Package Type requires review.; name: Name already exists.",
    );

    rejectCreate = false;
    await user.click(screen.getByRole("button", { name: "Add Package Type" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("heading", { name: "Quart Mylar" }),
    ).toBeVisible();
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PackageTypesPage />
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

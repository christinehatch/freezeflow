import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeveloperToolsPage } from "../pages/DeveloperToolsPage";

describe("DeveloperToolsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("confirms and seeds the Basic Demo through the root developer endpoint", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("http://127.0.0.1:8000/dev/demo/basic");
        expect(init?.method).toBe("POST");
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              action: "basic",
              message: "Basic demo seeded.",
              counts: { freeze_dryers: 2, production_batches: 4, packages: 3 },
            },
            meta: {},
          }),
        } as Response;
      },
    );
    vi.stubGlobal("confirm", confirm);
    vi.stubGlobal("fetch", fetch);

    renderDeveloperToolsPage();
    await user.click(screen.getByRole("button", { name: "Seed Basic Demo" }));

    expect(confirm).toHaveBeenCalledWith(
      "Replace current data with the Basic Demo scenario?",
    );
    expect(await screen.findByText("Basic demo seeded.")).toBeInTheDocument();
    expect(screen.getByText("production batches")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not run a destructive action when confirmation is declined", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    vi.stubGlobal("fetch", fetch);

    renderDeveloperToolsPage();
    await user.click(screen.getByRole("button", { name: "Reset Database" }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("links to the developer-only Design System Gallery", () => {
    renderDeveloperToolsPage();

    expect(
      screen.getByRole("link", { name: "Open Design System Gallery" }),
    ).toHaveAttribute("href", "/developer-tools/design-system");
  });
});

function renderDeveloperToolsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DeveloperToolsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

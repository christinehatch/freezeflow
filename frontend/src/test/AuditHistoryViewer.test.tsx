import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditHistoryViewer } from "../components/AuditHistoryViewer";

describe("AuditHistoryViewer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches and renders audit entries scoped to the given entity when opened", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v1/audit-entries?");
      expect(url).toContain("entity_type=Tray");
      expect(url).toContain("entity_id=tray-1");
      return apiResponse([
        {
          id: "audit-1",
          entity_type: "Tray",
          entity_id: "tray-1",
          field_name: "startingWeightGrams",
          previous_value: "907.000",
          current_value: "905.000",
          observed_at: null,
          corrected_at: "2026-04-26T15:15:00Z",
          reason: "Scale misread.",
        },
      ]);
    });
    vi.stubGlobal("fetch", fetch);

    renderViewer();
    await user.click(screen.getByRole("button", { name: "View History" }));

    expect(
      await screen.findByText("Originally entered: 907.000"),
    ).toBeVisible();
    expect(screen.getByText("Corrected: 905.000")).toBeVisible();
    expect(screen.getByText("Reason: Scale misread.")).toBeVisible();
  });

  it("shows an empty state when there are no corrections", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => apiResponse([])),
    );

    renderViewer();
    await user.click(screen.getByRole("button", { name: "View History" }));

    expect(await screen.findByText("No corrections recorded.")).toBeVisible();
  });
});

function renderViewer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditHistoryViewer entityType="Tray" entityId="tray-1" />
    </QueryClientProvider>,
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedbackModal } from "../components/FeedbackModal";
import { resetActionLogForTests } from "../utils/actionLog";

describe("FeedbackModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetActionLogForTests();
  });

  it("submits the expected FormData, including a parseable context_json, and shows the thank-you confirmation", async () => {
    const user = userEvent.setup();
    let capturedFormData: FormData | undefined;
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/v1/feedback") && init?.method === "POST") {
          capturedFormData = init.body as FormData;
          return apiResponse(
            {
              id: "feedback-1",
              category: "Bug",
              description: "It broke.",
              status: "New",
              submitted_at: "2026-08-26T00:00:00Z",
            },
            201,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderModal(["/reports"]);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Bug" }));
    await user.type(screen.getByLabelText("Description"), "It broke.");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Thank you! Your feedback has been sent."),
    ).toBeVisible();

    expect(capturedFormData?.get("category")).toBe("Bug");
    expect(capturedFormData?.get("description")).toBe("It broke.");
    expect(capturedFormData?.get("page")).toBe("/reports");
    const context = JSON.parse(String(capturedFormData?.get("context_json")));
    expect(context).toMatchObject({
      productionBatchId: null,
      trayId: null,
      packageId: null,
      freezeDryer: null,
    });
    expect(Array.isArray(context.recentActions)).toBe(true);
  });

  it("includes an attached file in the submitted FormData", async () => {
    const user = userEvent.setup();
    let capturedFormData: FormData | undefined;
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/v1/feedback") && init?.method === "POST") {
          capturedFormData = init.body as FormData;
          return apiResponse(
            {
              id: "feedback-1",
              category: "Bug",
              description: "See attached.",
              status: "New",
              submitted_at: "2026-08-26T00:00:00Z",
            },
            201,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderModal(["/reports"]);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Bug" }));
    await user.type(screen.getByLabelText("Description"), "See attached.");
    const file = new File(["fake-image-bytes"], "screenshot.png", {
      type: "image/png",
    });
    await user.upload(
      screen.getByLabelText("Attachments", { exact: false }),
      file,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Thank you! Your feedback has been sent.");

    const uploaded = capturedFormData?.getAll("attachments");
    expect(uploaded).toHaveLength(1);
    expect((uploaded?.[0] as File).name).toBe("screenshot.png");
  });

  it("includes the Production Batch id and Freeze Dryer when rendered on a Batch detail route", async () => {
    const user = userEvent.setup();
    let capturedFormData: FormData | undefined;
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/v1/production-batches/batch-1")) {
          return apiResponse({
            id: "batch-1",
            freeze_dryer: { id: "fd-1", name: "Black" },
          });
        }
        if (url.endsWith("/api/v1/feedback") && init?.method === "POST") {
          capturedFormData = init.body as FormData;
          return apiResponse(
            {
              id: "feedback-1",
              category: "Question",
              description: "How does this batch work?",
              status: "New",
              submitted_at: "2026-08-26T00:00:00Z",
            },
            201,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetch);

    renderModal(["/production/batch-1"]);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Question" }));
    await user.type(
      screen.getByLabelText("Description"),
      "How does this batch work?",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Thank you! Your feedback has been sent.");

    expect(capturedFormData?.get("page")).toBe("/production/batch-1");
    const context = JSON.parse(String(capturedFormData?.get("context_json")));
    expect(context.productionBatchId).toBe("batch-1");
    expect(context.freezeDryer).toEqual({ id: "fd-1", name: "Black" });
  });

  it("requires a category and description before submitting, and never calls the API", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(() => {
      throw new Error("The API should not have been called.");
    });
    vi.stubGlobal("fetch", fetch);

    renderModal(["/reports"]);

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please choose a category.",
    );

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Bug" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please describe what happened.",
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});

function renderModal(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            element={<FeedbackModal onClose={() => {}} />}
            path="/reports"
          />
          <Route
            element={<FeedbackModal onClose={() => {}} />}
            path="/production/:batchId"
          />
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

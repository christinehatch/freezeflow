import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const data = url.includes("/freeze-dryers") ? [] : [];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data, meta: {} }),
        } as Response);
      }),
    );
  });

  it("renders the production workflow shell", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Production Workflow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No Freeze Dryers have been created."),
    ).toBeInTheDocument();
  });
});

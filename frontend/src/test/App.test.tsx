import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

describe("App", () => {
  afterEach(cleanup);

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

  it("toggles the mobile navigation menu open and closed", async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByRole("button", { name: "Open menu" });
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveClass("hidden");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(nav).not.toHaveClass("hidden");
    expect(
      screen.getByRole("link", { name: "Production" }),
    ).toBeInTheDocument();
  });
});

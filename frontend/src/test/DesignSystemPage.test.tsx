import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DesignSystemPage } from "../pages/DesignSystemPage";

describe("DesignSystemPage", () => {
  afterEach(cleanup);

  it("presents the complete developer-only foundation gallery", () => {
    render(<DesignSystemPage />);

    expect(
      screen.getByRole("heading", {
        name: "Freezeflow interface foundations",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Developer tool · design system foundation"),
    ).toBeInTheDocument();
    for (const section of [
      "Color tokens",
      "Typography hierarchy",
      "Spacing scale",
      "Corner radii",
      "Buttons and status badges",
      "Status surfaces",
      "Page and card examples",
    ]) {
      expect(
        screen.getByRole("heading", { name: section }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText(/--ff-color-action-primary · #183c34/),
    ).toBeVisible();
    expect(screen.getByText("4px · --ff-space-1")).toBeVisible();
    expect(
      screen.getByText(/Dashboard is the first product-page pilot/),
    ).toBeVisible();
  });
});

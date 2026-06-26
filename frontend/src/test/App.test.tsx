import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../App";

describe("App", () => {
  it("renders the milestone foundation shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Project Foundation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });
});

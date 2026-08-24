import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { TagAutocompleteField } from "../components/design-system";

function ControlledTagField({
  suggestions,
}: {
  suggestions?: string[];
} = {}) {
  const [values, setValues] = useState<string[]>([]);
  return (
    <TagAutocompleteField
      label="Ingredients"
      suggestions={suggestions}
      values={values}
      onChange={setValues}
    />
  );
}

describe("TagAutocompleteField", () => {
  afterEach(cleanup);

  it("adds a value by clicking a suggestion", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Salt" }));

    expect(screen.getByText("Salt")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("adds a value typed as free text on Enter, without a matching suggestion", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.type(input, "Cumin{Enter}");

    expect(screen.getByText("Cumin")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("removes a value via the chip's remove button and via Backspace", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.type(input, "Salt{Enter}");
    await user.type(input, "Pepper{Enter}");
    expect(screen.getByText("Salt")).toBeInTheDocument();
    expect(screen.getByText("Pepper")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Salt" }));
    expect(
      screen.queryByRole("button", { name: "Remove Salt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Pepper" }),
    ).toBeInTheDocument();

    await user.type(input, "{Backspace}");
    expect(
      screen.queryByRole("button", { name: "Remove Pepper" }),
    ).not.toBeInTheDocument();
  });

  it("filters suggestions by the typed text, case-insensitively", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper", "Cinnamon"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.type(input, "sa");

    expect(screen.getByRole("option", { name: "Salt" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Pepper" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Cinnamon" }),
    ).not.toBeInTheDocument();
  });

  it("navigates suggestions with the keyboard and selects the active one on Enter", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(
      screen.getByRole("button", { name: "Remove Pepper" }),
    ).toBeInTheDocument();
  });

  it("does not offer a suggestion that has already been added", async () => {
    const user = userEvent.setup();
    render(<ControlledTagField suggestions={["Salt", "Pepper"]} />);

    const input = screen.getByRole("combobox", { name: "Ingredients" });
    await user.type(input, "Salt{Enter}");
    await user.click(input);

    expect(
      screen.queryByRole("option", { name: "Salt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pepper" })).toBeInTheDocument();
  });
});

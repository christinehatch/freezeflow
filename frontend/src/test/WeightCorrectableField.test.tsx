import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WeightCorrectableField } from "../components/WeightCorrectableField";

describe("WeightCorrectableField", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the current weight in grams and reveals a unit-aware form", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WeightCorrectableField
        fieldId="starting-weight"
        label="Starting Weight"
        valueGrams="907.000"
        onSave={onSave}
      />,
    );

    expect(screen.getByText("907 g")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Correct Starting Weight" }),
    );

    expect(screen.getByLabelText("Corrected Starting Weight")).toBeVisible();
  });

  it("converts the entered unit to grams before saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WeightCorrectableField
        fieldId="starting-weight"
        label="Starting Weight"
        valueGrams="907.000"
        onSave={onSave}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Correct Starting Weight" }),
    );
    const input = screen.getByLabelText("Corrected Starting Weight");
    await user.clear(input);
    await user.type(input, "1");
    await user.click(
      screen.getByRole("combobox", { name: "Starting Weight unit" }),
    );
    await user.click(screen.getByRole("option", { name: "lb" }));
    await user.click(screen.getByRole("button", { name: "Save Correction" }));

    expect(onSave).toHaveBeenCalledWith("453.592", null);
  });

  it("disables Save Correction while the weight is unchanged", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <WeightCorrectableField
        fieldId="starting-weight"
        label="Starting Weight"
        valueGrams="907.000"
        onSave={onSave}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Correct Starting Weight" }),
    );

    expect(
      screen.getByRole("button", { name: "Save Correction" }),
    ).toBeDisabled();
  });
});

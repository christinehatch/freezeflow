import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CorrectableField } from "../components/CorrectableField";

describe("CorrectableField", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the current value and reveals a correction form on Correct", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Original note.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Correct Notes" }));

    expect(screen.getByLabelText("Corrected Notes")).toHaveValue(
      "Original note.",
    );
  });

  it("calls onSave with the corrected value and a trimmed reason", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Correct Notes" }));
    const input = screen.getByLabelText("Corrected Notes");
    await user.clear(input);
    await user.type(input, "Corrected note.");
    await user.type(
      screen.getByLabelText("Correction reason", { exact: false }),
      "  Scale misread.  ",
    );
    await user.click(screen.getByRole("button", { name: "Save Correction" }));

    expect(onSave).toHaveBeenCalledWith("Corrected note.", "Scale misread.");
  });

  it("passes a null reason when left blank", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Correct Notes" }));
    const input = screen.getByLabelText("Corrected Notes");
    await user.clear(input);
    await user.type(input, "Corrected note.");
    await user.click(screen.getByRole("button", { name: "Save Correction" }));

    expect(onSave).toHaveBeenCalledWith("Corrected note.", null);
  });

  it("disables Save Correction while the value is unchanged", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Correct Notes" }));

    expect(
      screen.getByRole("button", { name: "Save Correction" }),
    ).toBeDisabled();
  });

  it("shows an error message when the save fails and keeps the form open", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Network error."));
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Correct Notes" }));
    const input = screen.getByLabelText("Corrected Notes");
    await user.clear(input);
    await user.type(input, "Corrected note.");
    await user.click(screen.getByRole("button", { name: "Save Correction" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network error.",
    );
    expect(screen.getByLabelText("Corrected Notes")).toBeVisible();
  });

  it("cancels back to the read-only view without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CorrectableField
        fieldId="tray-notes"
        label="Notes"
        value="Original note."
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Correct Notes" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Original note.")).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });
});

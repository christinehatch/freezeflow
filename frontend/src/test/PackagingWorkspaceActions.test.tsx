import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackageLabel } from "../api/client";
import {
  PackageLabelEditor,
  PlannedPackageRecordAction,
} from "../components/PackagingWorkspaceActions";

const draftLabel: PackageLabel = {
  id: "package-label-1",
  package_id: "package-1",
  status: "Draft",
  display_name: "Taco Chicken",
  description: null,
  ingredients_summary: null,
  preparation_summary: null,
  rehydration_instructions: null,
  serving_notes: null,
  net_weight_display: null,
  fresh_equivalent_display: null,
  created_at: "2026-07-08T01:00:00.000Z",
  updated_at: "2026-07-08T01:00:00.000Z",
  print_events: [],
};

describe("PackagingWorkspaceActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("retries a failed post-record refresh without recording the Package twice", async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary refresh failure"))
      .mockResolvedValueOnce(undefined);

    render(
      <PlannedPackageRecordAction
        blockers={[]}
        formatError={(error) =>
          error instanceof Error ? error.message : "Unknown error"
        }
        onRecord={onRecord}
        onRefresh={onRefresh}
        rowNumber={1}
      />,
    );

    const action = within(screen.getByLabelText("Planned Package 1 recording"));
    await user.click(action.getByRole("button", { name: "Record Package" }));
    expect(await action.findByRole("alert")).toHaveTextContent(
      "The Package was recorded, but the latest operation state could not be refreshed",
    );

    await user.click(
      action.getByRole("button", { name: "Retry latest state" }),
    );
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(action.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries a failed post-label-save refresh without saving the label twice", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const readyLabel: PackageLabel = {
      ...draftLabel,
      status: "Ready",
      display_name: "Taco Dinner",
      updated_at: "2026-07-08T01:01:00.000Z",
    };
    const onRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary refresh failure"))
      .mockResolvedValueOnce(readyLabel);

    render(
      <PackageLabelEditor
        formatError={(error) =>
          error instanceof Error ? error.message : "Unknown error"
        }
        label={draftLabel}
        onRefresh={onRefresh}
        onSave={onSave}
        packageIdentifier="PKG-2026-000001"
      />,
    );

    const editor = within(
      screen.getByLabelText("PKG-2026-000001 Package Label editor"),
    );
    const displayName = editor.getByLabelText(
      "PKG-2026-000001 Label Display Name",
    );
    await user.clear(displayName);
    await user.type(displayName, "Taco Dinner");
    await user.click(
      editor.getByRole("button", { name: "Save Package Label" }),
    );
    expect(await editor.findByRole("alert")).toHaveTextContent(
      "The Package Label was saved, but the latest operation state could not be refreshed",
    );

    await user.click(
      editor.getByRole("button", { name: "Retry latest state" }),
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(displayName).toHaveValue("Taco Dinner");
    expect(editor.getByText(/Label status:/)).toHaveTextContent("Ready");
    expect(editor.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adopts authoritative label content and status even when the timestamp is unchanged", () => {
    const { rerender } = render(
      <PackageLabelEditor
        formatError={() => "Unknown error"}
        label={draftLabel}
        onRefresh={vi.fn()}
        onSave={vi.fn()}
        packageIdentifier="PKG-2026-000001"
      />,
    );
    const editor = within(
      screen.getByLabelText("PKG-2026-000001 Package Label editor"),
    );

    rerender(
      <PackageLabelEditor
        formatError={() => "Unknown error"}
        label={{
          ...draftLabel,
          status: "Needs Reprint",
          display_name: "Authoritative Taco Dinner",
          print_events: [
            {
              id: "print-event-authoritative",
              package_label_id: draftLabel.id,
              printed_at: "2026-07-08T01:10:00.000Z",
              recorded_at: "2026-07-08T01:11:00.000Z",
              template: "Avery 5163",
              print_job_id: "print-job-authoritative",
              notes: null,
            },
          ],
        }}
        onRefresh={vi.fn()}
        onSave={vi.fn()}
        packageIdentifier="PKG-2026-000001"
      />,
    );

    expect(
      editor.getByLabelText("PKG-2026-000001 Label Display Name"),
    ).toHaveValue("Authoritative Taco Dinner");
    expect(editor.getByText(/Label status:/)).toHaveTextContent(
      "Needs Reprint",
    );
  });
});

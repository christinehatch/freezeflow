import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Package,
  PackageLabel,
  PackagingOperation,
  PrintEvent,
} from "../api/client";
import { PackageLabelPreview } from "../components/PackageLabelPreview";
import {
  type Avery5163Label,
  paginateAvery5163Items,
} from "../utils/avery5163Labels";

describe("PackageLabelPreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects Ready and Needs Reprint labels while excluding Draft and missing labels", async () => {
    const user = userEvent.setup();
    const readyPackage = createPackage("ready", "Ready");
    const reprintPackage = createPackage("reprint", "Needs Reprint");
    const draftPackage = createPackage("draft", "Draft");
    const missingPackage = {
      ...createPackage("missing", "Ready"),
      label: null as unknown as PackageLabel,
    };
    const onPreview = vi.fn();

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation([
          readyPackage,
          reprintPackage,
          draftPackage,
          missingPackage,
        ])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    expect(preview.getAllByRole("checkbox")).toHaveLength(4);
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-ready Package Label",
      }),
    ).toBeEnabled();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-reprint Package Label",
      }),
    ).toBeEnabled();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-draft Package Label",
      }),
    ).toBeDisabled();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-missing Package Label",
      }),
    ).toBeDisabled();
    expect(
      preview.getByText(/Draft labels cannot be previewed/),
    ).toBeInTheDocument();
    expect(
      preview.getByText(/has no available Package Label/),
    ).toBeInTheDocument();
    expect(preview.getByText("0 labels selected")).toBeInTheDocument();
    expect(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    ).toBeDisabled();

    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    expect(preview.getByText("2 labels selected")).toBeInTheDocument();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-ready Package Label",
      }),
    ).toBeChecked();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-reprint Package Label",
      }),
    ).toBeChecked();

    await user.click(preview.getByRole("button", { name: "Clear Selection" }));
    expect(preview.getByText("0 labels selected")).toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it("renders authoritative preview content and marks it stale after selection changes", async () => {
    const user = userEvent.setup();
    const firstPackage = createPackage("one", "Ready");
    const secondPackage = createPackage("two", "Needs Reprint");
    const authoritativeLabel = {
      ...firstPackage.label,
      display_name: "Authoritative Taco Dinner",
      ingredients_summary: "Chicken, peppers, and salsa",
      net_weight_display: "3.5 oz",
      fresh_equivalent_display: "1 lb fresh",
    };
    const onPreview = vi.fn().mockResolvedValue([authoritativeLabel]);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation([firstPackage, secondPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-one Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );

    expect(onPreview).toHaveBeenCalledWith(["label-one"]);
    expect(preview.getByText("1 previewed · 1 sheet")).toBeInTheDocument();
    const renderedLabel = within(
      preview.getByLabelText("PKG-one Avery 5163 label"),
    );
    expect(
      renderedLabel.getByText("Authoritative Taco Dinner"),
    ).toBeInTheDocument();
    expect(renderedLabel.getByText(/3.5 oz · 1 lb fresh/)).toBeInTheDocument();
    expect(
      renderedLabel.getByText("Chicken, peppers, and salsa"),
    ).toBeInTheDocument();
    expect(renderedLabel.getByText("PKG-one")).toBeInTheDocument();

    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-two Package Label",
      }),
    );
    expect(preview.getByText(/This preview is stale/)).toBeInTheDocument();
    expect(
      preview.getByText("Selection changed. Regenerate the preview."),
    ).toBeInTheDocument();
  });

  it("preserves selection after a structured failure and permits manual retry", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("retry", "Ready");
    const onPreview = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "PACKAGE_LABEL_SELECTION_INVALID: Every selected Package Label must exist.",
        ),
      )
      .mockResolvedValueOnce([recordedPackage.label]);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    const checkbox = preview.getByRole("checkbox", {
      name: "Select PKG-retry Package Label",
    });
    await user.click(checkbox);
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );
    expect(await preview.findByRole("alert")).toHaveTextContent(
      "PACKAGE_LABEL_SELECTION_INVALID",
    );
    expect(checkbox).toBeChecked();
    expect(preview.getByText("1 label selected")).toBeInTheDocument();

    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );
    expect(
      await preview.findByText("1 previewed · 1 sheet"),
    ).toBeInTheDocument();
    expect(onPreview).toHaveBeenCalledTimes(2);
    expect(preview.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prevents duplicate rapid preview requests", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("pending", "Ready");
    let resolvePreview: ((labels: PackageLabel[]) => void) | undefined;
    const onPreview = vi.fn(
      () =>
        new Promise<PackageLabel[]>((resolve) => {
          resolvePreview = resolve;
        }),
    );

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-pending Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );
    const pendingButton = preview.getByRole("button", {
      name: "Preparing Avery 5163 Preview…",
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(onPreview).toHaveBeenCalledTimes(1);

    resolvePreview?.([recordedPackage.label]);
    expect(
      await preview.findByText("1 previewed · 1 sheet"),
    ).toBeInTheDocument();
  });

  it("records initial prints and reprints, opens authoritative output, and preserves append-only history", async () => {
    const user = userEvent.setup();
    const initialPackage = createPackage("initial", "Ready");
    const previousEvent = createPrintEvent("previous", "job-previous", {
      printed_at: "2026-07-07T10:00:00.000Z",
      recorded_at: "2026-07-07T10:01:00.000Z",
      notes: "Original sheet",
    });
    const reprintPackage = {
      ...createPackage("reprint-history", "Needs Reprint"),
      label: {
        ...createPackage("reprint-history", "Needs Reprint").label,
        print_events: [previousEvent],
      },
    };
    const initialEvent = createPrintEvent("initial", "job-shared");
    const reprintEvent = createPrintEvent("reprint", "job-shared");
    const authoritativeInitialLabel = {
      ...initialPackage.label,
      display_name: "Authoritative Initial Taco Dinner",
      status: "Ready" as const,
      updated_at: "2026-07-08T02:00:00.000Z",
      print_events: [initialEvent],
    };
    const authoritativeReprintLabel = {
      ...reprintPackage.label,
      display_name: "Authoritative Reprint Taco Dinner",
      status: "Ready" as const,
      updated_at: "2026-07-08T02:00:00.000Z",
      print_events: [previousEvent, reprintEvent],
    };
    const onPrint = vi.fn().mockResolvedValue({
      print_job_id: "job-shared",
      labels: [authoritativeInitialLabel, authoritativeReprintLabel],
    });
    const onPreview = vi
      .fn()
      .mockResolvedValue([initialPackage.label, reprintPackage.label]);
    const onOpenPrintOutput = vi.fn().mockReturnValue(true);
    const reservedOutput = createReservedPrintOutput();
    const onReservePrintOutput = vi.fn(() => reservedOutput);
    const onRefreshOperation = vi.fn().mockResolvedValue(undefined);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={onOpenPrintOutput}
        onPreview={onPreview}
        onPrint={onPrint}
        onReservePrintOutput={onReservePrintOutput}
        onRefreshOperation={onRefreshOperation}
        operation={createOperation([initialPackage, reprintPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    expect(
      preview.getByText("1 initial print · 1 reprint"),
    ).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );
    expect(
      await preview.findByText("2 previewed · 1 sheet"),
    ).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );

    expect(onPrint).toHaveBeenCalledWith([
      "label-initial",
      "label-reprint-history",
    ]);
    expect(
      await preview.findByText(/Print recorded for 2 Package Labels/),
    ).toHaveTextContent("Print job job-shared");
    expect(onRefreshOperation).toHaveBeenCalledTimes(1);
    expect(onOpenPrintOutput).not.toHaveBeenCalled();
    expect(onReservePrintOutput).toHaveBeenCalledTimes(1);
    expect(onReservePrintOutput.mock.invocationCallOrder[0]).toBeLessThan(
      onPrint.mock.invocationCallOrder[0],
    );
    expect(reservedOutput.load).toHaveBeenCalledTimes(1);
    expect(
      preview.getByText(
        "Authoritative Package Label state changed. Regenerate the preview.",
      ),
    ).toBeInTheDocument();
    expect(reservedOutput.load.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        packageIdentifier: "PKG-initial",
        productName: "Authoritative Initial Taco Dinner",
        netWeightDisplay: "3.5 oz",
        freshEquivalentDisplay: "1 lb fresh",
      }),
      expect.objectContaining({
        packageIdentifier: "PKG-reprint-history",
        productName: "Authoritative Reprint Taco Dinner",
      }),
    ]);

    const initialHistory = within(
      preview.getByLabelText("PKG-initial Print Event history"),
    );
    expect(initialHistory.getByText("Initial Print")).toBeInTheDocument();
    expect(
      initialHistory.getByText(/Print job job-shared/),
    ).toBeInTheDocument();
    const reprintHistory = within(
      preview.getByLabelText("PKG-reprint-history Print Event history"),
    );
    expect(reprintHistory.getByText("Initial Print")).toBeInTheDocument();
    expect(reprintHistory.getByText("Reprint")).toBeInTheDocument();
    expect(
      reprintHistory.getByText(/Print job job-previous/),
    ).toBeInTheDocument();
    expect(
      reprintHistory.getByText(/Print job job-shared/),
    ).toBeInTheDocument();
    const chronologicalEvents = reprintHistory.getAllByRole("listitem");
    expect(chronologicalEvents[0]).toHaveTextContent("Initial Print");
    expect(chronologicalEvents[0]).toHaveTextContent("job-previous");
    expect(chronologicalEvents[0]).toHaveTextContent("Avery 5163");
    expect(chronologicalEvents[0]).toHaveTextContent("Notes: Original sheet");
    expect(chronologicalEvents[0]).toHaveTextContent(
      /Printed .+ · Recorded .+/,
    );
    expect(chronologicalEvents[1]).toHaveTextContent("Reprint");
    expect(chronologicalEvents[1]).toHaveTextContent("job-shared");
    expect(initialPackage.status).toBe("In Storage");
    expect(initialPackage.storage_location.name).toBe("Unassigned");
    expect(initialPackage.label.print_events).toHaveLength(0);
  });

  it("yields to newer authoritative label state after the recorded Print Events refresh", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("authoritative-refresh", "Ready");
    const printEvent = createPrintEvent(
      "authoritative-refresh",
      "job-authoritative-refresh",
    );
    const printedLabel = {
      ...recordedPackage.label,
      updated_at: "2026-07-08T02:00:00.000Z",
      print_events: [printEvent],
    };
    const onPrint = vi.fn().mockResolvedValue({
      print_job_id: "job-authoritative-refresh",
      labels: [printedLabel],
    });
    const { rerender } = render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={() => true}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onRefreshOperation={async () => undefined}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-authoritative-refresh Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(await preview.findByText("Initial Print")).toBeInTheDocument();

    const refreshedPackage = {
      ...recordedPackage,
      label: {
        ...printedLabel,
        status: "Needs Reprint" as const,
        display_name: "Edited after the recorded print",
        updated_at: "2026-07-08T03:00:00.000Z",
      },
    };
    rerender(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={() => true}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onRefreshOperation={async () => undefined}
        operation={createOperation([refreshedPackage])}
      />,
    );

    expect(
      preview.getByText("Edited after the recorded print"),
    ).toBeInTheDocument();
    expect(preview.getByText("Needs Reprint")).toBeInTheDocument();
    expect(
      preview.getByText("0 initial prints · 1 reprint"),
    ).toBeInTheDocument();
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("preserves selection and avoids output when print persistence fails", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("print-retry", "Ready");
    const printedLabel = {
      ...recordedPackage.label,
      print_events: [createPrintEvent("retry", "job-retry")],
    };
    const onPrint = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("PACKAGE_LABEL_SELECTION_INVALID: Label is stale."),
      )
      .mockResolvedValueOnce({
        print_job_id: "job-retry",
        labels: [printedLabel],
      });
    const onOpenPrintOutput = vi.fn().mockReturnValue(true);
    const failedOutput = createReservedPrintOutput();
    const successfulOutput = createReservedPrintOutput();
    const onReservePrintOutput = vi
      .fn()
      .mockReturnValueOnce(failedOutput)
      .mockReturnValueOnce(successfulOutput);
    const onRefreshOperation = vi.fn().mockResolvedValue(undefined);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={onOpenPrintOutput}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onReservePrintOutput={onReservePrintOutput}
        onRefreshOperation={onRefreshOperation}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    const checkbox = preview.getByRole("checkbox", {
      name: "Select PKG-print-retry Package Label",
    });
    await user.click(checkbox);
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(
      await preview.findByText(/Print was not recorded/),
    ).toHaveTextContent("PACKAGE_LABEL_SELECTION_INVALID");
    expect(checkbox).toBeChecked();
    expect(onOpenPrintOutput).not.toHaveBeenCalled();
    expect(onRefreshOperation).not.toHaveBeenCalled();
    expect(failedOutput.close).toHaveBeenCalledTimes(1);
    expect(failedOutput.load).not.toHaveBeenCalled();

    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(
      await preview.findByText(
        "Print recorded for 1 Package Label. Print job job-retry.",
      ),
    ).toBeInTheDocument();
    expect(onPrint).toHaveBeenCalledTimes(2);
    expect(successfulOutput.load).toHaveBeenCalledTimes(1);
    expect(onOpenPrintOutput).not.toHaveBeenCalled();
  });

  it("does not record a Print Event when the browser blocks the output window", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("popup-blocked", "Ready");
    const onPrint = vi.fn();

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onReservePrintOutput={() => null}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-popup-blocked Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );

    expect(
      await preview.findByText(/browser blocked the Avery 5163 output window/),
    ).toHaveTextContent("No Print Events were recorded");
    expect(
      preview.getByText(/Allow popups for Freezeflow/),
    ).toBeInTheDocument();
    expect(onPrint).not.toHaveBeenCalled();
    expect(preview.queryByText(/Print recorded for/)).not.toBeInTheDocument();
  });

  it("prevents duplicate rapid print requests", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("print-pending", "Ready");
    let resolvePrint:
      | ((result: { print_job_id: string; labels: PackageLabel[] }) => void)
      | undefined;
    const onPrint = vi.fn(
      () =>
        new Promise<{ print_job_id: string; labels: PackageLabel[] }>(
          (resolve) => {
            resolvePrint = resolve;
          },
        ),
    );

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={() => true}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onRefreshOperation={async () => undefined}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-print-pending Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    const pendingButton = preview.getByRole("button", {
      name: "Recording Print…",
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(onPrint).toHaveBeenCalledTimes(1);

    resolvePrint?.({
      print_job_id: "job-pending",
      labels: [
        {
          ...recordedPackage.label,
          print_events: [createPrintEvent("pending", "job-pending")],
        },
      ],
    });
    expect(
      await preview.findByText(
        "Print recorded for 1 Package Label. Print job job-pending.",
      ),
    ).toBeInTheDocument();
  });

  it("recovers a post-persistence refresh failure without printing again", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("refresh-failure", "Ready");
    const printedLabel = {
      ...recordedPackage.label,
      print_events: [createPrintEvent("refresh", "job-refresh")],
    };
    const onPrint = vi.fn().mockResolvedValue({
      print_job_id: "job-refresh",
      labels: [printedLabel],
    });
    const onRefreshOperation = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable."))
      .mockResolvedValueOnce(undefined);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={() => true}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onRefreshOperation={onRefreshOperation}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-refresh-failure Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(
      await preview.findByText(
        /Printing was recorded, but the Packaging workspace refresh failed/,
      ),
    ).toBeInTheDocument();
    expect(
      preview.getByText(
        "Print recorded for 1 Package Label. Print job job-refresh.",
      ),
    ).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Retry Workspace Refresh" }),
    );
    await waitFor(() => {
      expect(
        preview.queryByText(/workspace refresh failed/),
      ).not.toBeInTheDocument();
    });
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onRefreshOperation).toHaveBeenCalledTimes(2);
  });

  it("reopens recorded output without creating another Print Event", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("output-failure", "Ready");
    const printedLabel = {
      ...recordedPackage.label,
      print_events: [createPrintEvent("output", "job-output")],
    };
    const onPrint = vi.fn().mockResolvedValue({
      print_job_id: "job-output",
      labels: [printedLabel],
    });
    const reservedOutput = createReservedPrintOutput(false);
    const onOpenPrintOutput = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={onOpenPrintOutput}
        onPreview={vi.fn()}
        onPrint={onPrint}
        onReservePrintOutput={() => reservedOutput}
        onRefreshOperation={async () => undefined}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-output-failure Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(
      await preview.findByText(/browser could not load the Avery 5163 output/),
    ).toBeInTheDocument();
    expect(
      preview.getByText(
        "Print recorded for 1 Package Label. Print job job-output.",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        preview.getByLabelText("PKG-output-failure Print Event history"),
      ).getByText("Initial Print"),
    ).toBeInTheDocument();
    expect(reservedOutput.close).toHaveBeenCalledTimes(1);

    await user.click(
      preview.getByRole("button", {
        name: "Open Recorded Avery 5163 Output",
      }),
    );
    expect(
      await preview.findByText(/browser still blocked the recorded/),
    ).toHaveTextContent("No additional Print Event was recorded");
    expect(onPrint).toHaveBeenCalledTimes(1);

    await user.click(
      preview.getByRole("button", {
        name: "Open Recorded Avery 5163 Output",
      }),
    );
    await waitFor(() => {
      expect(
        preview.queryByRole("button", {
          name: "Open Recorded Avery 5163 Output",
        }),
      ).not.toBeInTheDocument();
    });
    expect(onOpenPrintOutput).toHaveBeenCalledTimes(2);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("shows an authoritative empty preview without fabricating a sheet", async () => {
    const user = userEvent.setup();
    const recordedPackage = createPackage("empty", "Ready");
    const onPreview = vi.fn().mockResolvedValue([]);

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation([recordedPackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("checkbox", {
        name: "Select PKG-empty Package Label",
      }),
    );
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );

    expect(
      await preview.findByText(
        "The authoritative preview returned no eligible Package Labels.",
      ),
    ).toBeInTheDocument();
    expect(preview.getByText("0 previewed · 0 sheets")).toBeInTheDocument();
    expect(
      preview.queryByLabelText(/Avery 5163 sheet/),
    ).not.toBeInTheDocument();
  });

  it("renders ten labels on one sheet and the eleventh on a second sheet", async () => {
    const user = userEvent.setup();
    const packages = Array.from({ length: 11 }, (_, index) =>
      createPackage(`page-${index + 1}`, "Ready"),
    );
    const onPreview = vi
      .fn()
      .mockResolvedValue(
        packages.map((recordedPackage) => recordedPackage.label),
      );

    render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={createOperation(packages)}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );

    const firstSheet = within(
      await preview.findByLabelText("Avery 5163 sheet 1"),
    );
    const secondSheet = within(preview.getByLabelText("Avery 5163 sheet 2"));
    expect(firstSheet.getAllByRole("article")).toHaveLength(10);
    expect(secondSheet.getAllByRole("article")).toHaveLength(1);
    expect(preview.getByText("11 previewed · 2 sheets")).toBeInTheDocument();
  });

  it("deduplicates label IDs and clears selection and preview when the workspace changes", async () => {
    const user = userEvent.setup();
    const originalPackage = createPackage("original", "Ready");
    const duplicatePackage = {
      ...createPackage("duplicate", "Ready"),
      label: {
        ...createPackage("duplicate", "Ready").label,
        id: originalPackage.label.id,
      },
    };
    const printedLabel = {
      ...originalPackage.label,
      print_events: [createPrintEvent("original", "job-deduplicated")],
    };
    const onPreview = vi.fn().mockResolvedValue([originalPackage.label]);
    const onPrint = vi.fn().mockResolvedValue({
      print_job_id: "job-deduplicated",
      labels: [printedLabel],
    });
    const { rerender } = render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onOpenPrintOutput={() => true}
        onPreview={onPreview}
        onPrint={onPrint}
        onRefreshOperation={async () => undefined}
        operation={createOperation([originalPackage, duplicatePackage])}
      />,
    );

    const preview = within(screen.getByLabelText("Package Label preview"));
    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    expect(preview.getByText("1 label selected")).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );
    expect(onPreview).toHaveBeenCalledWith([originalPackage.label.id]);
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(onPrint).toHaveBeenCalledWith([originalPackage.label.id]);
    expect(onPrint).toHaveBeenCalledTimes(1);

    const replacementPackage = createPackage("replacement", "Ready");
    replacementPackage.label = {
      ...replacementPackage.label,
      id: originalPackage.label.id,
    };
    const refreshedOperation = {
      ...createOperation([replacementPackage]),
      id: "operation-2",
      production_batch_id: "batch-2",
    };
    rerender(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={onPreview}
        operation={refreshedOperation}
      />,
    );

    await waitFor(() => {
      expect(preview.getByText("0 labels selected")).toBeInTheDocument();
    });
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-replacement Package Label",
      }),
    ).not.toBeChecked();
    expect(
      preview.getByText("No preview has been generated."),
    ).toBeInTheDocument();
  });

  it("shows preview empty states and no actions for Completed operations", () => {
    const { rerender } = render(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={vi.fn()}
        operation={createOperation([])}
      />,
    );
    expect(
      screen.getByText("No recorded Packages are available for label preview."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No preview has been generated."),
    ).toBeInTheDocument();

    const draftPackage = createPackage("completed", "Draft");
    rerender(
      <PackageLabelPreview
        {...defaultPrintingProps()}
        formatError={formatError}
        onPreview={vi.fn()}
        operation={{
          ...createOperation([draftPackage]),
          status: "Completed",
          completed_at: "2026-07-08T02:00:00.000Z",
        }}
      />,
    );
    expect(
      screen.getByText(/No Package Labels are eligible/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview Avery 5163" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Print Selected Labels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Completed Packaging workspace is read-only/),
    ).toBeInTheDocument();
  });

  it("paginates Avery 5163 sheets at ten labels without persistence", () => {
    expect(paginateAvery5163Items([])).toHaveLength(0);
    expect(paginateAvery5163Items(Array.from({ length: 1 }))).toHaveLength(1);
    expect(paginateAvery5163Items(Array.from({ length: 10 }))).toHaveLength(1);
    const eleven = paginateAvery5163Items(Array.from({ length: 11 }));
    expect(eleven).toHaveLength(2);
    expect(eleven[0]).toHaveLength(10);
    expect(eleven[1]).toHaveLength(1);
    const twentyOne = paginateAvery5163Items(Array.from({ length: 21 }));
    expect(twentyOne.map((sheet) => sheet.length)).toEqual([10, 10, 1]);
  });
});

function createPackage(
  suffix: string,
  status: PackageLabel["status"],
): Package {
  return {
    id: `package-${suffix}`,
    packaging_allocation_id: "allocation-1",
    packaging_operation_id: "operation-1",
    package_type_id: "package-type-1",
    package_type: {
      id: "package-type-1",
      name: "Quart Mylar",
      default_oxygen_absorber: "500cc",
      default_label_template: "Avery 5163",
      notes: null,
      archived: false,
    },
    package_identifier: `PKG-${suffix}`,
    packaged_at: "2026-07-08T01:00:00.000Z",
    package_weight_grams: "105",
    finished_product_weight_grams: "100",
    oxygen_absorber: "500cc",
    storage_location_id: "storage-unassigned",
    storage_location: {
      id: "storage-unassigned",
      name: "Unassigned",
      notes: null,
      archived: false,
    },
    status: "In Storage",
    notes: null,
    label: {
      id: `label-${suffix}`,
      package_id: `package-${suffix}`,
      status,
      display_name: `${status} Taco Dinner`,
      description: null,
      ingredients_summary: null,
      preparation_summary: "Cubed and seasoned",
      rehydration_instructions: null,
      serving_notes: null,
      net_weight_display: "3.5 oz",
      fresh_equivalent_display: "1 lb fresh",
      created_at: "2026-07-08T01:00:00.000Z",
      updated_at: "2026-07-08T01:00:00.000Z",
      print_events: [],
    },
  };
}

function createOperation(packages: Package[]): PackagingOperation {
  return {
    id: "operation-1",
    production_batch_id: "batch-1",
    status: "Open",
    started_at: "2026-07-08T00:55:00.000Z",
    completed_at: null,
    notes: null,
    created_at: "2026-07-08T00:55:00.000Z",
    updated_at: "2026-07-08T00:55:00.000Z",
    packages,
    allocations: [
      {
        id: "allocation-1",
        packaging_operation_id: "operation-1",
        notes: null,
        created_at: "2026-07-08T00:55:00.000Z",
        updated_at: "2026-07-08T00:55:00.000Z",
        selected_weight_grams: "100",
        allocated_weight_grams: "100",
        remaining_weight_grams: "0",
        source_trays: [],
        planned_packages: [],
        packages,
      },
    ],
  };
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown preview error";
}

function createPrintEvent(
  suffix: string,
  printJobId: string,
  overrides: Partial<PrintEvent> = {},
): PrintEvent {
  return {
    id: `print-event-${suffix}`,
    package_label_id: `label-${suffix}`,
    printed_at: "2026-07-08T02:00:00.000Z",
    recorded_at: "2026-07-08T02:01:00.000Z",
    template: "Avery 5163",
    print_job_id: printJobId,
    notes: null,
    ...overrides,
  };
}

function createReservedPrintOutput(loadResult = true) {
  return {
    close: vi.fn(),
    load: vi.fn((labels: Avery5163Label[]) => {
      void labels;
      return loadResult;
    }),
  };
}

function defaultPrintingProps() {
  return {
    onOpenPrintOutput: () => true,
    onPrint: async () => ({ print_job_id: "unused-print-job", labels: [] }),
    onReservePrintOutput: () => createReservedPrintOutput(),
    onRefreshOperation: async () => undefined,
  };
}

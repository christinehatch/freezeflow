import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageLabelUpdate,
  PackageLineCreate,
  PackageType,
  PackagingAllocation,
  PackagingAllocationSourceTray,
  PackagingLoss,
  PackagingOperation,
  PackagingWorksheetItem,
  PlannedPackageInput,
  PlannedPackageRow,
  ProductionBatch,
  StorageLocation,
  Tray,
} from "../api/client";
import { PackagingPage } from "../pages/PackagingPage";
import { TrayDetailsPage } from "../pages/TrayDetailsPage";
import { printAvery5163Labels } from "../utils/avery5163Labels";

const freezeDryer: FreezeDryer = {
  id: "freeze-dryer-1",
  name: "black",
  notes: null,
  archived: false,
  tray_slot_count: 4,
  tray_slots: [
    {
      id: "slot-1",
      freeze_dryer_id: "freeze-dryer-1",
      slot_number: 1,
      label: null,
      archived: false,
    },
    {
      id: "slot-2",
      freeze_dryer_id: "freeze-dryer-1",
      slot_number: 2,
      label: null,
      archived: false,
    },
    {
      id: "slot-3",
      freeze_dryer_id: "freeze-dryer-1",
      slot_number: 3,
      label: null,
      archived: false,
    },
  ],
};

const secondFreezeDryer: FreezeDryer = {
  ...freezeDryer,
  id: "freeze-dryer-2",
  name: "white",
  tray_slots: [
    {
      id: "slot-4",
      freeze_dryer_id: "freeze-dryer-2",
      slot_number: 1,
      label: null,
      archived: false,
    },
  ],
};

const packageType: PackageType = {
  id: "package-type-1",
  name: "Quart Mylar",
  default_oxygen_absorber: "500cc",
  default_label_template: "avery-5163",
  notes: null,
  archived: false,
};

const pintPackageType: PackageType = {
  id: "package-type-2",
  name: "Pint Jar",
  default_oxygen_absorber: "300cc",
  default_label_template: "avery-5163",
  notes: null,
  archived: false,
};

const unassignedStorageLocation: StorageLocation = {
  id: "storage-unassigned",
  name: "Unassigned",
  notes: null,
  archived: false,
};

const pantryStorageLocation: StorageLocation = {
  id: "storage-pantry",
  name: "Pantry",
  notes: null,
  archived: false,
};

describe("PackagingPage", () => {
  const createObjectURL = vi.fn(() => "blob:test-label-pdf");
  const revokeObjectURL = vi.fn();
  const closePrintOutput = vi.fn();
  const replacePrintOutputLocation = vi.fn();
  const open = vi.fn(() => ({
    closed: false,
    close: closePrintOutput,
    location: { replace: replacePrintOutputLocation },
  }));

  beforeEach(() => {
    vi.stubGlobal("open", open);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the Batch discovery loading state until discovery is authoritative", async () => {
    const testState = createPackagingTestState();
    let resolveWorksheet: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          String(input).endsWith("/api/v1/packaging/worksheet") &&
          (init?.method ?? "GET") === "GET"
        ) {
          return new Promise<Response>((resolve) => {
            resolveWorksheet = resolve;
          });
        }
        return testState.fetch(input, init);
      }),
    );

    renderPackagingPage();

    expect(screen.getByText("Finding batches to package.")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Production Batch" }),
    ).not.toBeInTheDocument();

    resolveWorksheet?.(jsonResponseValue(defaultWorksheet()));

    expect(
      await screen.findByRole("combobox", { name: "Production Batch" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Finding batches to package."),
    ).not.toBeInTheDocument();
  });

  it("reveals only the active guided stage while choosing source Trays", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    expect(
      await screen.findByRole("heading", { name: "Choose a batch" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Taco Chicken")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Previously Packaged Pears"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Manage Package Types" }),
    ).toHaveAttribute("href", "/packaging/package-types");

    await startPackagingWorkspace(user);

    expect(await screen.findByText("Taco Chicken")).toBeInTheDocument();
    expect(screen.getByText("238.1 g")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create packages" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Packaging session summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Package and Label details"),
    ).not.toBeInTheDocument();

    const allocationSelection = screen.getByLabelText(
      "Prepare Packaging Allocation",
    );
    const trayTable = within(allocationSelection).getByRole("table");
    const allocationNotes =
      within(allocationSelection).getByLabelText("Allocation Notes");
    const allocationFooter = allocationNotes.closest(
      ".packaging-allocation-save",
    );
    const saveAndContinue = within(allocationSelection).getByRole("button", {
      name: "Save & Continue",
    });
    expect(allocationFooter).not.toBeNull();
    expect(
      trayTable.compareDocumentPosition(allocationFooter!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(saveAndContinue).toBeDisabled();

    await user.click(firstCheckbox());
    expect(saveAndContinue).toBeEnabled();
    expect(saveAndContinue).toHaveClass("primary-action");
    expect(latestAllocationPost()).toBeUndefined();
  });

  it("opens Stage 3 with one focused Bag form and records one Bag at a time", async () => {
    const user = userEvent.setup();
    const sourceTray = defaultWorksheet()[0].eligible_trays[0];
    const allocation = createPackagingAllocation([sourceTray]);
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    expect(
      await screen.findByRole("heading", { name: "Bag 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("238.1 g remaining to package"),
    ).toBeInTheDocument();
    const packagingSummary = screen.getByLabelText("Packaging summary");
    expect(
      within(packagingSummary).getByText("Total in source").parentElement,
    ).toHaveTextContent("238.1 g");
    expect(
      within(packagingSummary).getByText("Bags saved").parentElement,
    ).toHaveTextContent("0");
    expect(packagingSummary).toHaveTextContent(
      "Current Package TypeNot selected",
    );
    expect(screen.queryByText(/Allocation states:/)).not.toBeInTheDocument();

    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "100",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "106",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));

    expect(
      await screen.findByRole("heading", {
        name: "Do you have another bag to package?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /Bag 1/ })).toHaveTextContent(
      "Bag 1Quart Mylar100 gSaved",
    );
    expect(
      screen.getByText("138.1 g remaining to package"),
    ).toBeInTheDocument();
    expect(
      within(packagingSummary).getByText("Bagged").parentElement,
    ).toHaveTextContent("100 g");
    expect(
      within(packagingSummary).getByText("Bags saved").parentElement,
    ).toHaveTextContent("1");
    expect(parseRequestBody(latestPackagePost())).toEqual({
      packages: [
        {
          planned_package_row_id: "planned-package-1",
          package_type_id: packageType.id,
          finished_product_weight_grams: "100.000",
          sealed_package_weight_grams: "106.000",
          oxygen_absorber: "500cc",
          storage_location_id: null,
          notes: null,
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Add another bag" }));
    expect(screen.getByRole("heading", { name: "Bag 2" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Package Type" }),
    ).toHaveTextContent("Quart Mylar");
    expect(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
    ).toHaveValue(null);
  });

  it("keeps validation beside the current Bag and blocks Review while weight remains", async () => {
    const user = userEvent.setup();
    const sourceTray = defaultWorksheet()[0].eligible_trays[0];
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });
    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "300",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "250",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    expect(
      screen.getByText(/Finished Product Weight exceeds the remaining/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sealed Package Weight cannot be lower/),
    ).toBeInTheDocument();

    await user.clear(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "100",
    );
    await user.clear(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "106",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    await screen.findByRole("heading", {
      name: "Do you have another bag to package?",
    });
    expect(
      screen.getByRole("button", { name: "No more bags — Review" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Source 1 has 138.1 g remaining before Review/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Review & labels" }),
    ).not.toBeInTheDocument();
  });

  it("offers Record loss beside Add another bag and reduces Remaining Weight", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-loss-1",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });
    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "200",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "206",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    await screen.findByRole("heading", {
      name: "Do you have another bag to package?",
    });
    expect(screen.getByText("40 g remaining to package")).toBeInTheDocument();

    const recordLossButton = screen.getByRole("button", {
      name: "Record loss",
    });
    await user.click(recordLossButton);

    expect(
      screen.getByRole("heading", { name: "Record Packaging Loss" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Detail/)).not.toBeInTheDocument();
    await user.type(screen.getByRole("spinbutton", { name: "Weight" }), "40");
    await chooseCustomOption(user, "Reason", "Crumbs");
    await user.click(
      screen.getByRole("button", { name: "Save Packaging Loss" }),
    );

    expect(
      await screen.findByText(
        "Packaging Loss recorded · 0 g remaining to package",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("0 g remaining to package")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record loss" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No more bags — Review" }),
    ).toBeEnabled();
    expect(parseRequestBody(latestLossPost())).toEqual({
      weight_grams: "40.000",
      reason: "Crumbs",
      reason_detail: null,
    });

    await user.click(screen.getByText("Allocation history"));
    expect(
      screen.getByText(/Packaging Loss · 40 g · Crumbs/),
    ).toBeInTheDocument();
  });

  it("only collects a Detail for reason Other and rejects it otherwise", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-loss-2",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });
    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "200",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "206",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    await screen.findByRole("heading", {
      name: "Do you have another bag to package?",
    });
    await user.click(screen.getByRole("button", { name: "Record loss" }));
    await user.type(screen.getByRole("spinbutton", { name: "Weight" }), "10");
    await chooseCustomOption(user, "Reason", "Other");

    const detailField = screen.getByLabelText(/Detail/);
    expect(detailField).toBeInTheDocument();
    await user.type(detailField, "Dropped while sealing.");
    await user.click(
      screen.getByRole("button", { name: "Save Packaging Loss" }),
    );

    await screen.findByText(
      "Packaging Loss recorded · 30 g remaining to package",
    );
    expect(parseRequestBody(latestLossPost())).toEqual({
      weight_grams: "10.000",
      reason: "Other",
      reason_detail: "Dropped while sealing.",
    });

    await user.click(screen.getByRole("button", { name: "Record loss" }));
    await chooseCustomOption(user, "Reason", "Sampled");
    expect(screen.queryByLabelText(/Detail/)).not.toBeInTheDocument();
  });

  it("validates the Packaging Loss weight and reason before saving", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-loss-3",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });
    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "200",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "206",
    );
    await waitForBagAutosave(1);
    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    await screen.findByRole("heading", {
      name: "Do you have another bag to package?",
    });
    await user.click(screen.getByRole("button", { name: "Record loss" }));

    await user.click(
      screen.getByRole("button", { name: "Save Packaging Loss" }),
    );
    expect(
      screen.getByText("Enter a weight greater than 0 g."),
    ).toBeInTheDocument();
    expect(screen.getByText("Select a reason.")).toBeInTheDocument();

    await user.type(screen.getByRole("spinbutton", { name: "Weight" }), "500");
    await chooseCustomOption(user, "Reason", "Spilled");
    await user.click(
      screen.getByRole("button", { name: "Save Packaging Loss" }),
    );
    expect(
      screen.getByText(/Weight exceeds the remaining 40 g/),
    ).toBeInTheDocument();
    expect(latestLossPost()).toBeUndefined();
  });

  it("autosaves a new Bag as a Planned Package Row and reuses it when the Bag is saved", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-autosave-1",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "100",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Bag 1" })).toBeDisabled();

    await waitForBagAutosave(1);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(parseRequestBody(latestAllocationPatch())).toEqual({
      planned_packages: [
        {
          package_type_id: null,
          finished_product_weight_grams: "100.000",
          finished_product_weight_unit: "g",
          sealed_package_weight_grams: null,
          sealed_package_weight_unit: "g",
          oxygen_absorber: null,
          storage_location_id: null,
          notes: null,
        },
      ],
    });

    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "106",
    );
    await waitForBagAutosave(1);
    expect(parseRequestBody(latestAllocationPatch())).toEqual({
      planned_packages: [
        {
          id: "planned-package-1",
          package_type_id: packageType.id,
          finished_product_weight_grams: "100.000",
          finished_product_weight_unit: "g",
          sealed_package_weight_grams: "106.000",
          sealed_package_weight_unit: "g",
          oxygen_absorber: "500cc",
          storage_location_id: null,
          notes: null,
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Save Bag 1" }));
    await screen.findByRole("heading", {
      name: "Do you have another bag to package?",
    });
    expect(parseRequestBody(latestPackagePost())).toEqual({
      packages: [
        {
          planned_package_row_id: "planned-package-1",
          package_type_id: packageType.id,
          finished_product_weight_grams: "100.000",
          sealed_package_weight_grams: "106.000",
          oxygen_absorber: "500cc",
          storage_location_id: null,
          notes: null,
        },
      ],
    });
  });

  it("debounces rapid edits into a single autosave request", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-autosave-2",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });

    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "100",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "106",
    );
    expect(allocationPatchRequests()).toHaveLength(0);

    await waitForBagAutosave(1);
    expect(allocationPatchRequests()).toHaveLength(1);
  });

  it("flushes a pending autosave when switching the active source", async () => {
    const user = userEvent.setup();
    const firstTray = createTray({
      id: "tray-flush-1",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const secondTray = createTray({
      id: "tray-flush-2",
      physical_tray_id: "physical-tray-flush-2",
      final_dry_weight_grams: "300",
      latest_weight_grams: "300",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [
        createPackagingAllocation([firstTray], {
          id: "packaging-allocation-flush-1",
        }),
        createPackagingAllocation([secondTray], {
          id: "packaging-allocation-flush-2",
        }),
      ],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });

    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "50",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(allocationPatchRequests()).toHaveLength(0);

    await chooseCustomOption(user, "Product source", "Source 2");
    await waitFor(() => {
      expect(allocationPatchRequests()).toHaveLength(1);
    });
    expect(parseRequestBody(latestAllocationPatch())).toMatchObject({
      planned_packages: [
        expect.objectContaining({
          finished_product_weight_grams: "50.000",
        }),
      ],
    });
  });

  it("blocks Save Bag on an autosave failure and recovers through Retry", async () => {
    const user = userEvent.setup();
    const sourceTray = createTray({
      id: "tray-autosave-error",
      final_dry_weight_grams: "240",
      latest_weight_grams: "240",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [createPackagingAllocation([sourceTray])],
    });
    const testState = createPackagingTestState({ operation });
    let failNextPatch = true;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          failNextPatch &&
          /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+$/.test(
            String(input),
          ) &&
          init?.method === "PATCH"
        ) {
          failNextPatch = false;
          return errorResponse(500, {
            detail: { message: "Autosave temporarily unavailable." },
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 1" });

    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "100",
    );
    expect(
      await screen.findByText("Autosave failed", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Bag 1" })).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Retry saving this Bag" }),
    );
    await waitForBagAutosave(1);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Autosave failed")).not.toBeInTheDocument();
  });

  it("keeps multiple source pools independent and blocks Review when one is overallocated", async () => {
    const user = userEvent.setup();
    const trays = defaultWorksheet()[0].eligible_trays;
    const operation = createPackagingOperation("batch-1", {
      allocations: [
        createPackagingAllocation([trays[0]], {
          id: "packaging-allocation-1",
          remaining_weight_grams: "-5",
        }),
        createPackagingAllocation([trays[1]], {
          id: "packaging-allocation-2",
          remaining_weight_grams: "0",
        }),
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(createPackagingTestState({ operation }).fetch),
    );

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    expect(await screen.findByText("5 g overallocated")).toBeInTheDocument();
    const sourceSelector = screen.getByRole("combobox", {
      name: "Product source",
    });
    await user.click(sourceSelector);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "No more bags — Review" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Source 1 is overallocated by 5 g/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Review & labels" }),
    ).not.toBeInTheDocument();
  });

  it("names the next source instead of presenting Review when another pool remains", async () => {
    const user = userEvent.setup();
    const trays = defaultWorksheet()[0].eligible_trays;
    const existingPackage = createPackage({
      id: "package-source-1-existing",
      packaging_allocation_id: "packaging-allocation-1",
      finished_product_weight_grams: "199.1",
    });
    const firstAllocation = createPackagingAllocation([trays[0]], {
      id: "packaging-allocation-1",
      allocated_weight_grams: "199.1",
      remaining_weight_grams: "39",
      packages: [existingPackage],
    });
    const secondAllocation = createPackagingAllocation([trays[1]], {
      id: "packaging-allocation-2",
      selected_weight_grams: "236",
      allocated_weight_grams: "0",
      remaining_weight_grams: "236",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [firstAllocation, secondAllocation],
      packages: [existingPackage],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(createPackagingTestState({ operation }).fetch),
    );

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await screen.findByRole("heading", { name: "Bag 2" });
    await chooseCustomOption(user, "Package Type", "Quart Mylar");
    await user.type(
      screen.getByRole("spinbutton", { name: "Finished Product Weight" }),
      "39",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Sealed Package Weight" }),
      "45",
    );
    await waitForBagAutosave(2);
    await user.click(screen.getByRole("button", { name: "Save Bag 2" }));

    expect(
      await screen.findByRole("heading", {
        name: "Source 1 is complete. Continue with Source 2?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Source 2" }),
    ).toHaveClass("primary-action");
    expect(
      screen.getByRole("button", { name: "No more bags — Review" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Source 2 has 236 g remaining before Review."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Continue with Source 2" }),
    );
    expect(screen.getByText("236 g remaining to package")).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Bag 3" }),
    );
  });

  it.skip("saves multiple source Trays, advances to Package creation, and restores the prior stage", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    await startPackagingWorkspace(user);
    await screen.findByText("Taco Chicken");
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: "Save & Continue" }));

    expect(
      await screen.findByRole("heading", { name: "Create packages" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Choose trays" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Packaging session summary" }),
    ).toHaveTextContent("423.1 g");
    expect(parseRequestBody(latestAllocationPost()).tray_ids).toEqual([
      "tray-1",
      "tray-2",
    ]);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { name: "Choose trays" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Packaging session summary" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Continue to packages" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Create packages" }),
    ).toBeInTheDocument();
  });

  it("prevents cross-batch selection and excludes already Packaged Trays from the worksheet", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    const batchSelect = await screen.findByLabelText("Production Batch");
    await waitFor(() => {
      expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1");
    });
    expect(screen.queryByText("Taco Chicken")).not.toBeInTheDocument();
    await startPackagingWorkspace(user);
    expect(await screen.findByText("Taco Chicken")).toBeInTheDocument();
    expect(screen.getByText("Apples")).toBeInTheDocument();
    expect(screen.queryByText("Skittles")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Previously Packaged Pears"),
    ).not.toBeInTheDocument();

    expect(batchSelect).toHaveTextContent("Batch 005");
    await user.click(batchSelect);
    expect(
      screen.getByRole("option", { name: /Batch 005.*black/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Batch 006.*white/ }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const allocationSelection = within(
      screen.getByLabelText("Prepare Packaging Allocation"),
    );
    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    );
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("1");

    await user.click(batchSelect);
    await user.click(screen.getByRole("option", { name: /Batch 006.*white/ }));

    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-2");
    expect(screen.queryByText("Skittles")).not.toBeInTheDocument();
    expect(screen.queryByText("Taco Chicken")).not.toBeInTheDocument();
    expect(screen.queryByText("Apples")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next — Choose trays" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Test Browser Back" }));
    await waitFor(() => {
      expect(batchSelect).toHaveTextContent("Batch 005");
      expect(currentPackagingUrl()).toBe(
        "/packaging?batch=batch-1&workspace=1",
      );
    });
    expect(
      await screen.findByLabelText("Packaging Operation workspace"),
    ).toBeInTheDocument();
    const restoredSelection = within(
      screen.getByLabelText("Prepare Packaging Allocation"),
    );
    expect(
      restoredSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("0");
    expect(
      restoredSelection.getByText(
        "No completed Trays are selected for the pending Packaging Allocation.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Test Browser Forward" }),
    );
    await waitFor(() => {
      expect(batchSelect).toHaveTextContent("Batch 006");
      expect(currentPackagingUrl()).toBe("/packaging?batch=batch-2");
    });
  });

  it("starts exactly one Packaging Operation for the selected Production Batch", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-2");

    expect(
      await screen.findByRole("button", { name: "Next — Choose trays" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Batch 006" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Batch 005" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Next — Choose trays" }),
    );
    await screen.findByLabelText("Packaging Operation workspace");
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-2&workspace=1");

    const startRequests = fetchMock().mock.calls.filter(
      ([input, init]) =>
        String(input).endsWith(
          "/api/v1/production-batches/batch-2/packaging-operation",
        ) && init?.method === "POST",
    );
    expect(startRequests).toHaveLength(1);
    expect(parseRequestBody(startRequests[0])).toEqual({});
  });

  it("prevents duplicate Start Packaging requests while the first request is pending", async () => {
    const user = userEvent.setup();
    const operation = createPackagingOperation("batch-2");
    const testState = createPackagingTestState();
    let resolveStart: ((response: Response) => void) | undefined;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          String(input).endsWith(
            "/api/v1/production-batches/batch-2/packaging-operation",
          ) &&
          init?.method === "POST"
        ) {
          return new Promise<Response>((resolve) => {
            resolveStart = resolve;
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-2");

    const startButton = await screen.findByRole("button", {
      name: "Next — Choose trays",
    });
    await user.click(startButton);
    expect(startButton).toBeDisabled();
    await user.click(startButton);

    expect(
      controlledFetch.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith(
            "/api/v1/production-batches/batch-2/packaging-operation",
          ) && init?.method === "POST",
      ),
    ).toHaveLength(1);

    resolveStart?.(await jsonResponseValue(operation));
    expect(
      await screen.findByLabelText("Packaging Operation workspace"),
    ).toBeInTheDocument();
  });

  it("renders structured validation errors, preserves Batch context, and clears the error after retry", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    let rejectStart = true;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          rejectStart &&
          String(input).endsWith(
            "/api/v1/production-batches/batch-2/packaging-operation",
          ) &&
          init?.method === "POST"
        ) {
          return errorResponse(409, {
            detail: {
              code: "PACKAGING_VALIDATION_FAILED",
              message: "Packaging selection requires review.",
              errors: [
                {
                  loc: ["body", "tray_ids"],
                  msg: "A completed Tray is already allocated.",
                  type: "value_error",
                },
              ],
            },
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-2");

    await user.click(
      await screen.findByRole("button", { name: "Next — Choose trays" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "PACKAGING_VALIDATION_FAILED: Packaging selection requires review.; tray ids: A completed Tray is already allocated.",
    );
    expect(alert).not.toHaveTextContent("[object Object]");
    expect(screen.getByLabelText("Production Batch")).toHaveTextContent(
      "Batch 006",
    );
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-2");

    rejectStart = false;
    await user.click(
      screen.getByRole("button", { name: "Next — Choose trays" }),
    );

    expect(
      await screen.findByLabelText("Packaging Operation workspace"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-2&workspace=1");
  });

  it("keeps Package Type administration secondary to active Packaging work", async () => {
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1");

    expect(
      await screen.findByRole("link", { name: "Manage Package Types" }),
    ).toHaveAttribute("href", "/packaging/package-types");
    expect(
      screen.queryByRole("heading", { name: "Create Package Type" }),
    ).not.toBeInTheDocument();
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1");
  });

  it("continues and restores an Open operation without creating another operation", async () => {
    const user = userEvent.setup();
    const operation = createPackagingOperation("batch-1", {
      notes: "saved packaging work",
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1");

    await user.click(
      await screen.findByRole("button", { name: "Next — Choose trays" }),
    );
    expect(
      await screen.findByLabelText("Packaging Operation workspace"),
    ).toHaveTextContent("saved packaging work");
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    expect(packagingOperationPostRequests()).toHaveLength(0);

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    expect(
      await screen.findByLabelText("Packaging Operation workspace"),
    ).toHaveTextContent("saved packaging work");
    expect(screen.getByText("Packaging in progress")).toBeInTheDocument();
    expect(packagingOperationPostRequests()).toHaveLength(0);
  });

  it.skip("renders nested operation totals, Allocations, and source completed Trays", async () => {
    const worksheet = defaultWorksheet();
    const [tacoTray, applesTray] = worksheet[0].eligible_trays;
    tacoTray.notes = "Use the top-rack product first";
    const recordedPackage = createPackage({
      package_type_id: pintPackageType.id,
      package_type: pintPackageType,
      package_identifier: "PKG-2026-000042",
      status: "In Storage",
      packaged_at: "2026-07-08T01:15:00.000Z",
      finished_product_weight_grams: "200",
      package_weight_grams: "207.5",
      oxygen_absorber: "300cc",
      storage_location_id: pantryStorageLocation.id,
      storage_location: pantryStorageLocation,
      notes: "Recorded package notes",
      label: {
        ...createPackage().label,
        status: "Needs Reprint",
        display_name: "Taco Dinner",
        description: "Chicken and vegetables",
        ingredients_summary: "Chicken, cabbage, tomatoes",
        preparation_summary: "Cubed and seasoned",
        rehydration_instructions: "Add two cups of water",
        serving_notes: "Serves two",
        net_weight_display: "7.05 oz",
        fresh_equivalent_display: "1.7 lb fresh",
      },
    });
    const firstAllocation = createPackagingAllocation([tacoTray], {
      id: "packaging-allocation-1",
      notes: "First saved allocation",
      selected_weight_grams: "238.1",
      allocated_weight_grams: "200",
      remaining_weight_grams: "38.1",
      planned_packages: [
        createPlannedPackageRow("planned-package-1", {
          finished_product_weight_grams: "200",
          finished_product_weight_unit: "g",
          sealed_package_weight_grams: "207.5",
          sealed_package_weight_unit: "g",
          oxygen_absorber: "300cc",
          storage_location_id: pantryStorageLocation.id,
          notes: "Planned package notes",
          label_status: "Ready",
          label_display_name: "Taco Dinner Plan",
          label_description: "Planned description",
          label_ingredients_summary: "Planned ingredients",
          label_preparation_summary: "Planned preparation",
          label_rehydration_instructions: "Planned rehydration",
          label_serving_notes: "Planned serving notes",
          label_net_weight_display: "7 oz",
          label_fresh_equivalent_display: "1.7 lb fresh planned",
          recorded_package_id: recordedPackage.id,
        }),
        createPlannedPackageRow("planned-package-2", {
          package_type_id: "missing-package-type",
          storage_location_id: "missing-storage-location",
        }),
      ],
      packages: [recordedPackage],
    });
    const secondAllocation = createPackagingAllocation([applesTray], {
      id: "packaging-allocation-2",
      notes: null,
      selected_weight_grams: "185",
      allocated_weight_grams: "190",
      remaining_weight_grams: "-5",
      planned_packages: [
        createPlannedPackageRow("planned-package-3", {
          package_type_id: null,
          finished_product_weight_grams: "28.349523125",
          finished_product_weight_unit: "oz",
          sealed_package_weight_grams: "453.59237",
          sealed_package_weight_unit: "lb",
          storage_location_id: null,
        }),
      ],
      packages: [],
    });
    const operation = createPackagingOperation("batch-1", {
      notes: "Package the chicken before the apples",
      updated_at: "2026-07-08T01:30:00.000Z",
      allocations: [firstAllocation, secondAllocation],
      packages: firstAllocation.packages,
    });
    const testState = createPackagingTestState({ worksheet, operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const workspaceElement = await screen.findByLabelText(
      "Packaging Operation workspace",
    );
    const workspace = within(workspaceElement);
    expect(workspace.getAllByText("Batch 005").length).toBeGreaterThan(0);
    expect(workspace.getAllByText("black").length).toBeGreaterThan(0);
    expect(workspace.getAllByText("Open").length).toBeGreaterThan(0);
    expect(
      workspace.getByText("Package the chicken before the apples"),
    ).toBeInTheDocument();
    const savedOperationDetails = within(
      workspace
        .getByText("Saved operation details", { selector: "summary" })
        .closest("details")!,
    );
    expect(
      workspace.getByText("Saved operation details", { selector: "summary" }),
    ).toBeInTheDocument();
    expect(
      savedOperationDetails.getByText("Product Sources").parentElement,
    ).toHaveTextContent("2");
    expect(
      savedOperationDetails.getByText("Bags in Progress").parentElement,
    ).toHaveTextContent("2");
    expect(
      savedOperationDetails.getByText("Bags Saved").parentElement,
    ).toHaveTextContent("1");
    expect(
      savedOperationDetails.getByText("Available Completed Trays")
        .parentElement,
    ).toHaveTextContent("0");
    expect(
      savedOperationDetails.getByText("Total in Source").parentElement,
    ).toHaveTextContent("423.1 g");
    expect(
      savedOperationDetails.getByText("Bagged").parentElement,
    ).toHaveTextContent("200 g");
    expect(
      savedOperationDetails.getByText("Remaining to Bag").parentElement,
    ).toHaveTextContent("223.1 g");
    const reviewSummary = within(
      workspace.getByLabelText("Packaging review summary"),
    );
    expect(
      reviewSummary.getByText("Source Trays").parentElement,
    ).toHaveTextContent("2");
    expect(
      reviewSummary.getByText("Allocations in review").parentElement,
    ).toHaveTextContent("2");
    expect(
      reviewSummary.getByText("Package PKG-2026-000042"),
    ).toBeInTheDocument();
    expect(
      reviewSummary.getByText(/Sealed Package Weight 207.5 g/),
    ).toBeInTheDocument();
    expect(
      reviewSummary.getByText(/Pantry · Oxygen absorber 300cc/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Prepare Packaging Allocation"),
    ).not.toBeInTheDocument();
    const allocationOne = within(
      workspace
        .getByRole("heading", { name: "Allocation 1" })
        .closest("article")!,
    );
    expect(
      allocationOne.getByText("First saved allocation"),
    ).toBeInTheDocument();
    expect(
      allocationOne.getByText(
        /1 source completed Tray · 2 planned Package rows · 1 recorded Package/,
      ),
    ).toBeInTheDocument();
    expect(allocationOne.getByText("Slot 1")).toBeInTheDocument();
    expect(allocationOne.getByText("Taco Chicken")).toBeInTheDocument();
    expect(allocationOne.getByText("Imported tray-1")).toBeInTheDocument();
    expect(allocationOne.getAllByText("238.1 g")).toHaveLength(2);
    expect(
      allocationOne.getByText("Use the top-rack product first"),
    ).toBeInTheDocument();

    const allocationTwo = within(
      workspace
        .getByRole("heading", { name: "Allocation 2" })
        .closest("article")!,
    );
    expect(allocationTwo.getAllByText("No notes").length).toBeGreaterThan(0);
    expect(
      allocationTwo.getByText(
        /1 source completed Tray · 1 planned Package row · 0 recorded Packages/,
      ),
    ).toBeInTheDocument();
    expect(allocationTwo.getByText("Slot 2")).toBeInTheDocument();
    expect(allocationTwo.getByText("Apples")).toBeInTheDocument();
    expect(allocationTwo.getByText("Imported tray-2")).toBeInTheDocument();
    expect(allocationTwo.getAllByText("185 g")).toHaveLength(2);
    const plannedPackageOne = within(
      allocationOne
        .getByRole("heading", { name: "Planned Package 1" })
        .closest("article")!,
    );
    expect(plannedPackageOne.getByText("Quart Mylar")).toBeInTheDocument();
    expect(plannedPackageOne.getByText("Pantry")).toBeInTheDocument();
    expect(plannedPackageOne.getByText("200 g")).toBeInTheDocument();
    expect(plannedPackageOne.getByText("207.5 g")).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Recorded Package created"),
    ).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned package notes"),
    ).toBeInTheDocument();
    expect(plannedPackageOne.getByText("Ready")).toBeInTheDocument();
    expect(plannedPackageOne.getByText("Taco Dinner Plan")).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned description"),
    ).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned ingredients"),
    ).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned preparation"),
    ).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned rehydration"),
    ).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("Planned serving notes"),
    ).toBeInTheDocument();
    expect(plannedPackageOne.getByText("7 oz")).toBeInTheDocument();
    expect(
      plannedPackageOne.getByText("1.7 lb fresh planned"),
    ).toBeInTheDocument();

    const plannedPackageTwo = within(
      allocationOne
        .getByRole("heading", { name: "Planned Package 2" })
        .closest("article")!,
    );
    expect(
      plannedPackageTwo.getByText("Package Type unavailable"),
    ).toBeInTheDocument();
    expect(
      plannedPackageTwo.getByText("Storage Location unavailable"),
    ).toBeInTheDocument();
    expect(
      plannedPackageTwo.getByText("Not yet recorded as a Package"),
    ).toBeInTheDocument();
    expect(plannedPackageTwo.getByText("No notes")).toBeInTheDocument();
    const plannedPackageThree = within(
      allocationTwo
        .getByRole("heading", { name: "Planned Package 1" })
        .closest("article")!,
    );
    expect(
      plannedPackageThree.getAllByText("Not specified").length,
    ).toBeGreaterThan(0);
    expect(plannedPackageThree.getByText("1 oz")).toBeInTheDocument();
    expect(plannedPackageThree.getByText("1 lb")).toBeInTheDocument();

    const recordedPackageSummary = within(
      allocationOne
        .getByRole("heading", { name: "PKG-2026-000042" })
        .closest("article")!,
    );
    expect(recordedPackageSummary.getByText("Pint Jar")).toBeInTheDocument();
    expect(recordedPackageSummary.getByText("In Storage")).toBeInTheDocument();
    expect(recordedPackageSummary.getByText("200 g")).toBeInTheDocument();
    expect(recordedPackageSummary.getByText("207.5 g")).toBeInTheDocument();
    expect(recordedPackageSummary.getByText("300cc")).toBeInTheDocument();
    expect(recordedPackageSummary.getByText("Pantry")).toBeInTheDocument();
    expect(
      recordedPackageSummary.getByText("Recorded package notes"),
    ).toBeInTheDocument();
    expect(
      recordedPackageSummary.getAllByText("Needs Reprint").length,
    ).toBeGreaterThan(0);
    expect(recordedPackageSummary.getByText("Taco Dinner")).toBeInTheDocument();
    for (const labelValue of [
      "Chicken and vegetables",
      "Chicken, cabbage, tomatoes",
      "Cubed and seasoned",
      "Add two cups of water",
      "Serves two",
      "7.05 oz",
      "1.7 lb fresh",
    ]) {
      expect(
        recordedPackageSummary.getAllByText(labelValue).length,
      ).toBeGreaterThan(0);
    }
    expect(
      recordedPackageSummary.queryByRole("button", {
        name: "Save Package Label",
      }),
    ).not.toBeInTheDocument();
    expect(
      allocationTwo.getByText(
        "No recorded Packages exist for this Allocation.",
      ),
    ).toBeInTheDocument();

    const timestamps = workspaceElement.querySelectorAll("time");
    expect(Array.from(timestamps).map((time) => time.dateTime)).toEqual(
      expect.arrayContaining([
        operation.started_at,
        operation.updated_at,
        firstAllocation.created_at,
        firstAllocation.updated_at,
      ]),
    );
    expect(
      workspace.getByText(
        "Allocation 1 has incomplete or invalid Planned Package work.",
      ),
    ).toBeInTheDocument();
    expect(
      workspace.getByText(
        "Allocation 2 has incomplete or invalid Planned Package work.",
      ),
    ).toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    expect(
      await screen.findAllByRole("heading", { name: "Planned Package 1" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "PKG-2026-000042" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Taco Dinner").length).toBeGreaterThan(0);
    expect(packagingOperationPostRequests()).toHaveLength(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it("renders unavailable authoritative Allocation weights without numeric artifacts", async () => {
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const allocation = createPackagingAllocation([tray], {
      selected_weight_grams: "not-a-number",
      allocated_weight_grams: "NaN",
      remaining_weight_grams: "Infinity",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const workspace = within(
      await screen.findByLabelText("Packaging Operation workspace"),
    );
    expect(workspace.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(workspace.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    expect(
      workspace.getByText(
        "Allocation 1 has unavailable authoritative weight data.",
      ),
    ).toBeInTheDocument();
    expect(
      workspace.getByText(
        "Allocation 1 has incomplete or invalid Planned Package work.",
      ),
    ).toBeInTheDocument();
  });

  it.skip("keeps balanced weight ineligible until a Package is recorded", async () => {
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const allocation = createPackagingAllocation([tray], {
      selected_weight_grams: "238.1",
      allocated_weight_grams: "238.1",
      remaining_weight_grams: "0",
      packages: [],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText("Not yet eligible for completion"),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText(
        "Allocation 1 requires at least one recorded Package.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No planned Package rows are recorded for this Allocation.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No recorded Packages exist for this Allocation."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record Package" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Package Label" }),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it.skip("shows saved independently balanced Package work as apparently eligible without completing", async () => {
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordedPackage = createPackage({
      finished_product_weight_grams: "238.1",
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [recordedPackage],
      remaining_weight_grams: "0.0005",
      selected_weight_grams: "238.1005",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: [recordedPackage],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText("Appears eligible for completion"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Allocation 1 saved balance"),
    ).toHaveTextContent("Saved balance: Balanced");
    expect(
      screen.getByRole("button", { name: "Complete Packaging" }),
    ).toBeEnabled();
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it("shows every planned-work and Package Label blocker before completion", async () => {
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const missingLabelPackage = {
      ...createPackage({
        id: "package-missing-completion-label",
        finished_product_weight_grams: "100",
      }),
      label: null as unknown as PackageLabel,
    };
    const draftPackage = createPackage({
      id: "package-draft-completion-label",
      finished_product_weight_grams: "138.1",
      label: {
        ...createPackage().label,
        id: "label-draft-completion",
        package_id: "package-draft-completion-label",
        status: "Draft",
      },
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [missingLabelPackage, draftPackage],
      planned_packages: [
        createPlannedPackageRow("planned-package-unrecorded", {
          finished_product_weight_grams: "10",
          sealed_package_weight_grams: "12",
        }),
      ],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText(
        "Allocation 1 has Planned Packages that must be recorded before completion.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText(
        "Allocation 1 has recorded Package Label data that is unavailable.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText(
        "Allocation 1 has Package Labels that are not Ready.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it.skip("updates completion blockers as a planned Package is recorded and its authoritative label becomes Ready", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const plannedPackage = createPlannedPackageRow(
      "planned-package-transition",
      {
        finished_product_weight_grams: "238.1",
        sealed_package_weight_grams: "245",
        label_display_name: "Taco Dinner",
      },
    );
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [],
      planned_packages: [plannedPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: [],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    let eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText(
        "Allocation 1 requires at least one recorded Package.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText(
        "Allocation 1 has Planned Packages that must be recorded before completion.",
      ),
    ).toBeInTheDocument();

    const plannedRow = within(
      screen
        .getByRole("heading", { name: "Planned Package 1" })
        .closest("article")!,
    );
    await user.click(
      plannedRow.getByRole("button", { name: "Record Package" }),
    );

    eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText(
        "Allocation 1 has Package Labels that are not Ready.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.queryByText(
        "Allocation 1 has Planned Packages that must be recorded before completion.",
      ),
    ).not.toBeInTheDocument();
    expect(
      eligibility.queryByText(
        "Allocation 1 requires at least one recorded Package.",
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next — Review" }));
    const labelEditor = within(
      screen.getByLabelText("PKG-2026-000001 Package Label editor"),
    );
    const displayName = labelEditor.getByLabelText(
      "PKG-2026-000001 Label Display Name",
    );
    await user.clear(displayName);
    await user.type(displayName, "Taco Dinner Ready");
    await user.click(
      labelEditor.getByRole("button", { name: "Save Package Label" }),
    );

    await showWorkflowStage(user, "Finish");
    eligibility = within(
      await screen.findByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText("Appears eligible for completion"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete Packaging" }),
    ).toBeEnabled();
    expect(packageLabelPatchRequests()).toHaveLength(1);
    expect(latestPackagePostRequests()).toHaveLength(1);
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it.skip("explicitly completes eligible Packaging and restores authoritative read-only history", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const priorEvent = {
      id: "print-event-before-completion",
      package_label_id: "label-completion",
      printed_at: "2026-07-08T00:50:00.000Z",
      recorded_at: "2026-07-08T00:51:00.000Z",
      template: "Avery 5163",
      print_job_id: "print-job-before-completion",
      notes: null,
    };
    const recordedPackage = createPackage({
      id: "package-completion",
      package_identifier: "PKG-2026-000401",
      finished_product_weight_grams: "238.1",
      label: {
        ...createPackage().label,
        id: "label-completion",
        package_id: "package-completion",
        status: "Ready",
        display_name: "Completed Taco Dinner",
        print_events: [priorEvent],
      },
    });
    const recordedPlan = createPlannedPackageRow("planned-package-completion", {
      recorded_package_id: recordedPackage.id,
      label_status: "Ready",
      label_display_name: "Completed Taco Dinner",
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [recordedPackage],
      planned_packages: [recordedPlan],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    expect(completePackagingPostRequests()).toHaveLength(0);
    await user.click(
      await screen.findByRole("button", { name: "Complete Packaging" }),
    );

    expect(
      await screen.findByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Packaging completion was recorded/),
    ).toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(1);
    expect(parseRequestBody(completePackagingPostRequests()[0])).toEqual({});
    await waitFor(() => {
      expect(packagingOperationGetRequests("batch-1")).toBeGreaterThanOrEqual(
        2,
      );
      expect(worksheetGetRequests()).toBeGreaterThanOrEqual(2);
    });
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Create packages");
    const sourceHistory = within(
      screen.getByLabelText("Allocation 1 source completed Trays"),
    );
    expect(sourceHistory.getByText("Packaged")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Planned Package 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recorded Package created")).toBeInTheDocument();
    await user.click(
      screen.getByText("Recorded Packages · 1", { selector: "summary" }),
    );
    await user.click(
      screen.getAllByText("Package Label · Ready", { selector: "summary" })[0],
    );
    expect(
      within(
        screen.getByLabelText("PKG-2026-000401 Print Event history"),
      ).getByText(/print-job-before-completion/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Print Selected Labels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Package Label" }),
    ).not.toBeInTheDocument();
    expect(packageLabelPatchRequests()).toHaveLength(0);
    expect(printPackageLabelPostRequests()).toHaveLength(0);
    expect(plannedPackagePatchRequests()).toHaveLength(0);
    expect(allocationPostRequests()).toHaveLength(0);
    expect(packagingOperationPostRequests()).toHaveLength(0);
    expect(tray.status).toBe("Completed");
    const completedOperation = testState.getOperation();
    expect(completedOperation?.status).toBe("Completed");
    expect(completedOperation?.allocations[0].source_trays[0].status).toBe(
      "Packaged",
    );
    expect(completedOperation?.allocations[0].planned_packages).toEqual([
      expect.objectContaining({ id: recordedPlan.id }),
    ]);
    expect(completedOperation?.packages[0].label.print_events).toEqual([
      priorEvent,
    ]);

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    expect(
      await screen.findByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(1);
  });

  it("prevents duplicate completion requests while completion is pending", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordedPackage = createPackage({
      finished_product_weight_grams: "238.1",
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [recordedPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    let releaseCompletion: (() => void) | undefined;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          /\/api\/v1\/packaging-operations\/[^/]+\/complete$/.test(
            String(input),
          ) &&
          init?.method === "POST"
        ) {
          return new Promise<Response>((resolve) => {
            releaseCompletion = () => {
              void Promise.resolve(testState.fetch(input, init)).then(resolve);
            };
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await user.click(
      await screen.findByRole("button", { name: "Complete Packaging" }),
    );
    const pendingButton = screen.getByRole("button", {
      name: "Completing Packaging…",
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(completePackagingPostRequests()).toHaveLength(1);

    releaseCompletion?.();
    expect(
      await screen.findByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(1);
  });

  it("preserves Open work after structured completion rejection and permits deliberate retry", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordedPackage = createPackage({
      finished_product_weight_grams: "238.1",
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [recordedPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    let rejectCompletion = true;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          /\/api\/v1\/packaging-operations\/[^/]+\/complete$/.test(
            String(input),
          ) &&
          init?.method === "POST" &&
          rejectCompletion
        ) {
          rejectCompletion = false;
          return errorResponse(422, {
            detail: {
              code: "PACKAGING_OPERATION_INCOMPLETE",
              message: "Authoritative remaining weight is 0.5 g.",
            },
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await user.click(
      await screen.findByRole("button", { name: "Complete Packaging" }),
    );
    expect(
      await screen.findByText(/Packaging was not completed/),
    ).toHaveTextContent("Authoritative remaining weight is 0.5 g.");
    expect(
      within(
        screen.getByLabelText("Packaging Operation workspace"),
      ).getAllByText("Open").length,
    ).toBeGreaterThan(0);
    expect(tray.status).toBe("Completed");
    expect(testState.getOperation()?.status).toBe("Open");
    expect(completePackagingPostRequests()).toHaveLength(1);
    expect(worksheetGetRequests()).toBe(1);

    await user.click(
      screen.getByRole("button", { name: "Complete Packaging" }),
    );
    expect(
      await screen.findByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(2);
  });

  it("retains authoritative completion when refresh fails and retries refresh only", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordedPackage = createPackage({
      finished_product_weight_grams: "238.1",
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [recordedPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    let failCompletedRefresh = false;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (
          /\/api\/v1\/packaging-operations\/[^/]+\/complete$/.test(url) &&
          method === "POST"
        ) {
          const response = testState.fetch(input, init);
          failCompletedRefresh = true;
          return response;
        }
        if (
          url.endsWith(
            "/api/v1/production-batches/batch-1/packaging-operation",
          ) &&
          method === "GET" &&
          failCompletedRefresh
        ) {
          return errorResponse(503, {
            detail: { message: "Completed workspace refresh unavailable." },
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await user.click(
      await screen.findByRole("button", { name: "Complete Packaging" }),
    );
    expect(
      await screen.findByText(
        /completion was recorded, but the authoritative workspace refresh failed/,
      ),
    ).toHaveTextContent("Completed workspace refresh unavailable.");
    expect(
      screen.getByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(1);

    failCompletedRefresh = false;
    await user.click(
      screen.getByRole("button", {
        name: "Retry Completed Workspace Refresh",
      }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText(/authoritative workspace refresh failed/),
      ).not.toBeInTheDocument();
    });
    expect(completePackagingPostRequests()).toHaveLength(1);
    expect(testState.getOperation()?.status).toBe("Completed");
  });

  it.skip("keeps Allocation projections independent and never nets overallocation against remaining product", async () => {
    const user = userEvent.setup();
    const trays = defaultWorksheet()[0].eligible_trays;
    const firstAllocation = createPackagingAllocation([trays[0]], {
      id: "packaging-allocation-1",
      selected_weight_grams: "100",
      allocated_weight_grams: "0",
      remaining_weight_grams: "100",
    });
    const secondPackage = createPackage({
      id: "package-2",
      packaging_allocation_id: "packaging-allocation-2",
      finished_product_weight_grams: "90",
    });
    const secondAllocation = createPackagingAllocation([trays[1]], {
      id: "packaging-allocation-2",
      selected_weight_grams: "100",
      allocated_weight_grams: "90",
      remaining_weight_grams: "10",
      packages: [secondPackage],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [firstAllocation, secondAllocation],
      packages: [secondPackage],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const firstEditor = within(
      await screen.findByLabelText("Allocation 1 Planned Packages editor"),
    );
    await user.click(
      firstEditor.getByRole("button", { name: "Add Planned Package" }),
    );
    await user.selectOptions(
      firstEditor.getByLabelText("Allocation 1 Planned Package 1 Package Type"),
      packageType.id,
    );
    await user.type(
      firstEditor.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight",
      ),
      "110",
    );

    const operationProjection = within(
      await screen.findByLabelText("Projected operation weight totals"),
    );
    expect(
      operationProjection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("200 g");
    expect(
      operationProjection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("0 g");
    expect(
      screen.getByText(
        "Allocation states: 0 Balanced · 1 Remaining · 1 Overallocated · 0 Incomplete",
      ),
    ).toBeInTheDocument();
    const eligibility = within(
      screen.getByLabelText("Packaging completion eligibility"),
    );
    expect(
      eligibility.getByText(
        "Allocation 1 has unsaved Planned Package changes.",
      ),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText("Allocation 1 is overallocated by 10 g."),
    ).toBeInTheDocument();
    expect(
      eligibility.getByText("Allocation 2 has 10 g remaining to package."),
    ).toBeInTheDocument();
    expect(
      firstEditor.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    ).toBeDisabled();
    expect(plannedPackagePatchRequests()).toHaveLength(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it("shows a clear fallback when a nested recorded Package has no Package Label", async () => {
    const packageWithoutLabel = {
      ...createPackage({ package_identifier: "PKG-2026-000077" }),
      label: null,
    } as unknown as Package;
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      remaining_weight_grams: "0",
      packages: [packageWithoutLabel],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: [packageWithoutLabel],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const recordedPackageSummary = within(
      (await screen.findByRole("heading", { name: "PKG-2026-000077" })).closest(
        "article",
      )!,
    );
    expect(
      recordedPackageSummary.getByText(
        "No Package Label is recorded for this Package.",
      ),
    ).toBeInTheDocument();
    expect(
      recordedPackageSummary.queryByRole("button"),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it.skip("keeps an Open operation discoverable when no additional Trays are eligible", async () => {
    const batch = defaultWorksheet()[0].production_batch;
    const operation = createPackagingOperation(batch.id);
    const testState = createPackagingTestState({
      worksheet: [],
      productionBatches: [batch],
      operation,
    });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage(`/packaging?batch=${batch.id}&workspace=1`);

    expect(screen.queryByLabelText("Production Batch")).not.toBeInTheDocument();
    expect((await screen.findAllByText("Batch 005")).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Packaging is in progress. No additional Trays are ready to add.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "No additional completed Trays are available for this Packaging Operation.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No Packaging Allocations have been saved yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No Packaging Allocations have been saved."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create Packages" }),
    ).not.toBeInTheDocument();
  });

  it.skip("shows completed Packaging history without eligible Trays", async () => {
    const user = userEvent.setup();
    const batch = defaultWorksheet()[0].production_batch;
    const historicalPackage = createPackage({
      package_identifier: "PKG-2026-000099",
      label: {
        ...createPackage().label,
        status: "Ready",
        display_name: "Historical Taco Chicken",
      },
    });
    const historicalAllocation = createPackagingAllocation(
      [defaultWorksheet()[0].eligible_trays[0]],
      {
        selected_weight_grams: "238.1",
        allocated_weight_grams: "238.1",
        remaining_weight_grams: "0",
        packages: [historicalPackage],
      },
    );
    const operation = createPackagingOperation(batch.id, {
      status: "Completed",
      completed_at: "2026-07-08T02:00:00.000Z",
      updated_at: "2026-07-08T02:00:00.000Z",
      notes: "Historical packaging notes",
      allocations: [historicalAllocation],
      packages: [historicalPackage],
    });
    const testState = createPackagingTestState({
      worksheet: [],
      productionBatches: [batch],
      operation,
    });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage(`/packaging?batch=${batch.id}`);

    await user.click(
      await screen.findByRole("button", {
        name: "Next — View history",
      }),
    );
    expect(
      await screen.findByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeInTheDocument();
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    expect(
      screen.getByText(
        "It remains available as historical context for this Production Batch.",
      ),
    ).toBeInTheDocument();
    await showWorkflowStage(user, "Create packages");
    expect(screen.getByText("Historical packaging notes")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allocation 1" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByText("Recorded Packages · 1", { selector: "summary" }),
    );
    expect(
      screen.getByRole("heading", { name: "PKG-2026-000099" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Historical Taco Chicken").length,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByLabelText("Packaging Operation workspace")
        .querySelector('time[datetime="2026-07-08T02:00:00.000Z"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create Packages" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finish Packaging" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save & Continue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Allocation 1 Planned Packages editor"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Packaging is already Completed. This historical workspace is not an actionable completion candidate.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Packaging" }),
    ).not.toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(packagingOperationPostRequests()).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "Manage Package Types" }),
    ).toHaveAttribute("href", "/packaging/package-types");
    expect(
      screen.queryByRole("heading", { name: "Create Package Type" }),
    ).not.toBeInTheDocument();
  });

  it("shows an unavailable state for an invalid URL Batch without selecting another Batch", async () => {
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=missing-batch&workspace=1");

    expect(
      await screen.findByText(
        "The selected Production Batch (missing-batch) no longer exists.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Production Batch")).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "Batch 005" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next — Choose trays" }),
    ).not.toBeInTheDocument();
  });

  it("shows a clear state when a completed Batch has neither eligible Trays nor saved work", async () => {
    const batch = defaultWorksheet()[0].production_batch;
    const testState = createPackagingTestState({
      worksheet: [],
      productionBatches: [batch],
    });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage(`/packaging?batch=${batch.id}`);

    expect(
      await screen.findByText(
        "Batch 005 has no completed Trays ready for Packaging and no saved Packaging Operation.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no completed Production Batches are eligible", async () => {
    const testState = createPackagingTestState({
      worksheet: [],
      productionBatches: [],
    });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    expect(
      await screen.findByText("No completed Trays are ready for Packaging."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Production Batch")).not.toBeInTheDocument();
  });

  it("keeps a completed Tray with unavailable Finished Product Weight visible but unselectable", async () => {
    const user = userEvent.setup();
    const worksheet = defaultWorksheet();
    worksheet[0].eligible_trays[0].final_dry_weight_grams = null;
    const operation = createPackagingOperation("batch-1");
    const testState = createPackagingTestState({ worksheet, operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Choose trays");

    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    const unavailableTray = allocationSelection.getByRole("checkbox", {
      name: "Select Slot 1 Taco Chicken",
    });
    expect(unavailableTray).toBeDisabled();
    expect(unavailableTray).not.toBeChecked();
    expect(
      allocationSelection.getByText("Unavailable — weight history incomplete"),
    ).toBeInTheDocument();
    expect(
      allocationSelection.getByText(
        "1 completed Tray has unavailable Finished Product Weight and cannot be selected.",
      ),
    ).toBeInTheDocument();
    expect(allocationSelection.queryByText("NaN g")).not.toBeInTheDocument();

    await user.click(
      allocationSelection.getByRole("button", {
        name: "Select all",
      }),
    );
    expect(unavailableTray).not.toBeChecked();
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("1");
    expect(
      allocationSelection.getByText("Selected Source Weight").parentElement,
    ).toHaveTextContent("185 g");
  });

  it("clears pending selection when a backend refresh allocates the selected Tray", async () => {
    const user = userEvent.setup();
    const worksheet = defaultWorksheet();
    const operation = createPackagingOperation("batch-1");
    const testState = createPackagingTestState({ worksheet, operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    const queryClient = renderPackagingPage(
      "/packaging?batch=batch-1&workspace=1",
    );
    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    );
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("1");

    const allocatedTray = worksheet[0].eligible_trays[0];
    testState.setOperation(
      createPackagingOperation("batch-1", {
        allocations: [createPackagingAllocation([allocatedTray])],
      }),
    );
    await queryClient.invalidateQueries({
      queryKey: ["packaging-operation-by-batch", "batch-1"],
    });

    await waitFor(() => {
      expect(
        allocationSelection.queryByRole("checkbox", {
          name: "Select Slot 1 Taco Chicken",
        }),
      ).not.toBeInTheDocument();
      expect(
        allocationSelection.getByText("Selected Completed Trays").parentElement,
      ).toHaveTextContent("0");
      expect(
        allocationSelection.getByText("Selected Source Weight").parentElement,
      ).toHaveTextContent("0 g");
    });
  });

  it.skip("saves selected Trays as a durable Packaging Allocation and restores it from nested operation state", async () => {
    const user = userEvent.setup();
    const operation = createPackagingOperation("batch-1");
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    const saveButton = allocationSelection.getByRole("button", {
      name: "Save & Continue",
    });
    expect(saveButton).toBeDisabled();
    await user.click(
      allocationSelection.getByRole("button", {
        name: "Select all",
      }),
    );
    await user.type(
      allocationSelection.getByLabelText("Allocation Notes"),
      "  First mixed allocation  ",
    );
    expect(saveButton).toBeEnabled();
    const operationGetsBeforeSave = packagingOperationGetRequests("batch-1");
    const worksheetGetsBeforeSave = worksheetGetRequests();

    await user.click(saveButton);

    expect(
      await screen.findByRole("heading", { name: "Create packages" }),
    ).toBeInTheDocument();
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    expect(allocationPostRequests()).toHaveLength(1);
    expect(String(allocationPostRequests()[0][0])).toMatch(
      /\/api\/v1\/packaging-operations\/packaging-operation-1\/allocate-trays$/,
    );
    expect(parseRequestBody(allocationPostRequests()[0])).toEqual({
      tray_ids: ["tray-1", "tray-2"],
      notes: "First mixed allocation",
    });
    expect(packagingOperationGetRequests("batch-1")).toBeGreaterThan(
      operationGetsBeforeSave,
    );
    expect(worksheetGetRequests()).toBeGreaterThan(worksheetGetsBeforeSave);
    expect(latestPackagePost()).toBeUndefined();
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(
      fetchMock().mock.calls.some(
        ([input, init]) =>
          /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+$/.test(
            String(input),
          ) && init?.method === "PATCH",
      ),
    ).toBe(false);
    expect(
      fetchMock().mock.calls.some(
        ([input, init]) =>
          String(input).endsWith("/api/v1/packages") && init?.method === "POST",
      ),
    ).toBe(false);
    expect(
      screen.queryByRole("button", { name: "Print Avery 5163 Labels" }),
    ).not.toBeInTheDocument();

    const savedAllocation = within(
      (await screen.findByRole("heading", { name: "Allocation 1" })).closest(
        "article",
      )!,
    );
    expect(
      savedAllocation.getByText("First mixed allocation"),
    ).toBeInTheDocument();
    expect(
      savedAllocation.getByText(/2 source completed Trays/),
    ).toBeInTheDocument();
    expect(savedAllocation.getAllByText("423.1 g").length).toBeGreaterThan(0);
    expect(
      savedAllocation.getByText(
        "No planned Package rows are recorded for this Allocation.",
      ),
    ).toBeInTheDocument();
    expect(
      savedAllocation.getByText(
        "No recorded Packages exist for this Allocation.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Prepare Packaging Allocation"),
    ).not.toBeInTheDocument();

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    expect(
      await screen.findByRole("heading", { name: "Allocation 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("First mixed allocation")).toBeInTheDocument();
    expect(allocationPostRequests()).toHaveLength(1);
  });

  it.skip("persists Planned Packages through the Allocation endpoint and restores authoritative nested state", async () => {
    const user = userEvent.setup();
    const trays = defaultWorksheet()[0].eligible_trays;
    const allocation = createPackagingAllocation(trays);
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const editor = within(
      await screen.findByLabelText("Allocation 1 Planned Packages editor"),
    );
    await user.click(
      editor.getByRole("button", { name: "Add Planned Package" }),
    );
    await user.selectOptions(
      editor.getByLabelText("Allocation 1 Planned Package 1 Package Type"),
      packageType.id,
    );
    await user.type(
      editor.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight",
      ),
      "100",
    );
    await user.type(
      editor.getByLabelText("Allocation 1 Planned Package 1 Package Notes"),
      "  First plan  ",
    );
    const projectedTotals = within(
      editor.getByLabelText("Allocation 1 projected weight totals"),
    );
    expect(
      projectedTotals.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("100 g");
    expect(
      projectedTotals.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("323.1 g");
    const operationGetsBeforeSave = packagingOperationGetRequests("batch-1");

    await user.click(
      editor.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );

    expect(
      await editor.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
    expect(plannedPackagePatchRequests()).toHaveLength(1);
    expect(String(plannedPackagePatchRequests()[0][0])).toMatch(
      /\/api\/v1\/packaging-operations\/packaging-operation-1\/allocations\/packaging-allocation-1$/,
    );
    expect(parseRequestBody(plannedPackagePatchRequests()[0])).toEqual({
      planned_packages: [
        {
          package_type_id: packageType.id,
          finished_product_weight_grams: "100.000",
          finished_product_weight_unit: "g",
          sealed_package_weight_grams: null,
          sealed_package_weight_unit: "g",
          oxygen_absorber: "500cc",
          storage_location_id: null,
          notes: "First plan",
          label_display_name: null,
          label_description: null,
          label_ingredients_summary: null,
          label_preparation_summary: null,
          label_rehydration_instructions: null,
          label_serving_notes: null,
          label_net_weight_display: null,
          label_fresh_equivalent_display: null,
        },
      ],
    });
    expect(packagingOperationGetRequests("batch-1")).toBeGreaterThan(
      operationGetsBeforeSave,
    );
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    expect(
      editor.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    ).toBeDisabled();
    const savedAllocation = within(
      screen.getByRole("heading", { name: "Allocation 1" }).closest("article")!,
    );
    expect(savedAllocation.getAllByText("100 g").length).toBeGreaterThan(0);
    expect(savedAllocation.getAllByText("323.1 g").length).toBeGreaterThan(0);
    expect(
      editor.queryByLabelText("Allocation 1 projected weight totals"),
    ).not.toBeInTheDocument();

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const restoredEditor = within(
      await screen.findByLabelText("Allocation 1 Planned Packages editor"),
    );
    expect(
      restoredEditor.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight",
      ),
    ).toHaveValue(100);
    expect(plannedPackagePatchRequests()).toHaveLength(1);
  });

  it.skip("preserves backend row identity while replacement saves remove only the intended plan", async () => {
    const user = userEvent.setup();
    const trays = defaultWorksheet()[0].eligible_trays;
    const allocation = createPackagingAllocation(trays, {
      allocated_weight_grams: "100",
      remaining_weight_grams: "323.1",
      planned_packages: [
        createPlannedPackageRow("planned-package-1", {
          finished_product_weight_grams: "100",
        }),
      ],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const editor = within(
      await screen.findByLabelText("Allocation 1 Planned Packages editor"),
    );
    await user.type(
      editor.getByLabelText("Allocation 1 Planned Package 1 Package Notes"),
      "  keep first  ",
    );
    await user.click(
      editor.getByRole("button", { name: "Add Planned Package" }),
    );
    await user.selectOptions(
      editor.getByLabelText("Allocation 1 Planned Package 2 Package Type"),
      packageType.id,
    );
    await user.type(
      editor.getByLabelText(
        "Allocation 1 Planned Package 2 Finished Product Weight",
      ),
      "50",
    );
    await user.click(
      editor.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );

    expect(
      await editor.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
    expect(plannedPackagePatchRequests()).toHaveLength(1);
    const firstSave = parseRequestBody(plannedPackagePatchRequests()[0]);
    expect(firstSave.planned_packages).toHaveLength(2);
    expect(firstSave.planned_packages[0]).toMatchObject({
      id: "planned-package-1",
      notes: "keep first",
    });
    expect(firstSave.planned_packages[1]).not.toHaveProperty("id");
    expect(firstSave.planned_packages[1]).not.toHaveProperty("key");
    expect(firstSave.planned_packages[1]).not.toHaveProperty(
      "recorded_package_id",
    );

    await user.click(
      editor.getByRole("button", {
        name: "Remove Allocation 1 Planned Package 1",
      }),
    );
    await user.click(
      editor.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );

    expect(plannedPackagePatchRequests()).toHaveLength(2);
    expect(
      parseRequestBody(plannedPackagePatchRequests()[1]).planned_packages,
    ).toEqual([
      expect.objectContaining({
        id: "planned-package-2",
        finished_product_weight_grams: "50.000",
      }),
    ]);
    expect(
      await editor.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
    const savedAllocation = within(
      screen.getByRole("heading", { name: "Allocation 1" }).closest("article")!,
    );
    expect(savedAllocation.getAllByText("50 g").length).toBeGreaterThan(0);
    expect(savedAllocation.getAllByText("373.1 g").length).toBeGreaterThan(0);

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const restoredEditor = within(
      await screen.findByLabelText("Allocation 1 Planned Packages editor"),
    );
    expect(
      restoredEditor.getAllByRole("heading", {
        name: "Pending Planned Package 1",
      }),
    ).toHaveLength(1);
    expect(
      restoredEditor.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight",
      ),
    ).toHaveValue(50);
    expect(plannedPackagePatchRequests()).toHaveLength(2);
  });

  it.skip("records an eligible Planned Package through its owning Allocation and restores authoritative inventory", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordablePlan = createPlannedPackageRow("planned-recordable", {
      finished_product_weight_grams: "100",
      sealed_package_weight_grams: "999",
      storage_location_id: null,
      notes: "Record this plan",
      label_display_name: "Taco Dinner",
      label_description: "Dinner pouch",
    });
    const incompletePlan = createPlannedPackageRow("planned-incomplete", {
      finished_product_weight_grams: "50",
      sealed_package_weight_grams: null,
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "150",
      remaining_weight_grams: "88.1",
      planned_packages: [recordablePlan, incompletePlan],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const plannedRows = within(
      await screen.findByLabelText("Allocation 1 planned Package rows"),
    );
    const firstPlan = within(
      plannedRows
        .getByRole("heading", { name: "Planned Package 1" })
        .closest("article")!,
    );
    const secondPlan = within(
      plannedRows
        .getByRole("heading", { name: "Planned Package 2" })
        .closest("article")!,
    );
    expect(
      firstPlan.getByRole("button", { name: "Record Package" }),
    ).toBeEnabled();
    expect(
      secondPlan.getByRole("button", { name: "Record Package" }),
    ).toBeDisabled();
    expect(
      secondPlan.getByText(
        "Enter a valid Sealed Package Weight and save the plan.",
      ),
    ).toBeInTheDocument();

    await user.click(firstPlan.getByRole("button", { name: "Record Package" }));

    expect(
      (await screen.findAllByText("PKG-2026-000001")).length,
    ).toBeGreaterThan(0);
    expect(latestPackagePost()).toBeDefined();
    expect(String(latestPackagePost()?.[0])).toMatch(
      /\/api\/v1\/packaging-operations\/packaging-operation-1\/allocations\/packaging-allocation-1\/packages$/,
    );
    expect(parseRequestBody(latestPackagePost())).toEqual({
      packages: [{ planned_package_row_id: "planned-recordable" }],
    });
    const savedAllocation = within(
      screen.getByRole("heading", { name: "Allocation 1" }).closest("article")!,
    );
    expect(savedAllocation.getAllByText("150 g").length).toBeGreaterThan(0);
    expect(savedAllocation.getAllByText("88.1 g").length).toBeGreaterThan(0);
    expect(savedAllocation.getAllByText("999 g").length).toBeGreaterThan(0);
    expect(savedAllocation.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(
      savedAllocation.getAllByText("Recorded Package created").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/recorded Package history cannot be reconciled safely/),
    ).toBeInTheDocument();
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(printPackageLabelPostRequests()).toHaveLength(0);
    const persistedOperation = testState.getOperation();
    const persistedPackage = persistedOperation?.packages[0];
    expect(persistedOperation?.status).toBe("Open");
    expect(persistedOperation?.allocations[0].source_trays[0].id).toBe(tray.id);
    expect(persistedPackage).toMatchObject({
      packaging_allocation_id: allocation.id,
      packaging_operation_id: operation.id,
      status: "In Storage",
      storage_location: { name: "Unassigned" },
    });
    expect(tray.status).toBe("Completed");

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    expect(
      await screen.findByRole("heading", { name: "PKG-2026-000001" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("PKG-2026-000001 Package Label editor"),
    ).toBeInTheDocument();
    expect(latestPackagePost()).toBeDefined();
  });

  it.skip("prevents duplicate Package recording and preserves the plan across a structured failure and retry", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "100",
      remaining_weight_grams: "138.1",
      planned_packages: [
        createPlannedPackageRow("planned-retry", {
          finished_product_weight_grams: "100",
          sealed_package_weight_grams: "105",
        }),
      ],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
    });
    const testState = createPackagingTestState({ operation });
    let resolveRecording: ((response: Response) => void) | undefined;
    let holdFirstRecording = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          holdFirstRecording &&
          /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+\/packages$/.test(
            String(input),
          ) &&
          init?.method === "POST"
        ) {
          return new Promise<Response>((resolve) => {
            resolveRecording = resolve;
          });
        }
        return testState.fetch(input, init);
      }),
    );

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const recording = within(
      await screen.findByLabelText("Planned Package 1 recording"),
    );
    const recordButton = recording.getByRole("button", {
      name: "Record Package",
    });
    await user.click(recordButton);
    const pendingButton = recording.getByRole("button", {
      name: "Recording Package…",
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(latestPackagePostRequests()).toHaveLength(1);

    resolveRecording?.(
      await errorResponse(409, {
        detail: {
          code: "PACKAGE_RECORDING_CONFLICT",
          message: "The Planned Package changed before it was recorded.",
        },
      }),
    );
    expect(await recording.findByRole("alert")).toHaveTextContent(
      "PACKAGE_RECORDING_CONFLICT: The Planned Package changed before it was recorded.",
    );
    expect(
      screen.getByRole("heading", { name: "Planned Package 1" }),
    ).toBeInTheDocument();

    holdFirstRecording = false;
    await user.click(recording.getByRole("button", { name: "Record Package" }));
    expect(
      await screen.findByRole("heading", { name: "PKG-2026-000001" }),
    ).toBeInTheDocument();
    expect(latestPackagePostRequests()).toHaveLength(2);
  });

  it("edits every persistent Package Label field and derives Ready from authoritative refresh", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const recordedPackage = createPackage({
      label: {
        ...createPackage().label,
        status: "Draft",
        display_name: "Original Taco Chicken",
        description: "Remove me",
      },
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
      packages: [recordedPackage],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const editor = within(
      await screen.findByLabelText("PKG-2026-000001 Package Label editor"),
    );
    const displayName = editor.getByLabelText(
      "PKG-2026-000001 Label Display Name",
    );
    await user.clear(displayName);
    expect(editor.getByText("Display Name is required.")).toBeInTheDocument();
    expect(
      editor.getByRole("button", { name: "Save Package Label" }),
    ).toBeDisabled();
    const values = [
      ["Display Name", "  Taco Dinner  "],
      ["Ingredients Summary", "  Chicken, peppers  "],
      ["Preparation Summary", "  Cubed and seasoned  "],
      ["Rehydration Instructions", "  Add warm water  "],
      ["Serving Notes", "  Serves two  "],
      ["Net Weight Display", "  3.5 oz  "],
      ["Fresh Equivalent Display", "  1 lb fresh  "],
    ] as const;
    for (const [fieldName, value] of values) {
      const field = editor.getByLabelText(`PKG-2026-000001 Label ${fieldName}`);
      await user.clear(field);
      await user.type(field, value);
    }
    await user.clear(
      editor.getByLabelText("PKG-2026-000001 Label Description"),
    );
    await user.click(
      editor.getByRole("button", { name: "Save Package Label" }),
    );

    expect(await screen.findByText("Package Label saved")).toBeInTheDocument();
    expect(packageLabelPatchRequests()).toHaveLength(1);
    expect(String(packageLabelPatchRequests()[0][0])).toMatch(
      /\/api\/v1\/packages\/package-1\/label$/,
    );
    expect(parseRequestBody(packageLabelPatchRequests()[0])).toEqual({
      display_name: "Taco Dinner",
      description: null,
      ingredients_summary: "Chicken, peppers",
      preparation_summary: "Cubed and seasoned",
      rehydration_instructions: "Add warm water",
      serving_notes: "Serves two",
      net_weight_display: "3.5 oz",
      fresh_equivalent_display: "1 lb fresh",
    });
    expect(parseRequestBody(packageLabelPatchRequests()[0])).not.toHaveProperty(
      "status",
    );
    const recordedSummary = within(
      screen
        .getByLabelText("PKG-2026-000001 Package Label editor")
        .closest("article")!,
    );
    expect(recordedSummary.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(recordedSummary.getByText("Taco Dinner")).toBeInTheDocument();
    expect(
      recordedSummary.getAllByText("Chicken, peppers").length,
    ).toBeGreaterThan(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(printPackageLabelPostRequests()).toHaveLength(0);
    const persistedPackage = testState.getOperation()?.packages[0];
    expect(persistedPackage).toMatchObject({
      id: recordedPackage.id,
      package_identifier: recordedPackage.package_identifier,
      packaged_at: recordedPackage.packaged_at,
      finished_product_weight_grams:
        recordedPackage.finished_product_weight_grams,
      package_weight_grams: recordedPackage.package_weight_grams,
      status: recordedPackage.status,
      storage_location_id: recordedPackage.storage_location_id,
    });
    expect(testState.getOperation()?.allocations[0].source_trays[0].id).toBe(
      tray.id,
    );
    expect(tray.status).toBe("Completed");

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    expect(await screen.findByDisplayValue("Taco Dinner")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Chicken, peppers")).toBeInTheDocument();
    expect(packageLabelPatchRequests()).toHaveLength(1);
  });

  it("prevents duplicate label saves, preserves failed edits, and accepts authoritative Needs Reprint state", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const printedPackage = createPackage({
      label: {
        ...createPackage().label,
        status: "Ready",
        print_events: [
          {
            id: "print-event-1",
            package_label_id: "package-label-1",
            printed_at: "2026-07-08T01:05:00.000Z",
            recorded_at: "2026-07-08T01:05:00.000Z",
            template: "Avery 5163",
            print_job_id: "print-job-1",
            notes: null,
          },
        ],
      },
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "238.1",
      packages: [printedPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "238.1",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    let resolveFirstSave: ((response: Response) => void) | undefined;
    let holdFirstSave = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          holdFirstSave &&
          /\/api\/v1\/packages\/[^/]+\/label$/.test(String(input)) &&
          init?.method === "PATCH"
        ) {
          return new Promise<Response>((resolve) => {
            resolveFirstSave = resolve;
          });
        }
        return testState.fetch(input, init);
      }),
    );

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Review & labels");
    await user.click(
      screen.getByText("PKG-2026-000001 · Ready", { selector: "summary" }),
    );
    const editor = within(
      await screen.findByLabelText("PKG-2026-000001 Package Label editor"),
    );
    const displayName = editor.getByLabelText(
      "PKG-2026-000001 Label Display Name",
    );
    await user.clear(displayName);
    await user.type(displayName, "Printed Taco Dinner");
    await user.click(
      editor.getByRole("button", { name: "Save Package Label" }),
    );
    const savingButton = editor.getByRole("button", {
      name: "Saving Package Label…",
    });
    expect(savingButton).toBeDisabled();
    await user.click(savingButton);
    expect(packageLabelPatchRequests()).toHaveLength(1);

    resolveFirstSave?.(
      await errorResponse(422, {
        detail: {
          code: "LABEL_VALIDATION_FAILED",
          message: "The Package Label could not be saved.",
        },
      }),
    );
    expect(await editor.findByRole("alert")).toHaveTextContent(
      "LABEL_VALIDATION_FAILED: The Package Label could not be saved.",
    );
    expect(displayName).toHaveValue("Printed Taco Dinner");

    holdFirstSave = false;
    await user.click(
      editor.getByRole("button", { name: "Save Package Label" }),
    );
    expect(await editor.findByText("Package Label saved")).toBeInTheDocument();
    expect(packageLabelPatchRequests()).toHaveLength(2);
    expect(editor.getByText(/Label status:/)).toHaveTextContent(
      "Needs Reprint",
    );
    expect(printPackageLabelPostRequests()).toHaveLength(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
  });

  it("selects only eligible Package Labels and previews them without persistence", async () => {
    const user = userEvent.setup();
    const tray = defaultWorksheet()[0].eligible_trays[0];
    const readyPackage = createPackage({
      id: "package-ready",
      package_identifier: "PKG-2026-000101",
      label: {
        ...createPackage().label,
        id: "label-ready",
        package_id: "package-ready",
        status: "Ready",
        display_name: "Ready Taco Dinner",
      },
    });
    const reprintPackage = createPackage({
      id: "package-reprint",
      package_identifier: "PKG-2026-000102",
      label: {
        ...createPackage().label,
        id: "label-reprint",
        package_id: "package-reprint",
        status: "Needs Reprint",
        display_name: "Reprint Taco Dinner",
      },
    });
    const draftPackage = createPackage({
      id: "package-draft",
      package_identifier: "PKG-2026-000103",
      label: {
        ...createPackage().label,
        id: "label-draft",
        package_id: "package-draft",
        status: "Draft",
        display_name: "Draft Taco Dinner",
      },
    });
    const allocation = createPackagingAllocation([tray], {
      allocated_weight_grams: "714.3",
      packages: [readyPackage, reprintPackage, draftPackage],
      remaining_weight_grams: "0",
      selected_weight_grams: "714.3",
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Review & labels");
    const preview = within(
      await screen.findByLabelText("Package Label preview"),
    );
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-2026-000101 Package Label",
      }),
    ).toBeEnabled();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-2026-000102 Package Label",
      }),
    ).toBeEnabled();
    expect(
      preview.getByRole("checkbox", {
        name: "Select PKG-2026-000103 Package Label",
      }),
    ).toBeDisabled();
    expect(
      preview.getByText(/Draft labels cannot be previewed/),
    ).toBeInTheDocument();
    expect(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    ).toBeDisabled();

    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    expect(preview.getByText("2 labels selected")).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Preview Avery 5163" }),
    );

    expect(
      await preview.findByLabelText("Avery 5163 sheet 1"),
    ).toBeInTheDocument();
    expect(preview.getByText("2 previewed · 1 sheet")).toBeInTheDocument();
    expect(packageLabelPreviewPostRequests()).toHaveLength(1);
    expect(parseRequestBody(packageLabelPreviewPostRequests()[0])).toEqual({
      package_label_ids: ["label-ready", "label-reprint"],
    });
    expect(packageLabelPatchRequests()).toHaveLength(0);
    expect(printPackageLabelPostRequests()).toHaveLength(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(readyPackage.label.print_events).toHaveLength(0);
    expect(reprintPackage.label.print_events).toHaveLength(0);
    expect(readyPackage.status).toBe("In Storage");
    expect(readyPackage.storage_location.name).toBe("Unassigned");

    await user.click(preview.getByRole("button", { name: "Clear Selection" }));
    expect(preview.getByText("0 labels selected")).toBeInTheDocument();
    expect(preview.getByText(/selection changed/i)).toBeInTheDocument();
  });

  it("prints authoritative labels, appends Print Events, and refreshes without changing inventory or allocation state", async () => {
    const user = userEvent.setup();
    const tray = createTray({
      id: "tray-print",
      production_batch_id: "batch-1",
      status: "Completed",
      final_dry_weight_grams: "465",
    });
    const readyPackage = createPackage({
      id: "package-print-ready",
      package_identifier: "PKG-2026-000201",
      label: {
        ...createPackage().label,
        id: "label-print-ready",
        package_id: "package-print-ready",
        status: "Ready",
        display_name: "Authoritative Ready Taco Dinner",
        net_weight_display: "8.2 oz",
      },
    });
    const priorEvent = {
      id: "print-event-prior",
      package_label_id: "label-print-reprint",
      printed_at: "2026-07-07T01:00:00.000Z",
      recorded_at: "2026-07-07T01:01:00.000Z",
      template: "Avery 5163",
      print_job_id: "print-job-prior",
      notes: "Original sheet",
    };
    const reprintPackage = createPackage({
      id: "package-print-reprint",
      package_identifier: "PKG-2026-000202",
      label: {
        ...createPackage().label,
        id: "label-print-reprint",
        package_id: "package-print-reprint",
        status: "Needs Reprint",
        display_name: "Authoritative Reprint Taco Dinner",
        print_events: [priorEvent],
      },
    });
    const recordedPlan = createPlannedPackageRow("planned-package-printed", {
      recorded_package_id: readyPackage.id,
      label_status: "Ready",
      label_display_name: readyPackage.label.display_name,
    });
    const allocation = createPackagingAllocation([tray], {
      selected_weight_grams: "465",
      allocated_weight_grams: "465",
      remaining_weight_grams: "0",
      planned_packages: [recordedPlan],
      packages: [readyPackage, reprintPackage],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Review & labels");
    const preview = within(
      await screen.findByLabelText("Package Label preview"),
    );
    await user.click(
      preview.getByRole("button", { name: "Select All Eligible" }),
    );
    expect(
      preview.getByText("1 initial print · 1 reprint"),
    ).toBeInTheDocument();
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );

    expect(
      await preview.findByText(/Print recorded for 2 Package Labels/),
    ).toHaveTextContent("Print job print-job-1");
    expect(printPackageLabelPostRequests()).toHaveLength(1);
    expect(parseRequestBody(printPackageLabelPostRequests()[0])).toEqual({
      package_label_ids: ["label-print-ready", "label-print-reprint"],
      template: "Avery 5163",
    });
    expect(packageLabelPreviewPostRequests()).toHaveLength(0);
    expect(packageLabelPatchRequests()).toHaveLength(0);
    expect(completePackagingPostRequests()).toHaveLength(0);
    expect(plannedPackagePatchRequests()).toHaveLength(0);
    expect(allocationPostRequests()).toHaveLength(0);
    expect(packagingOperationGetRequests("batch-1")).toBeGreaterThanOrEqual(2);
    expect(open).toHaveBeenCalledTimes(1);
    const pdfText = await printedPdfText(createObjectURL);
    expect(pdfText).toContain("Authoritative Ready Taco Dinner");
    expect(pdfText).toContain("Authoritative Reprint Taco");

    const readyHistory = within(
      preview.getByLabelText("PKG-2026-000201 Print Event history"),
    );
    expect(readyHistory.getByText("Initial Print")).toBeInTheDocument();
    expect(readyHistory.getByText(/Print job print-job-1/)).toBeInTheDocument();
    const reprintHistory = within(
      preview.getByLabelText("PKG-2026-000202 Print Event history"),
    );
    expect(reprintHistory.getByText("Initial Print")).toBeInTheDocument();
    expect(reprintHistory.getByText("Reprint")).toBeInTheDocument();
    expect(
      reprintHistory.getByText(/Print job print-job-prior/),
    ).toBeInTheDocument();
    expect(
      reprintHistory.getByText(/Print job print-job-1/),
    ).toBeInTheDocument();
    expect(readyPackage.status).toBe("In Storage");
    expect(readyPackage.storage_location.name).toBe("Unassigned");
    expect(tray.status).toBe("Completed");
    expect(tray.final_dry_weight_grams).toBe("465");
    expect(tray.weight_checks).toEqual([]);
    expect(allocation.selected_weight_grams).toBe("465");
    expect(allocation.allocated_weight_grams).toBe("465");
    expect(allocation.remaining_weight_grams).toBe("0");
    const persistedOperation = testState.getOperation();
    expect(persistedOperation?.status).toBe("Open");
    expect(persistedOperation?.allocations[0].planned_packages).toEqual([
      expect.objectContaining({
        id: recordedPlan.id,
        recorded_package_id: readyPackage.id,
      }),
    ]);
    expect(
      persistedOperation?.allocations[0].packages[0].label.print_events,
    ).toHaveLength(1);
    expect(
      persistedOperation?.allocations[0].packages[1].label.print_events,
    ).toEqual([
      priorEvent,
      expect.objectContaining({ print_job_id: "print-job-1" }),
    ]);
    expect(persistedOperation?.packages[0].label.print_events).toEqual(
      persistedOperation?.allocations[0].packages[0].label.print_events,
    );

    cleanup();
    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    const resumedPreview = within(
      await screen.findByLabelText("Package Label preview"),
    );
    expect(
      within(
        resumedPreview.getByLabelText("PKG-2026-000201 Print Event history"),
      ).getByText("Initial Print"),
    ).toBeInTheDocument();
    const resumedReprintHistory = within(
      resumedPreview.getByLabelText("PKG-2026-000202 Print Event history"),
    );
    expect(
      resumedReprintHistory.getByText("Initial Print"),
    ).toBeInTheDocument();
    expect(resumedReprintHistory.getByText("Reprint")).toBeInTheDocument();
    expect(printPackageLabelPostRequests()).toHaveLength(1);
  });

  it("separates print persistence failure from post-persistence refresh recovery", async () => {
    const user = userEvent.setup();
    const tray = createTray({
      id: "tray-print-recovery",
      production_batch_id: "batch-1",
      status: "Completed",
      final_dry_weight_grams: "232.5",
    });
    const recordedPackage = createPackage({
      id: "package-print-recovery",
      package_identifier: "PKG-2026-000301",
      label: {
        ...createPackage().label,
        id: "label-print-recovery",
        package_id: "package-print-recovery",
        status: "Ready",
        display_name: "Recovery Taco Dinner",
      },
    });
    const allocation = createPackagingAllocation([tray], {
      selected_weight_grams: "232.5",
      allocated_weight_grams: "232.5",
      remaining_weight_grams: "0",
      packages: [recordedPackage],
    });
    const operation = createPackagingOperation("batch-1", {
      allocations: [allocation],
      packages: allocation.packages,
    });
    const testState = createPackagingTestState({ operation });
    let failPrintPersistence = true;
    let failOperationRefresh = false;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (
          url.endsWith("/api/v1/package-labels/print") &&
          method === "POST" &&
          failPrintPersistence
        ) {
          failPrintPersistence = false;
          return errorResponse(422, {
            detail: {
              code: "PACKAGE_LABEL_SELECTION_INVALID",
              message: "The selected Package Label is stale.",
            },
          });
        }
        if (
          url.endsWith(
            "/api/v1/production-batches/batch-1/packaging-operation",
          ) &&
          method === "GET" &&
          failOperationRefresh
        ) {
          return errorResponse(503, {
            detail: {
              message: "Workspace refresh is temporarily unavailable.",
            },
          });
        }
        if (url.endsWith("/api/v1/package-labels/print") && method === "POST") {
          failOperationRefresh = true;
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Review & labels");
    const preview = within(
      await screen.findByLabelText("Package Label preview"),
    );
    const checkbox = preview.getByRole("checkbox", {
      name: "Select PKG-2026-000301 Package Label",
    });
    await user.click(checkbox);
    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );

    expect(
      await preview.findByText(/Print was not recorded/),
    ).toHaveTextContent("The selected Package Label is stale.");
    expect(checkbox).toBeChecked();
    expect(open).toHaveBeenCalledTimes(1);
    expect(closePrintOutput).toHaveBeenCalledTimes(1);
    expect(replacePrintOutputLocation).not.toHaveBeenCalled();
    expect(printPackageLabelPostRequests()).toHaveLength(1);
    expect(
      within(
        preview.getByLabelText("PKG-2026-000301 Print Event history"),
      ).getByText(/No Print Events recorded/),
    ).toBeInTheDocument();

    await user.click(
      preview.getByRole("button", { name: "Print Selected Labels" }),
    );
    expect(
      await preview.findByText(
        /Printing was recorded, but the Packaging workspace refresh failed/,
      ),
    ).toHaveTextContent("Workspace refresh is temporarily unavailable.");
    expect(
      preview.getByText(/Print recorded for 1 Package Label/),
    ).toHaveTextContent("Print job print-job-1");
    expect(open).toHaveBeenCalledTimes(2);
    expect(replacePrintOutputLocation).toHaveBeenCalledTimes(1);
    expect(printPackageLabelPostRequests()).toHaveLength(2);

    failOperationRefresh = false;
    await user.click(
      preview.getByRole("button", { name: "Retry Workspace Refresh" }),
    );
    await waitFor(() => {
      expect(
        preview.queryByText(/workspace refresh failed/),
      ).not.toBeInTheDocument();
    });
    expect(printPackageLabelPostRequests()).toHaveLength(2);
    const refreshedPreview = within(
      await screen.findByLabelText("Package Label preview"),
    );
    expect(
      await within(
        refreshedPreview.getByLabelText("PKG-2026-000301 Print Event history"),
      ).findByText("Initial Print"),
    ).toBeInTheDocument();
  });

  it.skip("prevents duplicate Allocation saves while sending blank notes as null", async () => {
    const user = userEvent.setup();
    const operation = createPackagingOperation("batch-1");
    const testState = createPackagingTestState({ operation });
    let releaseSave: (() => void) | undefined;
    const controlledFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          /\/api\/v1\/packaging-operations\/[^/]+\/allocate-trays$/.test(
            String(input),
          ) &&
          init?.method === "POST"
        ) {
          return new Promise<Response>((resolve) => {
            releaseSave = () => {
              void Promise.resolve(testState.fetch(input, init)).then(resolve);
            };
          });
        }
        return testState.fetch(input, init);
      },
    );
    vi.stubGlobal("fetch", controlledFetch);

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    await showWorkflowStage(user, "Choose trays");

    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    );
    await user.type(
      allocationSelection.getByLabelText("Allocation Notes"),
      "   ",
    );
    const saveButton = allocationSelection.getByRole("button", {
      name: "Save & Continue",
    });
    await user.click(saveButton);
    const pendingSaveButton = allocationSelection.getByRole("button", {
      name: "Saving…",
    });
    expect(pendingSaveButton).toBeDisabled();
    expect(screen.getByLabelText("Production Batch")).toBeDisabled();
    expect(
      allocationSelection.getByLabelText("Allocation Notes"),
    ).toBeDisabled();
    expect(
      allocationSelection.getByRole("button", {
        name: "Select all",
      }),
    ).toBeDisabled();
    expect(
      allocationSelection.getByRole("button", { name: "Clear" }),
    ).toBeDisabled();
    for (const checkbox of allocationSelection.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    await user.click(pendingSaveButton);

    expect(allocationPostRequests()).toHaveLength(1);
    expect(parseRequestBody(allocationPostRequests()[0])).toEqual({
      tray_ids: ["tray-1"],
      notes: null,
    });

    releaseSave?.();
    expect(
      await screen.findByRole("heading", { name: "Allocation 1" }),
    ).toBeInTheDocument();
    expect(allocationPostRequests()).toHaveLength(1);
  });

  it.skip("preserves valid Allocation input across a structured conflict and clears it after retry", async () => {
    const user = userEvent.setup();
    const operation = createPackagingOperation("batch-1");
    const testState = createPackagingTestState({ operation });
    let rejectAllocation = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          rejectAllocation &&
          /\/api\/v1\/packaging-operations\/[^/]+\/allocate-trays$/.test(
            String(input),
          ) &&
          init?.method === "POST"
        ) {
          return errorResponse(409, {
            detail: {
              code: "PACKAGING_ALLOCATION_CONFLICT",
              errors: [
                {
                  loc: ["body", "tray_ids"],
                  msg: "A completed Tray is already allocated.",
                  type: "value_error",
                },
              ],
            },
          });
        }
        return testState.fetch(input, init);
      }),
    );

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");

    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    );
    const notesInput = allocationSelection.getByLabelText("Allocation Notes");
    await user.type(notesInput, "Retry this allocation");
    const operationGetsBeforeConflict =
      packagingOperationGetRequests("batch-1");
    const worksheetGetsBeforeConflict = worksheetGetRequests();
    await user.click(
      allocationSelection.getByRole("button", {
        name: "Save & Continue",
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "PACKAGING_ALLOCATION_CONFLICT: tray ids: A completed Tray is already allocated.",
    );
    expect(alert).not.toHaveTextContent("[object Object]");
    expect(allocationPostRequests()).toHaveLength(1);
    expect(packagingOperationGetRequests("batch-1")).toBeGreaterThan(
      operationGetsBeforeConflict,
    );
    expect(worksheetGetRequests()).toBeGreaterThan(worksheetGetsBeforeConflict);
    expect(notesInput).toHaveValue("Retry this allocation");
    expect(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    ).toBeChecked();
    expect(currentPackagingUrl()).toBe("/packaging?batch=batch-1&workspace=1");
    expect(
      allocationSelection.getByRole("button", {
        name: "Save & Continue",
      }),
    ).toBeEnabled();

    rejectAllocation = false;
    await user.click(
      allocationSelection.getByRole("button", {
        name: "Save & Continue",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Allocation 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Allocation Notes")).toHaveValue("");
    expect(allocationPostRequests()).toHaveLength(2);
  });

  it.skip("appends a second saved Allocation without exposing already allocated Trays", async () => {
    const user = userEvent.setup();
    const worksheet = defaultWorksheet();
    const firstAllocation = createPackagingAllocation([
      worksheet[0].eligible_trays[0],
    ]);
    const operation = createPackagingOperation("batch-1", {
      allocations: [firstAllocation],
    });
    const testState = createPackagingTestState({ worksheet, operation });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage("/packaging?batch=batch-1&workspace=1");
    await showWorkflowStage(user, "Choose trays");

    const allocationSelection = within(
      await screen.findByLabelText("Prepare Packaging Allocation"),
    );
    expect(
      allocationSelection.queryByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    ).not.toBeInTheDocument();
    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 2 Apples",
      }),
    );
    await user.click(
      allocationSelection.getByRole("button", {
        name: "Save & Continue",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Allocation 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allocation 1" }),
    ).toBeInTheDocument();
    expect(parseRequestBody(allocationPostRequests()[0])).toEqual({
      tray_ids: ["tray-2"],
      notes: null,
    });
    await showWorkflowStage(user, "Choose trays");
    const restoredSelection = within(
      screen.getByLabelText("Prepare Packaging Allocation"),
    );
    expect(
      restoredSelection.getByText(
        "All completed Trays available to this operation are already assigned to saved Packaging Allocations.",
      ),
    ).toBeInTheDocument();
  });

  it.skip("tracks a mixed source pool across a chosen package count", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    await startPackagingWorkspace(user);
    await screen.findByText("Taco Chicken");
    const allocationSelection = within(
      screen.getByLabelText("Prepare Packaging Allocation"),
    );
    expect(allocationSelection.getByText("238.1 g")).toBeInTheDocument();
    expect(allocationSelection.getByText("185 g")).toBeInTheDocument();
    expect(allocationSelection.queryByText("929.9 g")).not.toBeInTheDocument();
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("0");
    expect(
      allocationSelection.getByText("Selected Source Weight").parentElement,
    ).toHaveTextContent("0 g");
    expect(
      allocationSelection.getByText(
        "No completed Trays are selected for the pending Packaging Allocation.",
      ),
    ).toBeInTheDocument();

    await user.click(
      allocationSelection.getByRole("checkbox", {
        name: "Select Slot 1 Taco Chicken",
      }),
    );
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("1");
    expect(
      allocationSelection.getByText("Selected Source Weight").parentElement,
    ).toHaveTextContent("238.1 g");

    await user.click(
      allocationSelection.getByRole("button", { name: "Clear" }),
    );
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("0");

    await user.click(
      allocationSelection.getByRole("button", {
        name: "Select all",
      }),
    );
    expect(
      allocationSelection.getByText("Selected Completed Trays").parentElement,
    ).toHaveTextContent("2");
    expect(
      allocationSelection.getByText("Selected Source Weight").parentElement,
    ).toHaveTextContent("423.1 g");
    await user.click(
      allocationSelection.getByRole("button", { name: "Save & Continue" }),
    );

    const sessionSummary = screen.getByRole("region", {
      name: "Packaging session summary",
    });
    expect(sessionSummary).toHaveTextContent("423.1 g");
    expect(
      screen.getByRole("button", { name: "Next — Review" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.queryByRole("region", { name: "Packaging session summary" }),
    ).not.toBeInTheDocument();
  });

  it("prints a clear unavailable message when source weight history is incomplete", async () => {
    printAvery5163Labels([
      {
        packageIdentifier: "PKG-2026-000099",
        productName: "Apples",
        preparationSummary: "sliced",
        freshEquivalentGrams: null,
        finishedProductWeightGrams: "85.049",
        packageType: "Pint Mylar",
        batchLine: "Batch 009 · white",
        oxygenAbsorber: "300cc",
        packagedAt: "2026-07-08T01:00:00.000Z",
      },
    ]);

    const labelPdf = await printedPdfText(createObjectURL);
    expect(labelPdf).toContain("Fresh equivalent unavailable");
    expect(labelPdf).toContain("sliced");
    expect(labelPdf).not.toContain("Storage:");
  });
});

describe("TrayDetailsPage packaging labels", () => {
  const createObjectURL = vi.fn(() => "blob:test-tray-label-pdf");
  const replacePrintOutputLocation = vi.fn();
  const open = vi.fn(() => ({
    closed: false,
    close: vi.fn(),
    location: { replace: replacePrintOutputLocation },
  }));

  beforeEach(() => {
    vi.stubGlobal("open", open);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows packaging history and reprints Avery labels for a Packaged Tray", async () => {
    const user = userEvent.setup();
    const packagedTray = createTray({
      id: "tray-1",
      product_name: "Taco Chicken",
      status: "Packaged",
      weight_checks: [
        {
          id: "weight-check-1",
          tray_id: "tray-1",
          drying_run_id: "drying-run-1",
          weight_grams: "16924.700",
          observed_at: "2026-07-08T00:45:00.000Z",
          recorded_at: "2026-07-08T00:46:00.000Z",
          notes: null,
        },
      ],
      packaging: {
        packaging_operation_id: "packaging-operation-1",
        packaging_allocation_id: "packaging-allocation-1",
        packaging_operation_status: "Completed",
        started_at: "2026-07-08T00:55:00.000Z",
        completed_at: "2026-07-08T01:00:00.000Z",
        batch_number: "Batch 005",
        freeze_dryer: "black",
        packages: [
          {
            id: "package-1",
            package_identifier: "PKG-2026-000001",
            package_type: "Quart Mylar",
            finished_product_weight_grams: "232.466",
            package_weight_grams: "246.641",
            oxygen_absorber: "500cc",
            storage_location: "Unassigned",
            status: "In Storage",
            notes: null,
          },
        ],
      },
    });
    vi.stubGlobal("fetch", vi.fn(mockTrayDetailsFetch(packagedTray)));

    renderWithProviders(
      <MemoryRouter initialEntries={["/trays/tray-1"]}>
        <Routes>
          <Route path="/trays/:trayId" element={<TrayDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findAllByRole("heading", { name: "Taco Chicken" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Packaging" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Finished product: 232.5 g")).toBeInTheDocument();
    expect(screen.getByText("Sealed package: 246.6 g")).toBeInTheDocument();
    expect(screen.getByText("Status: In Storage")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Correct Weight" }));
    const correctionInput = screen.getByRole("spinbutton", {
      name: "Correct weight for Run 1",
    });
    await user.clear(correctionInput);
    await user.type(correctionInput, "600");
    await user.type(
      screen.getByRole("textbox", { name: "Correction reason for Run 1" }),
      "Wrong unit selected",
    );
    await user.click(screen.getByRole("button", { name: "Save Correction" }));
    expect(await screen.findByText("600 g")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reprint Avery 5163 Labels" }),
    );

    const labelPdf = await printedPdfText(createObjectURL);
    expect(labelPdf).toContain("PKG-2026-000001");
    expect(labelPdf).toContain("Taco Chicken");
    expect(labelPdf).toContain("Quart Mylar");
    expect(labelPdf).toContain("Batch 005");
    expect(labelPdf).toContain("black");
    expect(labelPdf).toContain("2.05 lb fresh = 8.2 oz freeze-dried");
    expect(labelPdf).toContain("cubed, seasoned");
    expect(labelPdf).toContain("Jul 8, 2026");
    expect(labelPdf).not.toContain("Storage:");
    expect(open).toHaveBeenCalledWith("", "_blank", "height=900,width=900");
    expect(replacePrintOutputLocation).toHaveBeenCalledWith(
      "blob:test-tray-label-pdf",
    );
  });
});

function renderPackagingPage(initialEntry = "/packaging") {
  const queryClient = createTestQueryClient();
  renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PackagingPage />
      <PackagingRouterProbe />
    </MemoryRouter>,
    queryClient,
  );
  return queryClient;
}

function currentPackagingUrl() {
  return screen.getByLabelText("Current URL").textContent;
}

function PackagingRouterProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="sr-only">
      <output aria-label="Current URL">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        Test Browser Back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Test Browser Forward
      </button>
    </div>
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(
  ui: ReactNode,
  queryClient = createTestQueryClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const PLANNED_PACKAGE_INPUT_KEYS = [
  "id",
  "package_type_id",
  "finished_product_weight_grams",
  "finished_product_weight_unit",
  "sealed_package_weight_grams",
  "sealed_package_weight_unit",
  "oxygen_absorber",
  "storage_location_id",
  "notes",
  "label_display_name",
  "label_description",
  "label_ingredients_summary",
  "label_preparation_summary",
  "label_rehydration_instructions",
  "label_serving_notes",
  "label_net_weight_display",
  "label_fresh_equivalent_display",
] as const;

function assertOnlyKeys(value: object, allowedKeys: readonly string[]) {
  const unsupportedKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Unsupported request fields: ${unsupportedKeys.join(", ")}`,
    );
  }
}

function allocationAllocatedWeight(
  plannedPackages: PackagingAllocation["planned_packages"],
  packages: Package[],
) {
  const recordedWeight = packages.reduce(
    (total, item) => total + Number(item.finished_product_weight_grams ?? 0),
    0,
  );
  return plannedPackages.reduce(
    (total, row) =>
      row.recorded_package_id
        ? total
        : total + Number(row.finished_product_weight_grams ?? 0),
    recordedWeight,
  );
}

function packagingCompletionProblem(operation: PackagingOperation) {
  if (operation.status !== "Open") {
    return "Only an Open Packaging Operation may be completed.";
  }
  if (operation.allocations.length === 0) {
    return "A Packaging Operation requires at least one Allocation.";
  }
  for (const allocation of operation.allocations) {
    if (
      allocation.packages.length === 0 &&
      allocation.packaging_losses.length === 0
    ) {
      return "Every Allocation requires at least one Package or Packaging Loss.";
    }
    if (allocation.planned_packages.some((row) => !row.recorded_package_id)) {
      return "Every planned Package must be recorded before completion.";
    }
    if (Math.abs(Number(allocation.remaining_weight_grams)) > 0.001) {
      return "All selected product must be allocated before completion.";
    }
    if (
      allocation.packages.some(
        (recordedPackage) =>
          !recordedPackage.label || recordedPackage.label.status === "Draft",
      )
    ) {
      return "Every Package Label must be Ready before completion.";
    }
  }
  return null;
}

function createPackagingTestState(
  overrides: Partial<{
    worksheet: PackagingWorksheetItem[];
    productionBatches: ProductionBatch[];
    packageTypes: PackageType[];
    storageLocations: StorageLocation[];
    operation: PackagingOperation | null;
  }> = {},
) {
  const worksheet = overrides.worksheet ?? defaultWorksheet();
  let plannedPackageSequence = 0;
  let mutationSequence = 0;
  let printSequence = 0;
  const state = {
    worksheet,
    productionBatches:
      overrides.productionBatches ??
      worksheet.map((item) => item.production_batch),
    packageTypes: overrides.packageTypes ?? [packageType, pintPackageType],
    storageLocations: overrides.storageLocations ?? [
      unassignedStorageLocation,
      pantryStorageLocation,
    ],
    operation: overrides.operation ?? null,
    packages: [...(overrides.operation?.packages ?? [])],
  };

  function nextMutationTimestamp() {
    mutationSequence += 1;
    return new Date(
      Date.parse("2026-07-08T00:55:00.000Z") + mutationSequence * 60_000,
    ).toISOString();
  }

  function nextPlannedPackageId(existingIds: Set<string>) {
    let candidate: string;
    do {
      plannedPackageSequence += 1;
      candidate = `planned-package-${plannedPackageSequence}`;
    } while (existingIds.has(candidate));
    existingIds.add(candidate);
    return candidate;
  }

  function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/v1/packaging/worksheet") && method === "GET") {
      return jsonResponse(state.worksheet);
    }

    if (url.endsWith("/api/v1/production-batches") && method === "GET") {
      return jsonResponse(state.productionBatches);
    }

    if (url.endsWith("/api/v1/package-types") && method === "GET") {
      return jsonResponse(state.packageTypes);
    }

    if (url.endsWith("/api/v1/storage-locations") && method === "GET") {
      return jsonResponse(state.storageLocations);
    }

    if (url.endsWith("/api/v1/package-types") && method === "POST") {
      const body = parseBody(init);
      const createdPackageType: PackageType = {
        id: "package-type-1",
        name: String(body.name),
        default_oxygen_absorber:
          body.default_oxygen_absorber === null
            ? null
            : String(body.default_oxygen_absorber ?? ""),
        default_label_template:
          body.default_label_template === null
            ? null
            : String(body.default_label_template ?? ""),
        notes: body.notes === null ? null : String(body.notes ?? ""),
        archived: false,
      };
      state.packageTypes = [createdPackageType, ...state.packageTypes];
      return jsonResponse(createdPackageType);
    }

    const operationForBatch = url.match(
      /\/api\/v1\/production-batches\/([^/]+)\/packaging-operation$/,
    );
    if (operationForBatch && method === "GET") {
      if (state.operation?.production_batch_id === operationForBatch[1]) {
        return jsonResponse(state.operation);
      }
      return errorResponse(404, {
        detail: {
          code: "PACKAGING_OPERATION_NOT_FOUND",
          message: "Packaging Operation does not exist.",
        },
      });
    }
    if (operationForBatch && method === "POST") {
      const body = parseBody(init);
      if (!state.operation) {
        state.operation = createPackagingOperation(operationForBatch[1], {
          notes: body.notes === undefined ? null : String(body.notes),
        });
      }
      return jsonResponse(state.operation);
    }

    const allocateTrays = url.match(
      /\/api\/v1\/packaging-operations\/([^/]+)\/allocate-trays$/,
    );
    if (allocateTrays && method === "POST") {
      const body = parseBody(init) as {
        tray_ids?: string[];
        notes?: string | null;
      };
      const selectedTrays = state.worksheet.flatMap((item) =>
        item.eligible_trays.filter((tray) => body.tray_ids?.includes(tray.id)),
      );
      const allocation = createPackagingAllocation(selectedTrays, {
        id: `packaging-allocation-${
          (state.operation?.allocations.length ?? 0) + 1
        }`,
        packaging_operation_id: allocateTrays[1],
        notes: body.notes ?? null,
      });
      if (state.operation) {
        state.operation = {
          ...state.operation,
          allocations: [...state.operation.allocations, allocation],
          updated_at: allocation.updated_at,
        };
      }
      return jsonResponse(allocation);
    }

    const updateAllocation = url.match(
      /\/api\/v1\/packaging-operations\/([^/]+)\/allocations\/([^/]+)$/,
    );
    if (updateAllocation && method === "PATCH") {
      const body = parseBody(init);
      assertOnlyKeys(body, ["notes", "planned_packages", "tray_ids"]);
      const allocation = state.operation?.allocations.find(
        (candidate) => candidate.id === updateAllocation[2],
      );
      if (
        !state.operation ||
        state.operation.id !== updateAllocation[1] ||
        !allocation ||
        allocation.packaging_operation_id !== updateAllocation[1]
      ) {
        throw new Error("Packaging operation and allocation must exist");
      }
      const editableIds = new Set(
        allocation.planned_packages
          .filter((row) => row.recorded_package_id === null)
          .map((row) => row.id),
      );
      const updatedAt = nextMutationTimestamp();
      if ("planned_packages" in body && !Array.isArray(body.planned_packages)) {
        throw new Error("planned_packages must be an array.");
      }
      const plannedInputs = Array.isArray(body.planned_packages)
        ? (body.planned_packages as PlannedPackageInput[])
        : [];
      // Recorded rows are immutable historical records excluded from
      // reconciliation: they pass through unchanged whether or not the
      // request mentions them, and only unrecorded rows are created,
      // updated, or removed (ADR-0017's Reconciliation scope).
      if ("planned_packages" in body) {
        for (const input of plannedInputs) {
          if (
            input.id &&
            !allocation.planned_packages.some((row) => row.id === input.id)
          ) {
            throw new Error(
              "Planned Package does not belong to this Allocation.",
            );
          }
        }
      }
      const plannedPackages =
        "planned_packages" in body
          ? allocation.planned_packages
              .map((row) => {
                if (row.recorded_package_id !== null) return row;
                const input = plannedInputs.find((item) => item.id === row.id);
                if (!input) return null;
                assertOnlyKeys(input, PLANNED_PACKAGE_INPUT_KEYS);
                return {
                  ...row,
                  ...input,
                  id: row.id,
                  packaging_allocation_id: allocation.id,
                  updated_at: updatedAt,
                };
              })
              .filter((row): row is PlannedPackageRow => row !== null)
              .concat(
                plannedInputs
                  .filter((input) => !input.id)
                  .map((input) => {
                    assertOnlyKeys(input, PLANNED_PACKAGE_INPUT_KEYS);
                    const id = nextPlannedPackageId(editableIds);
                    return {
                      ...createPlannedPackageRow(id),
                      ...input,
                      id,
                      packaging_allocation_id: allocation.id,
                      created_at: updatedAt,
                      updated_at: updatedAt,
                    };
                  }),
              )
          : allocation.planned_packages;
      const allocatedWeight = allocationAllocatedWeight(
        plannedPackages,
        allocation.packages,
      );
      const updatedAllocation: PackagingAllocation = {
        ...allocation,
        notes:
          "notes" in body
            ? body.notes === null
              ? null
              : String(body.notes)
            : allocation.notes,
        allocated_weight_grams: String(allocatedWeight),
        planned_packages: plannedPackages,
        remaining_weight_grams: String(
          Number(allocation.selected_weight_grams) - allocatedWeight,
        ),
        updated_at: updatedAt,
      };
      state.operation = {
        ...state.operation,
        allocations: state.operation.allocations.map((candidate) =>
          candidate.id === updatedAllocation.id ? updatedAllocation : candidate,
        ),
        updated_at: updatedAt,
      };
      return jsonResponse(updatedAllocation);
    }

    const recordPackages = url.match(
      /\/api\/v1\/packaging-operations\/([^/]+)\/allocations\/([^/]+)\/packages$/,
    );
    if (recordPackages && method === "POST") {
      const body = parseBody(init) as { packages?: PackageLineCreate[] };
      assertOnlyKeys(body, ["packages"]);
      const allocation = state.operation?.allocations.find(
        (candidate) => candidate.id === recordPackages[2],
      );
      if (
        !state.operation ||
        state.operation.id !== recordPackages[1] ||
        !allocation ||
        allocation.packaging_operation_id !== recordPackages[1]
      ) {
        throw new Error("Packaging operation and allocation must exist");
      }
      if (state.operation.status !== "Open") {
        throw new Error("Completed Packaging Operations cannot be changed.");
      }
      const updatedAt = nextMutationTimestamp();
      let updatedPlans = [...allocation.planned_packages];
      const createdPackages = (body.packages ?? []).map((line, index) => {
        const plannedPackage = line.planned_package_row_id
          ? updatedPlans.find(
              (candidate) => candidate.id === line.planned_package_row_id,
            )
          : undefined;
        if (
          line.planned_package_row_id &&
          (!plannedPackage ||
            plannedPackage.packaging_allocation_id !== allocation.id)
        ) {
          throw new Error(
            "Planned Package does not belong to this Allocation.",
          );
        }
        if (plannedPackage?.recorded_package_id) {
          throw new Error("Planned Package has already been recorded.");
        }
        const packageTypeId =
          line.package_type_id ?? plannedPackage?.package_type_id;
        const finishedProductWeight =
          line.finished_product_weight_grams ??
          plannedPackage?.finished_product_weight_grams;
        const sealedPackageWeight =
          line.sealed_package_weight_grams ??
          plannedPackage?.sealed_package_weight_grams;
        if (!packageTypeId || !finishedProductWeight || !sealedPackageWeight) {
          throw new Error(
            "Package Type and both Package weights are required.",
          );
        }
        const currentPackageType = state.packageTypes.find(
          (type) => type.id === packageTypeId,
        );
        if (!currentPackageType) {
          throw new Error("Package Type does not exist.");
        }
        const storageLocationId =
          line.storage_location_id ??
          plannedPackage?.storage_location_id ??
          null;
        const storageLocation =
          state.storageLocations.find(
            (location) => location.id === storageLocationId,
          ) ?? unassignedStorageLocation;
        const packageNumber = state.operation!.packages.length + index + 1;
        const packageId = `package-${packageNumber}`;
        const sourceProducts = Array.from(
          new Set(allocation.source_trays.map((tray) => tray.product_name)),
        );
        const sourcePreparation = Array.from(
          new Set(
            allocation.source_trays
              .map((tray) => tray.preparation)
              .filter((value): value is string => Boolean(value)),
          ),
        ).join("; ");
        const lineLabel = line.label ?? {};
        const recordedPackage = createPackage({
          id: packageId,
          packaging_allocation_id: recordPackages[2],
          packaging_operation_id: recordPackages[1],
          package_type_id: currentPackageType.id,
          package_type: currentPackageType,
          package_identifier: `PKG-2026-${String(packageNumber).padStart(6, "0")}`,
          packaged_at: line.packaged_at ?? updatedAt,
          finished_product_weight_grams: finishedProductWeight,
          package_weight_grams: sealedPackageWeight,
          oxygen_absorber:
            line.oxygen_absorber ??
            plannedPackage?.oxygen_absorber ??
            currentPackageType.default_oxygen_absorber,
          storage_location_id: storageLocation.id,
          storage_location: storageLocation,
          notes: line.notes ?? plannedPackage?.notes ?? null,
          label: {
            ...createPackage().label,
            id: `package-label-${packageNumber}`,
            package_id: packageId,
            status: "Draft",
            display_name:
              lineLabel.display_name ??
              plannedPackage?.label_display_name ??
              (sourceProducts.length === 1
                ? sourceProducts[0]
                : "Mixed Product"),
            description:
              lineLabel.description ??
              plannedPackage?.label_description ??
              null,
            ingredients_summary:
              lineLabel.ingredients_summary ??
              plannedPackage?.label_ingredients_summary ??
              null,
            preparation_summary:
              lineLabel.preparation_summary ??
              plannedPackage?.label_preparation_summary ??
              (sourcePreparation || null),
            rehydration_instructions:
              lineLabel.rehydration_instructions ??
              plannedPackage?.label_rehydration_instructions ??
              null,
            serving_notes:
              lineLabel.serving_notes ??
              plannedPackage?.label_serving_notes ??
              null,
            net_weight_display:
              lineLabel.net_weight_display ??
              plannedPackage?.label_net_weight_display ??
              `${Number(finishedProductWeight).toFixed(1)} g`,
            fresh_equivalent_display:
              lineLabel.fresh_equivalent_display ??
              plannedPackage?.label_fresh_equivalent_display ??
              null,
            created_at: updatedAt,
            updated_at: updatedAt,
          },
        });
        if (plannedPackage) {
          updatedPlans = updatedPlans.map((candidate) =>
            candidate.id === plannedPackage.id
              ? {
                  ...candidate,
                  recorded_package_id: packageId,
                  updated_at: updatedAt,
                }
              : candidate,
          );
        }
        return recordedPackage;
      });
      const allocationPackages = [...allocation.packages, ...createdPackages];
      const baggedWeight = allocationPackages.reduce(
        (total, item) =>
          total + Number(item.finished_product_weight_grams ?? 0),
        0,
      );
      const updatedAllocation: PackagingAllocation = {
        ...allocation,
        packages: allocationPackages,
        planned_packages: updatedPlans,
        allocated_weight_grams: String(
          allocationAllocatedWeight(updatedPlans, allocationPackages),
        ),
        remaining_weight_grams: String(
          Number(allocation.selected_weight_grams) -
            allocationAllocatedWeight(updatedPlans, allocationPackages),
        ),
        bagged_weight_grams: String(baggedWeight),
        remaining_to_bag_grams: String(
          Number(allocation.selected_weight_grams) -
            baggedWeight -
            Number(allocation.total_recorded_loss_weight_grams),
        ),
        updated_at: updatedAt,
      };
      state.packages = state.operation.packages
        .filter(
          (existingPackage) =>
            existingPackage.packaging_allocation_id !== allocation.id,
        )
        .concat(allocationPackages);
      state.operation = {
        ...state.operation,
        allocations: state.operation.allocations.map((candidate) =>
          candidate.id === updatedAllocation.id ? updatedAllocation : candidate,
        ),
        packages: state.packages,
      };
      return jsonResponse({
        packages: createdPackages,
        packaging_operation: state.operation,
      });
    }

    const recordLoss = url.match(
      /\/api\/v1\/packaging-operations\/([^/]+)\/allocations\/([^/]+)\/losses$/,
    );
    if (recordLoss && method === "POST") {
      const body = parseBody(init) as {
        weight_grams?: unknown;
        reason?: unknown;
        reason_detail?: unknown;
      };
      assertOnlyKeys(body, ["weight_grams", "reason", "reason_detail"]);
      const allocation = state.operation?.allocations.find(
        (candidate) => candidate.id === recordLoss[2],
      );
      if (
        !state.operation ||
        state.operation.id !== recordLoss[1] ||
        !allocation ||
        allocation.packaging_operation_id !== recordLoss[1]
      ) {
        throw new Error("Packaging operation and allocation must exist");
      }
      if (state.operation.status !== "Open") {
        throw new Error("Completed Packaging Operations cannot be changed.");
      }
      const weight = Number(body.weight_grams);
      if (!Number.isFinite(weight) || weight <= 0) {
        return errorResponse(422, {
          detail: { message: "Weight must be positive." },
        });
      }
      const reasonDetail =
        typeof body.reason_detail === "string"
          ? body.reason_detail.trim() || null
          : null;
      if (body.reason !== "Other" && reasonDetail !== null) {
        return errorResponse(400, {
          detail: {
            message: "Reason detail is only accepted when reason is Other.",
          },
        });
      }
      const remaining = Number(allocation.remaining_weight_grams);
      if (weight - remaining > 0.001) {
        return errorResponse(400, {
          detail: {
            message:
              "Packaging Loss cannot exceed the Allocation's Remaining Weight.",
          },
        });
      }
      const updatedAt = nextMutationTimestamp();
      const lossNumber = allocation.packaging_losses.length + 1;
      const loss: PackagingLoss = {
        id: `packaging-loss-${lossNumber}`,
        packaging_allocation_id: allocation.id,
        weight_grams: String(weight),
        reason: body.reason as PackagingLoss["reason"],
        reason_detail: reasonDetail,
        recorded_at: updatedAt,
      };
      const updatedLosses = [...allocation.packaging_losses, loss];
      const totalLoss = updatedLosses.reduce(
        (total, item) => total + Number(item.weight_grams),
        0,
      );
      const updatedAllocation: PackagingAllocation = {
        ...allocation,
        packaging_losses: updatedLosses,
        total_recorded_loss_weight_grams: String(totalLoss),
        remaining_weight_grams: String(
          Number(allocation.selected_weight_grams) -
            Number(allocation.allocated_weight_grams) -
            totalLoss,
        ),
        remaining_to_bag_grams: String(
          Number(allocation.selected_weight_grams) -
            Number(allocation.bagged_weight_grams) -
            totalLoss,
        ),
      };
      state.operation = {
        ...state.operation,
        allocations: state.operation.allocations.map((candidate) =>
          candidate.id === updatedAllocation.id ? updatedAllocation : candidate,
        ),
      };
      return jsonResponse({
        packaging_loss: loss,
        packaging_operation: state.operation,
      });
    }

    const updatePackageLabel = url.match(
      /\/api\/v1\/packages\/([^/]+)\/label$/,
    );
    if (updatePackageLabel && method === "PATCH") {
      const body = parseBody(init) as PackageLabelUpdate;
      assertOnlyKeys(body, [
        "status",
        "display_name",
        "description",
        "ingredients_summary",
        "preparation_summary",
        "rehydration_instructions",
        "serving_notes",
        "net_weight_display",
        "fresh_equivalent_display",
      ]);
      if (!state.operation || state.operation.status !== "Open") {
        throw new Error("Completed Packaging Operations cannot be changed.");
      }
      const allocation = state.operation.allocations.find((candidate) =>
        candidate.packages.some(
          (recordedPackage) => recordedPackage.id === updatePackageLabel[1],
        ),
      );
      const recordedPackage = allocation?.packages.find(
        (candidate) => candidate.id === updatePackageLabel[1],
      );
      if (!allocation || !recordedPackage?.label) {
        throw new Error("Package Label does not exist.");
      }
      const updatedAt = nextMutationTimestamp();
      const updatedLabel = {
        ...recordedPackage.label,
        ...Object.fromEntries(
          Object.entries(body)
            .filter(([key]) => key !== "status")
            .map(([key, value]) => [
              key,
              typeof value === "string"
                ? value.trim() === ""
                  ? null
                  : value.trim()
                : value,
            ]),
        ),
        status:
          recordedPackage.label.print_events.length > 0
            ? ("Needs Reprint" as const)
            : ("Ready" as const),
        updated_at: updatedAt,
      };
      if (!updatedLabel.display_name) {
        throw new Error("Package Label display name is required.");
      }
      const updatedPackage = { ...recordedPackage, label: updatedLabel };
      const updatedAllocation = {
        ...allocation,
        packages: allocation.packages.map((candidate) =>
          candidate.id === updatedPackage.id ? updatedPackage : candidate,
        ),
      };
      state.operation = {
        ...state.operation,
        allocations: state.operation.allocations.map((candidate) =>
          candidate.id === updatedAllocation.id ? updatedAllocation : candidate,
        ),
        packages: state.operation.packages.map((candidate) =>
          candidate.id === updatedPackage.id ? updatedPackage : candidate,
        ),
      };
      state.packages = state.operation.packages;
      return jsonResponse(updatedLabel);
    }

    if (url.endsWith("/api/v1/package-labels/preview") && method === "POST") {
      const body = parseBody(init) as { package_label_ids?: unknown };
      assertOnlyKeys(body, [
        "package_label_ids",
        "template",
        "printed_at",
        "notes",
      ]);
      if (
        !Array.isArray(body.package_label_ids) ||
        body.package_label_ids.length !== new Set(body.package_label_ids).size
      ) {
        return errorResponse(422, {
          detail: {
            code: "PACKAGE_LABEL_SELECTION_INVALID",
            message: "Select each Package Label only once.",
          },
        });
      }
      const labelsById = new Map(
        (state.operation?.allocations ?? [])
          .flatMap((allocation) => allocation.packages)
          .flatMap((recordedPackage) =>
            recordedPackage.label
              ? [[recordedPackage.label.id, recordedPackage.label] as const]
              : [],
          ),
      );
      const labels = body.package_label_ids.flatMap((labelId) => {
        const label = labelsById.get(String(labelId));
        return label ? [label] : [];
      });
      if (labels.length !== body.package_label_ids.length) {
        return errorResponse(422, {
          detail: {
            code: "PACKAGE_LABEL_SELECTION_INVALID",
            message: "Every selected Package Label must exist.",
          },
        });
      }
      return jsonResponse(labels);
    }

    if (url.endsWith("/api/v1/package-labels/print") && method === "POST") {
      const body = parseBody(init) as {
        package_label_ids?: unknown;
        template?: unknown;
        printed_at?: unknown;
        notes?: unknown;
      };
      assertOnlyKeys(body, [
        "package_label_ids",
        "template",
        "printed_at",
        "notes",
      ]);
      if (
        !Array.isArray(body.package_label_ids) ||
        body.package_label_ids.length === 0 ||
        body.package_label_ids.length !== new Set(body.package_label_ids).size
      ) {
        return errorResponse(422, {
          detail: {
            code: "PACKAGE_LABEL_SELECTION_INVALID",
            message: "Select each Package Label only once.",
          },
        });
      }
      const recordedPackages = (state.operation?.allocations ?? []).flatMap(
        (allocation) => allocation.packages,
      );
      const packagesByLabelId = new Map(
        recordedPackages.flatMap((recordedPackage) =>
          recordedPackage.label
            ? [[recordedPackage.label.id, recordedPackage] as const]
            : [],
        ),
      );
      const selectedPackages = body.package_label_ids.flatMap((labelId) => {
        const recordedPackage = packagesByLabelId.get(String(labelId));
        return recordedPackage ? [recordedPackage] : [];
      });
      if (
        selectedPackages.length !== body.package_label_ids.length ||
        selectedPackages.some(
          (recordedPackage) => recordedPackage.label.status === "Draft",
        )
      ) {
        return errorResponse(422, {
          detail: {
            code: "PACKAGE_LABEL_SELECTION_INVALID",
            message: "Every selected Package Label must be printable.",
          },
        });
      }
      printSequence += 1;
      const printJobId = `print-job-${printSequence}`;
      const printedAt =
        typeof body.printed_at === "string"
          ? body.printed_at
          : nextMutationTimestamp();
      const recordedAt = nextMutationTimestamp();
      const template =
        typeof body.template === "string" ? body.template : "Avery 5163";
      const notes =
        typeof body.notes === "string" && body.notes.trim() !== ""
          ? body.notes.trim()
          : null;
      const updatedLabels = new Map<string, PackageLabel>(
        selectedPackages.map((recordedPackage, index) => {
          const label = recordedPackage.label;
          return [
            label.id,
            {
              ...label,
              status: "Ready" as const,
              updated_at: recordedAt,
              print_events: [
                ...label.print_events,
                {
                  id: `print-event-${printSequence}-${index + 1}`,
                  package_label_id: label.id,
                  printed_at: printedAt,
                  recorded_at: recordedAt,
                  template,
                  print_job_id: printJobId,
                  notes,
                },
              ],
            },
          ];
        }),
      );
      const updatePackage = (recordedPackage: Package) => {
        const updatedLabel = updatedLabels.get(recordedPackage.label.id);
        return updatedLabel
          ? { ...recordedPackage, label: updatedLabel }
          : recordedPackage;
      };
      const currentOperation = state.operation;
      if (currentOperation) {
        state.operation = {
          ...currentOperation,
          allocations: currentOperation.allocations.map((allocation) => ({
            ...allocation,
            packages: allocation.packages.map(updatePackage),
          })),
          packages: currentOperation.packages.map(updatePackage),
        };
        state.packages = state.operation.packages;
      }
      return jsonResponse({
        print_job_id: printJobId,
        labels: body.package_label_ids.map((labelId) =>
          updatedLabels.get(String(labelId)),
        ),
      });
    }

    const completeOperation = url.match(
      /\/api\/v1\/packaging-operations\/([^/]+)\/complete$/,
    );
    if (completeOperation && method === "POST") {
      const body = parseBody(init) as { completed_at?: unknown };
      assertOnlyKeys(body, ["completed_at"]);
      const currentOperation = state.operation;
      if (!currentOperation || currentOperation.id !== completeOperation[1]) {
        return errorResponse(404, {
          detail: { message: "Packaging Operation does not exist." },
        });
      }
      const completionProblem = packagingCompletionProblem(currentOperation);
      if (completionProblem) {
        return errorResponse(422, {
          detail: {
            code: "PACKAGING_OPERATION_INCOMPLETE",
            message: completionProblem,
          },
        });
      }
      const completedAt =
        typeof body.completed_at === "string"
          ? body.completed_at
          : nextMutationTimestamp();
      const sourceTrayIds = new Set(
        currentOperation.allocations.flatMap((allocation) =>
          allocation.source_trays.map((tray) => tray.id),
        ),
      );
      state.operation = {
        ...currentOperation,
        status: "Completed",
        completed_at: completedAt,
        updated_at: completedAt,
        allocations: currentOperation.allocations.map((allocation) => ({
          ...allocation,
          source_trays: allocation.source_trays.map((tray) => ({
            ...tray,
            status: "Packaged" as const,
          })),
        })),
      };
      state.worksheet = state.worksheet.map((item) => ({
        ...item,
        eligible_trays: item.eligible_trays.filter(
          (tray) => !sourceTrayIds.has(tray.id),
        ),
      }));
      state.productionBatches = state.productionBatches.map((batch) => ({
        ...batch,
        trays: batch.trays.map((tray) =>
          sourceTrayIds.has(tray.id)
            ? { ...tray, status: "Packaged" as const }
            : tray,
        ),
      }));
      return jsonResponse(state.operation);
    }

    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ detail: `Unhandled test request: ${url}` }),
    } as Response);
  }

  return {
    fetch,
    getOperation() {
      return state.operation;
    },
    setOperation(operation: PackagingOperation | null) {
      state.operation = operation;
      state.packages = [...(operation?.packages ?? [])];
    },
  };
}

function createPackagingOperation(
  productionBatchId: string,
  overrides: Partial<PackagingOperation> = {},
): PackagingOperation {
  return {
    id: "packaging-operation-1",
    production_batch_id: productionBatchId,
    status: "Open",
    started_at: "2026-07-08T00:55:00.000Z",
    completed_at: null,
    notes: null,
    created_at: "2026-07-08T00:55:00.000Z",
    updated_at: "2026-07-08T00:55:00.000Z",
    allocations: [],
    packages: [],
    ...overrides,
  };
}

function createPackagingAllocation(
  trays: Tray[],
  overrides: Partial<PackagingAllocation> = {},
): PackagingAllocation {
  const allocationId = overrides.id ?? "packaging-allocation-1";
  const operationId =
    overrides.packaging_operation_id ?? "packaging-operation-1";
  const selectedWeight = trays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const allocation: PackagingAllocation = {
    id: allocationId,
    packaging_operation_id: operationId,
    notes: null,
    created_at: "2026-07-08T00:55:00.000Z",
    updated_at: "2026-07-08T00:55:00.000Z",
    selected_weight_grams: String(selectedWeight),
    allocated_weight_grams: "0",
    total_recorded_loss_weight_grams: "0",
    remaining_weight_grams: String(selectedWeight),
    bagged_weight_grams: "0",
    remaining_to_bag_grams: String(selectedWeight),
    source_trays: trays.map(toAllocationSourceTray),
    planned_packages: [],
    packages: [],
    packaging_losses: [],
    ...overrides,
  };
  allocation.planned_packages = allocation.planned_packages.map((row) => ({
    ...row,
    packaging_allocation_id: allocationId,
  }));
  allocation.packages = allocation.packages.map((item) => ({
    ...item,
    packaging_allocation_id: allocationId,
    packaging_operation_id: operationId,
  }));
  allocation.packaging_losses = allocation.packaging_losses.map((loss) => ({
    ...loss,
    packaging_allocation_id: allocationId,
  }));
  const bagged = allocation.packages.reduce(
    (total, item) => total + Number(item.finished_product_weight_grams ?? 0),
    0,
  );
  const totalLoss = allocation.packaging_losses.reduce(
    (total, loss) => total + Number(loss.weight_grams),
    0,
  );
  if (overrides.bagged_weight_grams === undefined) {
    allocation.bagged_weight_grams = String(bagged);
  }
  if (overrides.remaining_to_bag_grams === undefined) {
    allocation.remaining_to_bag_grams = String(
      Number(allocation.selected_weight_grams) - bagged - totalLoss,
    );
  }
  return allocation;
}

function createPlannedPackageRow(
  id: string,
  overrides: Partial<PackagingAllocation["planned_packages"][number]> = {},
): PackagingAllocation["planned_packages"][number] {
  return {
    id,
    packaging_allocation_id: "packaging-allocation-1",
    package_type_id: packageType.id,
    finished_product_weight_grams: null,
    finished_product_weight_unit: "g",
    sealed_package_weight_grams: null,
    sealed_package_weight_unit: "g",
    oxygen_absorber: packageType.default_oxygen_absorber,
    storage_location_id: null,
    notes: null,
    label_status: "Draft",
    label_display_name: null,
    label_description: null,
    label_ingredients_summary: null,
    label_preparation_summary: null,
    label_rehydration_instructions: null,
    label_serving_notes: null,
    label_net_weight_display: null,
    label_fresh_equivalent_display: null,
    recorded_package_id: null,
    created_at: "2026-07-08T00:55:00.000Z",
    updated_at: "2026-07-08T00:55:00.000Z",
    ...overrides,
  };
}

function toAllocationSourceTray(tray: Tray): PackagingAllocationSourceTray {
  return {
    id: tray.id,
    production_batch_id: tray.production_batch_id,
    tray_slot_id: tray.tray_slot_id,
    slot_number: tray.tray_slot.slot_number,
    physical_tray_id: tray.physical_tray_id,
    physical_tray_label: tray.physical_tray.label,
    product_name: tray.product_name,
    preparation: tray.preparation,
    final_dry_weight_grams: tray.final_dry_weight_grams ?? "0",
    notes: tray.notes,
    status: tray.status,
  };
}

function defaultWorksheet(): PackagingWorksheetItem[] {
  const tacoTray = createTray({
    id: "tray-1",
    product_name: "Taco Chicken",
    preparation: "cubed, seasoned",
    final_dry_weight_grams: "238.1",
    tray_slot: freezeDryer.tray_slots[0],
  });
  const applesTray = createTray({
    id: "tray-2",
    physical_tray_id: "physical-tray-2",
    product_name: "Apples",
    preparation: "sliced",
    final_dry_weight_grams: "185.0",
    tray_slot: freezeDryer.tray_slots[1],
  });
  const packagedTray = createTray({
    id: "tray-packaged",
    product_name: "Previously Packaged Pears",
    status: "Packaged",
    tray_slot: freezeDryer.tray_slots[2],
  });
  const skittlesTray = createTray({
    id: "tray-3",
    production_batch_id: "batch-2",
    physical_tray_id: "physical-tray-3",
    product_name: "Skittles",
    preparation: "whole",
    final_dry_weight_grams: "300.0",
    tray_slot: secondFreezeDryer.tray_slots[0],
  });
  const batchOne = createProductionBatch({
    trays: [tacoTray, applesTray, packagedTray],
  });
  const batchTwo = createProductionBatch({
    id: "batch-2",
    freeze_dryer_id: "freeze-dryer-2",
    freeze_dryer: secondFreezeDryer,
    batch_number: "Batch 006",
    trays: [skittlesTray],
  });

  return [
    {
      production_batch: batchOne,
      eligible_trays: [tacoTray, applesTray],
      source_weight_grams: "423.1",
    },
    {
      production_batch: batchTwo,
      eligible_trays: [skittlesTray],
      source_weight_grams: "300.0",
    },
  ];
}

function createProductionBatch(
  overrides: Partial<ProductionBatch> = {},
): ProductionBatch {
  return {
    id: "batch-1",
    freeze_dryer_id: "freeze-dryer-1",
    freeze_dryer: freezeDryer,
    batch_number: "Batch 005",
    status: "Completed",
    started_at: "2026-07-07T18:00:00.000Z",
    completed_at: "2026-07-08T00:45:00.000Z",
    notes: "testing packaging flow",
    trays: [],
    drying_runs: [],
    total_drying_seconds: 24_300,
    ...overrides,
  };
}

function createTray(overrides: Partial<Tray> = {}): Tray {
  const physicalTrayId = overrides.physical_tray_id ?? "physical-tray-1";
  return {
    id: "tray-1",
    production_batch_id: "batch-1",
    tray_slot_id: overrides.tray_slot?.id ?? "slot-1",
    tray_slot: freezeDryer.tray_slots[0],
    physical_tray_id: physicalTrayId,
    physical_tray: {
      id: physicalTrayId,
      label: physicalTrayId.replace("physical-", "Imported "),
      tare_weight_grams: null,
      notes: null,
      archived: false,
    },
    recipe_id: null,
    recipe_name: null,
    product_name: "Taco Chicken",
    preparation: "cubed, seasoned",
    starting_weight_grams: "929.9",
    final_dry_weight_grams: "238.1",
    completed_at: "2026-07-08T00:45:00.000Z",
    notes: null,
    status: "Completed",
    weight_checks: [],
    latest_weight_grams: "238.1",
    previous_weight_grams: "246.6",
    packaging: null,
    ...overrides,
  };
}

function createPackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "package-1",
    packaging_allocation_id: "packaging-allocation-1",
    packaging_operation_id: "packaging-operation-1",
    package_type_id: packageType.id,
    package_type: packageType,
    package_identifier: "PKG-2026-000001",
    packaged_at: "2026-07-08T01:00:00.000Z",
    finished_product_weight_grams: "232.466",
    package_weight_grams: "246.641",
    oxygen_absorber: "500cc",
    storage_location_id: unassignedStorageLocation.id,
    storage_location: unassignedStorageLocation,
    status: "In Storage",
    notes: null,
    label: {
      id: "package-label-1",
      package_id: "package-1",
      status: "Ready",
      display_name: "Taco Chicken",
      description: null,
      ingredients_summary: null,
      preparation_summary: "cubed, seasoned",
      rehydration_instructions: null,
      serving_notes: null,
      net_weight_display: null,
      fresh_equivalent_display: null,
      created_at: "2026-07-08T01:00:00.000Z",
      updated_at: "2026-07-08T01:00:00.000Z",
      print_events: [],
    },
    ...overrides,
  };
}

function mockTrayDetailsFetch(tray: Tray) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith(`/api/v1/trays/${tray.id}`) && method === "GET") {
      return jsonResponse(tray);
    }
    if (url.endsWith("/api/v1/packages/package-1") && method === "GET") {
      return jsonResponse(
        createPackage({
          id: "package-1",
          finished_product_weight_grams: "232.466",
        }),
      );
    }
    if (
      url.endsWith("/api/v1/weight-checks/weight-check-1/correct") &&
      method === "POST"
    ) {
      const body = JSON.parse(String(init?.body)) as {
        weight_grams: string;
        reason: string | null;
      };
      const corrected = {
        ...tray.weight_checks[0],
        weight_grams: body.weight_grams,
      };
      tray.weight_checks = [corrected];
      tray.latest_weight_grams = body.weight_grams;
      return jsonResponse(corrected);
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ detail: `Unhandled test request: ${url}` }),
    } as Response);
  };
}

function firstCheckbox() {
  return screen.getAllByRole("checkbox")[0];
}

async function startPackagingWorkspace(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    await screen.findByRole("button", { name: "Next — Choose trays" }),
  );
  await screen.findByRole("heading", { name: "Choose trays" });
}

async function showWorkflowStage(
  user: ReturnType<typeof userEvent.setup>,
  stageName:
    | "Choose a batch"
    | "Choose trays"
    | "Create packages"
    | "Review & labels"
    | "Finish",
) {
  if (screen.queryByRole("heading", { name: stageName })) return;
  const stageButton = await screen.findByRole("button", {
    name: new RegExp(`^${stageName}`),
  });
  await user.click(stageButton);
  await screen.findByRole("heading", { name: stageName });
}

function latestPackagePost() {
  const calls = latestPackagePostRequests();
  return calls[calls.length - 1];
}

function latestPackagePostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+\/packages$/.test(
        String(input),
      ) && init?.method === "POST",
  );
}

function latestLossPost() {
  const calls = fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+\/losses$/.test(
        String(input),
      ) && init?.method === "POST",
  );
  return calls[calls.length - 1];
}

function packageLabelPatchRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packages\/[^/]+\/label$/.test(String(input)) &&
      init?.method === "PATCH",
  );
}

function packageLabelPreviewPostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith("/api/v1/package-labels/preview") &&
      init?.method === "POST",
  );
}

function printPackageLabelPostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith("/api/v1/package-labels/print") &&
      init?.method === "POST",
  );
}

function latestAllocationPost() {
  const calls = allocationPostRequests();
  return calls[calls.length - 1];
}

function allocationPatchRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+$/.test(
        String(input),
      ) && init?.method === "PATCH",
  );
}

function latestAllocationPatch() {
  const calls = allocationPatchRequests();
  return calls[calls.length - 1];
}

function allocationPostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/allocate-trays$/.test(
        String(input),
      ) && init?.method === "POST",
  );
}

function plannedPackagePatchRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/allocations\/[^/]+$/.test(
        String(input),
      ) && init?.method === "PATCH",
  );
}

function packagingOperationGetRequests(batchId: string) {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith(
        `/api/v1/production-batches/${batchId}/packaging-operation`,
      ) && (init?.method ?? "GET") === "GET",
  ).length;
}

function worksheetGetRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith("/api/v1/packaging/worksheet") &&
      (init?.method ?? "GET") === "GET",
  ).length;
}

function packagingOperationPostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/production-batches\/[^/]+\/packaging-operation$/.test(
        String(input),
      ) && init?.method === "POST",
  );
}

function completePackagingPostRequests() {
  return fetchMock().mock.calls.filter(
    ([input, init]) =>
      /\/api\/v1\/packaging-operations\/[^/]+\/complete$/.test(String(input)) &&
      init?.method === "POST",
  );
}

function parseRequestBody(call: Parameters<typeof fetch> | undefined) {
  if (!call?.[1]?.body) return {};
  return JSON.parse(String(call[1].body));
}

function parseBody(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)) : {};
}

/**
 * ADR-0017: "Save Bag" is disabled while its Planned Package Row autosave is
 * pending. Tests that fill in Bag fields must wait for the debounced
 * autosave to settle before the Save Bag button is clickable.
 */
async function waitForBagAutosave(bagNumber: number) {
  await waitFor(
    () => {
      expect(
        screen.getByRole("button", { name: `Save Bag ${bagNumber}` }),
      ).toBeEnabled();
    },
    { timeout: 3000 },
  );
}

async function chooseCustomOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionName: string,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(
    screen.getByRole("option", { name: new RegExp(optionName) }),
  );
}

async function printedPdfText(createObjectURLMock: ReturnType<typeof vi.fn>) {
  await waitFor(() => {
    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
  });
  const lastCall =
    createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1];
  const blob = lastCall?.[0] as Blob | undefined;
  if (!blob) {
    throw new Error("No PDF Blob was created");
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

function jsonResponse(data: unknown) {
  return Promise.resolve(jsonResponseValue(data));
}

function jsonResponseValue(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve({ success: true, data, meta: {} }),
  } as Response;
}

function errorResponse(status: number, data: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

function fetchMock() {
  return vi.mocked(fetch);
}

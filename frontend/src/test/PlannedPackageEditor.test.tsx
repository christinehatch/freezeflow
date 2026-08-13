import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PackageType,
  PlannedPackageInput,
  PlannedPackageRow,
  StorageLocation,
} from "../api/client";
import { PlannedPackageEditor } from "../components/PlannedPackageEditor";

const quartMylar: PackageType = {
  id: "package-type-1",
  name: "Quart Mylar",
  default_oxygen_absorber: "500cc",
  default_label_template: "avery-5163",
  notes: null,
  archived: false,
};

const pintJar: PackageType = {
  id: "package-type-2",
  name: "Pint Jar",
  default_oxygen_absorber: "300cc",
  default_label_template: "avery-5163",
  notes: null,
  archived: false,
};

const pantry: StorageLocation = {
  id: "storage-pantry",
  name: "Pantry",
  notes: null,
  archived: false,
};

describe("PlannedPackageEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("adds, removes, and predictably renumbers local pending rows without persistence", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(
      screen.getByText(
        "No planned Packages have been added to this Allocation.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );

    expect(
      screen.getByRole("heading", { name: "Pending Planned Package 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pending Planned Package 2" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Empty")).toHaveLength(2);

    await user.click(
      screen.getByRole("button", {
        name: "Remove Allocation 1 Planned Package 1",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Pending Planned Package 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pending Planned Package 2" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Remove Allocation/ }),
    ).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("edits Package, weight, storage, notes, and supported label fields with row-level validation", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );

    const row = within(
      screen.getByLabelText("Allocation 1 Planned Package 1 pending editor"),
    );
    expect(row.getByText("Empty")).toBeInTheDocument();

    const packageType = row.getByLabelText(
      "Allocation 1 Planned Package 1 Package Type",
    );
    const absorber = row.getByLabelText(
      "Allocation 1 Planned Package 1 Oxygen Absorber",
    );
    await chooseOption(user, packageType, "Quart Mylar");
    expect(absorber).toHaveValue("500cc");
    expect(row.getByText("Incomplete")).toBeInTheDocument();

    await user.clear(absorber);
    await user.type(absorber, "900cc custom");
    await chooseOption(user, packageType, "Pint Jar");
    expect(absorber).toHaveValue("900cc custom");

    const finishedWeight = row.getByLabelText(
      "Allocation 1 Planned Package 1 Finished Product Weight",
    );
    await user.type(finishedWeight, "8.4");
    await chooseOption(
      user,
      row.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight Unit",
      ),
      "oz",
    );
    const sealedWeight = row.getByLabelText(
      "Allocation 1 Planned Package 1 Sealed Package Weight",
    );
    await user.type(sealedWeight, "0");
    expect(
      row.getByText("Sealed Package Weight must be greater than zero."),
    ).toBeInTheDocument();
    await user.clear(sealedWeight);
    await user.type(sealedWeight, "9.1");
    await chooseOption(
      user,
      row.getByLabelText(
        "Allocation 1 Planned Package 1 Sealed Package Weight Unit",
      ),
      "oz",
    );
    await chooseOption(
      user,
      row.getByLabelText("Allocation 1 Planned Package 1 Storage Location"),
      "Pantry",
    );
    await user.type(
      row.getByLabelText("Allocation 1 Planned Package 1 Package Notes"),
      "Keep upright",
    );

    await user.click(row.getByText("Package Label Details"));
    const labelValues = [
      ["Label Display Name", "Taco Dinner"],
      ["Label Description", "Chicken and vegetables"],
      ["Ingredients Summary", "Chicken, cabbage, tomatoes"],
      ["Preparation Summary", "Cubed and seasoned"],
      ["Rehydration Instructions", "Add two cups of water"],
      ["Serving Notes", "Serves two"],
      ["Net Weight Display", "8.4 oz"],
    ] as const;
    for (const [label, value] of labelValues) {
      const field = row.getByLabelText(
        `Allocation 1 Planned Package 1 ${label}`,
      );
      await user.type(field, value);
      expect(field).toHaveValue(value);
    }

    expect(row.getByText("Ready to save")).toBeInTheDocument();
    expect(finishedWeight).toHaveValue(8.4);
    expect(sealedWeight).toHaveValue(9.1);
    expect(
      row.getByLabelText("Allocation 1 Planned Package 1 Storage Location"),
    ).toHaveTextContent("Pantry");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("projects Finished Product Weight live across units without using Sealed Package Weight", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({
      recordedFinishedProductWeightGrams: 100,
      selectedWeightGrams: 500,
    });
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    const projection = within(
      screen.getByLabelText("Allocation 1 projected weight totals"),
    );
    expect(projection.getByText(/Projection incomplete/)).toBeInTheDocument();

    await completeRequiredFields(user, 1, "1");
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("101 g");
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("399 g");

    await user.type(
      screen.getByLabelText(
        "Allocation 1 Planned Package 1 Sealed Package Weight",
      ),
      "200",
    );
    await user.type(
      screen.getByLabelText("Allocation 1 Planned Package 1 Package Notes"),
      "No weight impact",
    );
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("101 g");

    await chooseOption(
      user,
      screen.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight Unit",
      ),
      "oz",
    );
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("128.35 g");

    await chooseOption(
      user,
      screen.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight Unit",
      ),
      "lb",
    );
    expect(
      projection.getByText(/Overallocated by 53.592 g/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("replaces saved draft weight in projections and counts recorded Package weight once", async () => {
    const user = userEvent.setup();
    const saved = createValidPlannedPackageRow("planned-saved", {
      finished_product_weight_grams: "100",
    });
    const recordedPlan = createValidPlannedPackageRow("planned-recorded", {
      finished_product_weight_grams: "100",
      recorded_package_id: "package-recorded",
    });
    renderEditor({
      plannedPackages: [saved, recordedPlan],
      recordedFinishedProductWeightGrams: 100,
      selectedWeightGrams: 300,
    });
    const weight = screen.getByLabelText(
      "Allocation 1 Planned Package 1 Finished Product Weight",
    );
    await user.clear(weight);
    await user.type(weight, "150");
    const projection = within(
      screen.getByLabelText("Allocation 1 projected weight totals"),
    );
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("250 g");
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("50 g");

    await user.click(
      screen.getByRole("button", {
        name: "Remove Allocation 1 Planned Package 1",
      }),
    );
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("100 g");
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("200 g");
  });

  it("hydrates saved rows, reports unavailable references, and protects recorded rows as read-only", () => {
    renderEditor({
      plannedPackages: [
        createPlannedPackageRow("planned-1", {
          package_type_id: quartMylar.id,
          finished_product_weight_grams: "28.349523125",
          finished_product_weight_unit: "oz",
          sealed_package_weight_grams: "453.59237",
          sealed_package_weight_unit: "lb",
          oxygen_absorber: "750cc",
          storage_location_id: pantry.id,
          notes: "Saved notes",
          label_display_name: "Saved Taco Dinner",
        }),
        createPlannedPackageRow("planned-missing", {
          package_type_id: "missing-package-type",
          finished_product_weight_grams: "50",
          storage_location_id: "missing-storage-location",
        }),
        createPlannedPackageRow("planned-recorded", {
          package_type_id: pintJar.id,
          finished_product_weight_grams: "185",
          recorded_package_id: "package-99",
        }),
      ],
    });

    const savedRow = within(
      screen.getByLabelText("Allocation 1 Planned Package 1 pending editor"),
    );
    expect(
      savedRow.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight",
      ),
    ).toHaveValue(1);
    expect(
      savedRow.getByLabelText(
        "Allocation 1 Planned Package 1 Finished Product Weight Unit",
      ),
    ).toHaveTextContent("oz");
    expect(
      savedRow.getByLabelText(
        "Allocation 1 Planned Package 1 Sealed Package Weight",
      ),
    ).toHaveValue(1);
    expect(
      savedRow.getByLabelText(
        "Allocation 1 Planned Package 1 Sealed Package Weight Unit",
      ),
    ).toHaveTextContent("lb");
    expect(
      savedRow.getByLabelText("Allocation 1 Planned Package 1 Package Notes"),
    ).toHaveValue("Saved notes");
    expect(screen.queryByText("planned-1")).not.toBeInTheDocument();

    const missingRow = within(
      screen.getByLabelText("Allocation 1 Planned Package 2 pending editor"),
    );
    expect(missingRow.getByText("Reference unavailable")).toBeInTheDocument();
    expect(
      missingRow.getByRole("combobox", {
        name: "Allocation 1 Planned Package 2 Package Type",
      }),
    ).toHaveTextContent("Package Type unavailable");
    expect(
      missingRow.getByRole("combobox", {
        name: "Allocation 1 Planned Package 2 Storage Location",
      }),
    ).toHaveTextContent("Storage Location unavailable");

    const recordedRowElement = screen.getByLabelText(
      "Allocation 1 Planned Package 3 pending editor",
    );
    const recordedRow = within(recordedRowElement);
    expect(
      recordedRow.getByText("Recorded Package created"),
    ).toBeInTheDocument();
    expect(
      recordedRow.getByText("Preserved as read-only production history."),
    ).toBeInTheDocument();
    expect(
      recordedRow.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
    for (const control of recordedRowElement.querySelectorAll(
      "input, select, textarea",
    )) {
      expect(control).toBeDisabled();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("serializes new and existing rows, converts weights, and rehydrates authoritative identities", async () => {
    const user = userEvent.setup();
    const existingRow = createPlannedPackageRow("planned-existing", {
      package_type_id: quartMylar.id,
      finished_product_weight_grams: "100",
      sealed_package_weight_grams: "110",
    });
    const authoritativeNewRow = createPlannedPackageRow("planned-new", {
      package_type_id: pintJar.id,
      finished_product_weight_grams: "28.350",
      finished_product_weight_unit: "oz",
      sealed_package_weight_grams: "453.592",
      sealed_package_weight_unit: "lb",
      oxygen_absorber: "900cc custom",
      storage_location_id: pantry.id,
      notes: "Keep upright",
      label_display_name: "Taco Dinner",
      label_description: "Chicken and vegetables",
      label_ingredients_summary: "Chicken, cabbage, tomatoes",
      label_preparation_summary: "Cubed and seasoned",
      label_rehydration_instructions: "Add two cups of water",
      label_serving_notes: "Serves two",
      label_net_weight_display: "1 oz",
      label_fresh_equivalent_display: "3 oz fresh",
    });
    const onSave = vi.fn<
      (plannedPackages: PlannedPackageInput[]) => Promise<void>
    >(() => Promise.resolve());
    const onRefresh = vi.fn(() =>
      Promise.resolve([existingRow, authoritativeNewRow]),
    );
    renderEditor({ onRefresh, onSave, plannedPackages: [existingRow] });

    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    const newRow = within(
      screen.getByLabelText("Allocation 1 Planned Package 2 pending editor"),
    );
    await chooseOption(
      user,
      newRow.getByLabelText("Allocation 1 Planned Package 2 Package Type"),
      "Pint Jar",
    );
    await user.type(
      newRow.getByLabelText(
        "Allocation 1 Planned Package 2 Finished Product Weight",
      ),
      "1",
    );
    await chooseOption(
      user,
      newRow.getByLabelText(
        "Allocation 1 Planned Package 2 Finished Product Weight Unit",
      ),
      "oz",
    );
    await user.type(
      newRow.getByLabelText(
        "Allocation 1 Planned Package 2 Sealed Package Weight",
      ),
      "1",
    );
    await chooseOption(
      user,
      newRow.getByLabelText(
        "Allocation 1 Planned Package 2 Sealed Package Weight Unit",
      ),
      "lb",
    );
    await user.clear(
      newRow.getByLabelText("Allocation 1 Planned Package 2 Oxygen Absorber"),
    );
    await user.type(
      newRow.getByLabelText("Allocation 1 Planned Package 2 Oxygen Absorber"),
      "  900cc custom  ",
    );
    await chooseOption(
      user,
      newRow.getByLabelText("Allocation 1 Planned Package 2 Storage Location"),
      "Pantry",
    );
    await user.type(
      newRow.getByLabelText("Allocation 1 Planned Package 2 Package Notes"),
      "  Keep upright  ",
    );
    await user.click(newRow.getByText("Package Label Details"));
    const labels = [
      ["Label Display Name", "Taco Dinner"],
      ["Label Description", "Chicken and vegetables"],
      ["Ingredients Summary", "Chicken, cabbage, tomatoes"],
      ["Preparation Summary", "Cubed and seasoned"],
      ["Rehydration Instructions", "Add two cups of water"],
      ["Serving Notes", "Serves two"],
      ["Net Weight Display", "1 oz"],
    ] as const;
    for (const [label, value] of labels) {
      await user.type(
        newRow.getByLabelText(`Allocation 1 Planned Package 2 ${label}`),
        value,
      );
    }

    await user.click(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "planned-existing",
        finished_product_weight_grams: "100.000",
        finished_product_weight_unit: "g",
      }),
      {
        package_type_id: pintJar.id,
        finished_product_weight_grams: "28.350",
        finished_product_weight_unit: "oz",
        sealed_package_weight_grams: "453.592",
        sealed_package_weight_unit: "lb",
        oxygen_absorber: "900cc custom",
        storage_location_id: pantry.id,
        notes: "Keep upright",
        label_display_name: "Taco Dinner",
        label_description: "Chicken and vegetables",
        label_ingredients_summary: "Chicken, cabbage, tomatoes",
        label_preparation_summary: "Cubed and seasoned",
        label_rehydration_instructions: "Add two cups of water",
        label_serving_notes: "Serves two",
        label_net_weight_display: "1 oz",
      },
    ]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Planned Packages saved"),
    ).toBeInTheDocument();

    const rehydratedNewRow = within(
      screen.getByLabelText("Allocation 1 Planned Package 2 pending editor"),
    );
    await user.type(
      rehydratedNewRow.getByLabelText(
        "Allocation 1 Planned Package 2 Package Notes",
      ),
      " updated",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );
    expect(onSave.mock.calls[1][0][1]).toMatchObject({ id: "planned-new" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("persists removal by submitting only the remaining saved rows", async () => {
    const user = userEvent.setup();
    const first = createValidPlannedPackageRow("planned-1");
    const second = createValidPlannedPackageRow("planned-2", {
      package_type_id: pintJar.id,
    });
    const onSave = vi.fn<
      (plannedPackages: PlannedPackageInput[]) => Promise<void>
    >(() => Promise.resolve());
    renderEditor({
      onRefresh: async () => [second],
      onSave,
      plannedPackages: [first, second],
    });

    await user.click(
      screen.getByRole("button", {
        name: "Remove Allocation 1 Planned Package 1",
      }),
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toHaveLength(1);
    expect(onSave.mock.calls[0][0][0]).toMatchObject({ id: "planned-2" });
    expect(
      await screen.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
  });

  it("blocks invalid and recorded-history persistence", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<
      (plannedPackages: PlannedPackageInput[]) => Promise<void>
    >(() => Promise.resolve());
    const { rerender } = renderEditor({ onSave });
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    expect(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();

    const recorded = createValidPlannedPackageRow("planned-recorded", {
      recorded_package_id: "package-1",
    });
    rerender(
      <PlannedPackageEditor
        allocationId="allocation-1"
        allocationNumber={1}
        authoritativeVersion="allocation-1:v2"
        formatError={formatTestError}
        onProjectionChange={() => undefined}
        onRefresh={async () => [recorded]}
        onSave={onSave}
        packageTypes={[quartMylar, pintJar]}
        plannedPackages={[recorded]}
        recordedFinishedProductWeightGrams={100}
        selectedWeightGrams={500}
        storageLocations={[pantry]}
      />,
    );
    expect(
      await screen.findByText(
        /recorded Package history cannot be reconciled safely/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("guards duplicate saves and retries refresh without repeating persistence", async () => {
    const user = userEvent.setup();
    const saveDeferred = deferred<void>();
    const saved = createValidPlannedPackageRow("planned-new");
    const onSave = vi.fn(() => saveDeferred.promise);
    const onRefresh = vi
      .fn<() => Promise<PlannedPackageRow[]>>()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce([saved]);
    renderEditor({ onRefresh, onSave });
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    await completeRequiredFields(user, 1);

    const saveButton = screen.getByRole("button", {
      name: "Save Allocation 1 Planned Packages",
    });
    await user.click(saveButton);
    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
    saveDeferred.resolve();

    expect(
      await screen.findByText(
        /were saved, but the latest operation state could not be refreshed/,
      ),
    ).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Retry latest state" }),
    );
    expect(
      await screen.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("preserves edits and permits manual retry after a structured save error", async () => {
    const user = userEvent.setup();
    const saved = createValidPlannedPackageRow("planned-new");
    const onSave = vi
      .fn<(plannedPackages: PlannedPackageInput[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error("PLANNED_WEIGHT_EXCEEDED: Too heavy"))
      .mockResolvedValueOnce(undefined);
    renderEditor({ onRefresh: async () => [saved], onSave });
    await user.click(
      screen.getByRole("button", { name: "Add Planned Package" }),
    );
    await completeRequiredFields(user, 1);

    const notes = screen.getByLabelText(
      "Allocation 1 Planned Package 1 Package Notes",
    );
    await user.type(notes, "Preserve this edit");
    const projection = within(
      screen.getByLabelText("Allocation 1 projected weight totals"),
    );
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("400 g");
    await user.click(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(
      screen.getByRole("alert", {
        name: "",
      }),
    ).toHaveTextContent("PLANNED_WEIGHT_EXCEEDED: Too heavy");
    expect(notes).toHaveValue("Preserve this edit");
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("400 g");

    await user.click(
      screen.getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      }),
    );
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
  });

  it("preserves replacement removal intent and projected totals after a failed save", async () => {
    const user = userEvent.setup();
    const first = createValidPlannedPackageRow("planned-1");
    const second = createValidPlannedPackageRow("planned-2");
    const onSave = vi
      .fn<(plannedPackages: PlannedPackageInput[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Unable to reconcile Planned Packages"))
      .mockResolvedValueOnce(undefined);
    renderEditor({
      onRefresh: async () => [second],
      onSave,
      plannedPackages: [first, second],
    });

    await user.click(
      screen.getByRole("button", {
        name: "Remove Allocation 1 Planned Package 1",
      }),
    );
    const projection = within(
      screen.getByLabelText("Allocation 1 projected weight totals"),
    );
    expect(
      projection.getByText("Projected Allocated Weight").parentElement,
    ).toHaveTextContent("100 g");
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("400 g");

    const saveButton = screen.getByRole("button", {
      name: "Save Allocation 1 Planned Packages",
    });
    await user.click(saveButton);
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(screen.queryByText("planned-1")).not.toBeInTheDocument();
    expect(
      projection.getByText("Projected Remaining Weight").parentElement,
    ).toHaveTextContent("400 g");
    expect(onSave.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "planned-2" }),
    ]);

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0]).toEqual([
      expect.objectContaining({ id: "planned-2" }),
    ]);
    expect(
      await screen.findByText("Planned Packages saved"),
    ).toBeInTheDocument();
  });

  it("keeps local rows isolated by Allocation and communicates missing reference data", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PlannedPackageEditor
          allocationId="allocation-1"
          allocationNumber={1}
          authoritativeVersion="allocation-1:v1"
          formatError={formatTestError}
          onProjectionChange={() => undefined}
          onRefresh={async () => []}
          onSave={async () => undefined}
          packageTypes={[]}
          plannedPackages={[]}
          recordedFinishedProductWeightGrams={0}
          selectedWeightGrams={500}
          storageLocations={[]}
        />
        <PlannedPackageEditor
          allocationId="allocation-2"
          allocationNumber={2}
          authoritativeVersion="allocation-2:v1"
          formatError={formatTestError}
          onProjectionChange={() => undefined}
          onRefresh={async () => []}
          onSave={async () => undefined}
          packageTypes={[]}
          plannedPackages={[]}
          recordedFinishedProductWeightGrams={0}
          selectedWeightGrams={300}
          storageLocations={[]}
        />
      </>,
    );

    const allocationOne = within(
      screen.getByLabelText("Allocation 1 Planned Packages editor"),
    );
    const allocationTwo = within(
      screen.getByLabelText("Allocation 2 Planned Packages editor"),
    );
    await user.click(
      allocationOne.getByRole("button", { name: "Add Planned Package" }),
    );

    expect(
      allocationOne.getByRole("heading", {
        name: "Pending Planned Package 1",
      }),
    ).toBeInTheDocument();
    expect(
      allocationOne.getByText("No active Package Types are available."),
    ).toBeInTheDocument();
    expect(
      allocationOne.getByText("No active Storage Locations are available."),
    ).toBeInTheDocument();
    expect(
      allocationTwo.getByText(
        "No planned Packages have been added to this Allocation.",
      ),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

function renderEditor({
  authoritativeVersion = "allocation-1:v1",
  onProjectionChange = vi.fn(),
  onRefresh,
  onSave = vi.fn<(plannedPackages: PlannedPackageInput[]) => Promise<void>>(
    () => Promise.resolve(),
  ),
  plannedPackages = [],
  recordedFinishedProductWeightGrams = 0,
  selectedWeightGrams = 500,
}: {
  authoritativeVersion?: string;
  onProjectionChange?: Parameters<
    typeof PlannedPackageEditor
  >[0]["onProjectionChange"];
  onRefresh?: () => Promise<PlannedPackageRow[]>;
  onSave?: (plannedPackages: PlannedPackageInput[]) => Promise<void>;
  plannedPackages?: PlannedPackageRow[];
  recordedFinishedProductWeightGrams?: number | null;
  selectedWeightGrams?: number | null;
} = {}) {
  const refresh = onRefresh ?? (() => Promise.resolve(plannedPackages));
  const result = render(
    <PlannedPackageEditor
      allocationId="allocation-1"
      allocationNumber={1}
      authoritativeVersion={authoritativeVersion}
      formatError={formatTestError}
      onProjectionChange={onProjectionChange}
      onRefresh={refresh}
      onSave={onSave}
      packageTypes={[quartMylar, pintJar]}
      plannedPackages={plannedPackages}
      recordedFinishedProductWeightGrams={recordedFinishedProductWeightGrams}
      selectedWeightGrams={selectedWeightGrams}
      storageLocations={[pantry]}
    />,
  );
  return { ...result, onProjectionChange, onRefresh: refresh, onSave };
}

function formatTestError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save";
}

function createPlannedPackageRow(
  id: string,
  overrides: Partial<PlannedPackageRow> = {},
): PlannedPackageRow {
  return {
    id,
    packaging_allocation_id: "allocation-1",
    package_type_id: null,
    finished_product_weight_grams: null,
    finished_product_weight_unit: "g",
    sealed_package_weight_grams: null,
    sealed_package_weight_unit: "g",
    oxygen_absorber: null,
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

function createValidPlannedPackageRow(
  id: string,
  overrides: Partial<PlannedPackageRow> = {},
) {
  return createPlannedPackageRow(id, {
    package_type_id: quartMylar.id,
    finished_product_weight_grams: "100",
    finished_product_weight_unit: "g",
    sealed_package_weight_grams: "110",
    sealed_package_weight_unit: "g",
    ...overrides,
  });
}

async function completeRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  rowNumber: number,
  finishedWeight = "100",
) {
  await chooseOption(
    user,
    screen.getByLabelText(
      `Allocation 1 Planned Package ${rowNumber} Package Type`,
    ),
    "Quart Mylar",
  );
  await user.type(
    screen.getByLabelText(
      `Allocation 1 Planned Package ${rowNumber} Finished Product Weight`,
    ),
    finishedWeight,
  );
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  optionName: string,
) {
  await user.click(control);
  await user.click(screen.getByRole("option", { name: optionName }));
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

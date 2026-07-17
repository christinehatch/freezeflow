import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageType,
  PackagingResult,
  PackagingWorksheetItem,
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
  const open = vi.fn(() => ({ closed: false }));

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

  it("creates a package type inline, packages an eligible tray, and prints Avery label content", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState({ packageTypes: [] });
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    expect(
      await screen.findByRole("heading", { name: "Packaging Worksheet" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Taco Chicken")).toBeInTheDocument();
    expect(screen.getByText("238.1 g")).toBeInTheDocument();
    expect(
      screen.queryByText("Previously Packaged Pears"),
    ).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Quart Mylar"), "Quart Mylar");
    await user.type(screen.getByPlaceholderText("500cc"), "500cc");
    await user.type(screen.getByPlaceholderText("standard"), "avery-5163");
    await user.click(screen.getByRole("button", { name: "+ Add Package Type" }));

    expect(await screen.findAllByText("Quart Mylar")).not.toHaveLength(0);
    expect(screen.getByDisplayValue("500cc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish Packaging" })).toBeDisabled();

    await user.click(firstCheckbox());
    const packageRow = packageEditorRows()[0];
    expect(within(packageRow).getByDisplayValue("500cc")).toBeInTheDocument();

    await user.type(
      within(packageRow).getByLabelText("Finished Product Weight"),
      "238.1",
    );
    await user.type(
      within(packageRow).getByLabelText("Sealed Package Weight"),
      "246.6",
    );
    await user.clear(within(packageRow).getByDisplayValue("500cc"));
    await user.type(within(packageRow).getByPlaceholderText("default"), "750cc");

    expect(
      screen.getByText(/Package weights differ from selected Finished Product Weight/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish Packaging" }));

    expect(
      await screen.findByRole("heading", { name: "Packaging Complete" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Print Avery 5163 Labels" }),
    ).toBeInTheDocument();

    const packagePost = latestPackagePost();
    expect(packagePost).toBeDefined();
    const body = parseRequestBody(packagePost);
    expect(body).toMatchObject({
      tray_ids: ["tray-1"],
      packages: [
        {
          package_type_id: "package-type-1",
          finished_product_weight_grams: "238.100",
          package_weight_grams: "246.600",
          oxygen_absorber: "750cc",
          storage_location_id: null,
        },
      ],
    });
    expect(body.packages[0]).not.toHaveProperty("package_identifier");

    await user.click(
      screen.getByRole("button", { name: "Print Avery 5163 Labels" }),
    );

    const labelPdf = await printedPdfText(createObjectURL);
    expect(labelPdf).toContain("PKG-2026-000001");
    expect(labelPdf).toContain("Taco Chicken");
    expect(labelPdf).toContain("Quart Mylar");
    expect(labelPdf).toContain("Batch 005");
    expect(labelPdf).toContain("black");
    expect(labelPdf).toContain("2.05 lb fresh = 8.4 oz freeze-dried");
    expect(labelPdf).toContain("cubed, seasoned");
    expect(labelPdf).toContain("Jul 8, 2026");
    expect(labelPdf).toContain("Oxygen absorber: 750cc");
    expect(labelPdf).not.toContain("Storage:");
    expect(open).toHaveBeenCalledWith(
      "blob:test-label-pdf",
      "_blank",
      "height=900,width=900",
    );
  });

  it("packages multiple trays from one Production Batch into multiple Packages", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    await screen.findByText("Taco Chicken");
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: "+ Add Package" }));

    const rows = packageEditorRows();
    await user.type(
      within(rows[0]).getByLabelText("Finished Product Weight"),
      "200",
    );
    await user.type(
      within(rows[0]).getByLabelText("Sealed Package Weight"),
      "205",
    );
    await user.type(
      within(rows[1]).getByLabelText("Finished Product Weight"),
      "223.1",
    );
    await user.type(
      within(rows[1]).getByLabelText("Sealed Package Weight"),
      "228.1",
    );
    await user.selectOptions(
      within(rows[1]).getAllByRole("combobox")[0],
      pintPackageType.id,
    );
    await user.selectOptions(
      within(rows[1]).getAllByRole("combobox")[3],
      pantryStorageLocation.id,
    );

    await user.click(screen.getByRole("button", { name: "Finish Packaging" }));

    expect(await screen.findByText("Created 2 Packages.")).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000002")).toBeInTheDocument();

    const body = parseRequestBody(latestPackagePost());
    expect(body.tray_ids).toEqual(["tray-1", "tray-2"]);
    expect(body.packages).toHaveLength(2);
    expect(body.packages[0]).toMatchObject({
      package_type_id: "package-type-1",
      finished_product_weight_grams: "200.000",
      package_weight_grams: "205.000",
      oxygen_absorber: "500cc",
      storage_location_id: null,
    });
    expect(body.packages[1]).toMatchObject({
      package_type_id: "package-type-2",
      finished_product_weight_grams: "223.100",
      package_weight_grams: "228.100",
      oxygen_absorber: "300cc",
      storage_location_id: "storage-pantry",
    });
  });

  it("prevents cross-batch selection and excludes already Packaged Trays from the worksheet", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    expect(await screen.findByText("Taco Chicken")).toBeInTheDocument();
    expect(screen.getByText("Apples")).toBeInTheDocument();
    expect(screen.queryByText("Skittles")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Previously Packaged Pears"),
    ).not.toBeInTheDocument();

    await user.click(firstCheckbox());
    expect(screen.getByRole("button", { name: "Finish Packaging" })).toBeDisabled();

    await user.selectOptions(
      screen.getByLabelText("Production Batch"),
      "batch-2",
    );

    expect(await screen.findByText("Skittles")).toBeInTheDocument();
    expect(screen.queryByText("Taco Chicken")).not.toBeInTheDocument();
    expect(screen.queryByText("Apples")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish Packaging" })).toBeDisabled();
  });

  it("tracks a mixed source pool across a chosen package count", async () => {
    const user = userEvent.setup();
    const testState = createPackagingTestState();
    vi.stubGlobal("fetch", vi.fn(testState.fetch));

    renderPackagingPage();

    await screen.findByText("Taco Chicken");
    await user.click(screen.getByRole("button", { name: "Select All Trays" }));
    expect(screen.getByText("2 Trays mixed")).toBeInTheDocument();

    const packageCount = screen.getByLabelText("Package Count");
    await user.clear(packageCount);
    await user.type(packageCount, "3");
    expect(packageEditorRows()).toHaveLength(3);

    const firstPackage = packageEditorRows()[0];
    await user.selectOptions(
      within(firstPackage).getByLabelText("Finished Product Weight Unit"),
      "g",
    );
    await user.type(
      within(firstPackage).getByLabelText("Finished Product Weight"),
      "100",
    );

    const remainingCard = screen.getByText("Remaining To Package").parentElement;
    expect(remainingCard).not.toBeNull();
    expect(within(remainingCard!).getByText("323.1 g")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finish Packaging" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "+ Add Package for Remaining" }),
    );
    expect(packageEditorRows()).toHaveLength(3);
    expect(
      within(packageEditorRows()[1]).getByLabelText("Finished Product Weight"),
    ).toHaveValue(323.1);
    expect(
      within(packageEditorRows()[1]).getByLabelText(
        "Finished Product Weight Unit",
      ),
    ).toHaveValue("g");
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
  const open = vi.fn(() => ({ closed: false }));

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
        packaged_at: "2026-07-08T01:00:00.000Z",
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

    expect(await screen.findAllByRole("heading", { name: "Taco Chicken" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Packaging" })).toBeInTheDocument();
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
    await user.click(
      screen.getByRole("button", { name: "Save Correction" }),
    );
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
    expect(labelPdf).toContain("2 lb fresh = 8.2 oz freeze-dried");
    expect(labelPdf).toContain("cubed, seasoned");
    expect(labelPdf).toContain("Jul 8, 2026");
    expect(labelPdf).not.toContain("Storage:");
    expect(open).toHaveBeenCalledWith(
      "blob:test-tray-label-pdf",
      "_blank",
      "height=900,width=900",
    );
  });
});

function renderPackagingPage() {
  renderWithProviders(
    <MemoryRouter>
      <PackagingPage />
    </MemoryRouter>,
  );
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function createPackagingTestState(
  overrides: Partial<{
    worksheet: PackagingWorksheetItem[];
    packageTypes: PackageType[];
    storageLocations: StorageLocation[];
  }> = {},
) {
  const state = {
    worksheet: overrides.worksheet ?? defaultWorksheet(),
    packageTypes: overrides.packageTypes ?? [packageType, pintPackageType],
    storageLocations: overrides.storageLocations ?? [
      unassignedStorageLocation,
      pantryStorageLocation,
    ],
  };

  function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/v1/packaging/worksheet") && method === "GET") {
      return jsonResponse(state.worksheet);
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

    if (url.endsWith("/api/v1/packages") && method === "POST") {
      const body = parseBody(init);
      return jsonResponse(createPackagingResult(state, body));
    }

    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ detail: `Unhandled test request: ${url}` }),
    } as Response);
  }

  return { fetch };
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

function createPackagingResult(
  state: {
    worksheet: PackagingWorksheetItem[];
    packageTypes: PackageType[];
    storageLocations: StorageLocation[];
  },
  body: {
    tray_ids?: string[];
    packages?: {
      package_type_id: string;
      finished_product_weight_grams: string;
      package_weight_grams: string;
      oxygen_absorber?: string | null;
      storage_location_id?: string | null;
      notes?: string | null;
    }[];
  },
): PackagingResult {
  const selectedTrays = state.worksheet.flatMap((item) =>
    item.eligible_trays.filter((tray) => body.tray_ids?.includes(tray.id)),
  );
  const packageLines = body.packages ?? [];
  const packages = packageLines.map((line, index) => {
    const currentPackageType =
      state.packageTypes.find((type) => type.id === line.package_type_id) ??
      packageType;
    const storageLocation =
      state.storageLocations.find(
        (location) => location.id === line.storage_location_id,
      ) ?? unassignedStorageLocation;
    return createPackage({
      id: `package-${index + 1}`,
      package_type_id: currentPackageType.id,
      package_type: currentPackageType,
      package_identifier: `PKG-2026-${String(index + 1).padStart(6, "0")}`,
      finished_product_weight_grams: line.finished_product_weight_grams,
      package_weight_grams: line.package_weight_grams,
      oxygen_absorber:
        line.oxygen_absorber ?? currentPackageType.default_oxygen_absorber,
      storage_location_id: storageLocation.id,
      storage_location: storageLocation,
      notes: line.notes ?? null,
    });
  });
  const sourceWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const packageWeight = packages.reduce(
    (total, packageItem) => total + Number(packageItem.package_weight_grams),
    0,
  );
  const labels = packages.map((packageItem) =>
    packageLabelForPackage(packageItem, selectedTrays),
  );

  return {
    packaging_operation: {
      id: "packaging-operation-1",
      packaged_at: "2026-07-08T01:00:00.000Z",
      notes: null,
      trays: selectedTrays.map((tray) => ({ ...tray, status: "Packaged" })),
      packages,
    },
    packages,
    warnings:
      sourceWeight === packageWeight
        ? []
        : [
            `Package weights differ from the selected Tray Final Dry Weight total by ${(
              packageWeight - sourceWeight
            ).toFixed(3)} g.`,
          ],
    source_weight_grams: String(sourceWeight),
    package_weight_grams: String(packageWeight),
    labels,
  };
}

function createPackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "package-1",
    packaging_operation_id: "packaging-operation-1",
    package_type_id: packageType.id,
    package_type: packageType,
    package_identifier: "PKG-2026-000001",
    finished_product_weight_grams: "232.466",
    package_weight_grams: "246.641",
    oxygen_absorber: "500cc",
    storage_location_id: unassignedStorageLocation.id,
    storage_location: unassignedStorageLocation,
    status: "In Storage",
    notes: null,
    ...overrides,
  };
}

function packageLabelForPackage(
  packageItem: Package,
  selectedTrays: Tray[],
): PackageLabel {
  const firstTray = selectedTrays[0];
  const totalStartingWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.starting_weight_grams ?? 0),
    0,
  );
  const totalFinalDryWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const finishedProductWeight = Number(
    packageItem.finished_product_weight_grams,
  );
  const freshEquivalent =
    totalStartingWeight > 0 &&
    totalFinalDryWeight > 0 &&
    finishedProductWeight > 0
      ? (totalStartingWeight * finishedProductWeight) / totalFinalDryWeight
      : null;
  return {
    package_id: packageItem.id,
    package_identifier: packageItem.package_identifier,
    batch_number: "Batch 005",
    freeze_dryer: firstTray?.production_batch_id === "batch-2" ? "white" : "black",
    product_summary: selectedTrays
      .map((tray) => tray.product_name)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + "),
    preparation_summary: selectedTrays
      .map((tray) => tray.preparation)
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + "),
    package_type: packageItem.package_type.name,
    finished_product_weight_grams:
      packageItem.finished_product_weight_grams,
    fresh_equivalent_grams:
      freshEquivalent === null ? null : String(freshEquivalent),
    package_weight_grams: packageItem.package_weight_grams,
    oxygen_absorber: packageItem.oxygen_absorber,
    packaged_at: "2026-07-08T01:00:00.000Z",
    label_template: packageItem.package_type.default_label_template,
  };
}

function mockTrayDetailsFetch(tray: Tray) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith(`/api/v1/trays/${tray.id}`) && method === "GET") {
      return jsonResponse(tray);
    }
    if (url.endsWith("/api/v1/packages/labels") && method === "POST") {
      const packageItem = createPackage({
        id: "package-1",
        finished_product_weight_grams: "232.466",
      });
      return jsonResponse([packageLabelForPackage(packageItem, [tray])]);
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

function packageEditorRows() {
  const createPackagesSection = screen
    .getByRole("heading", { name: "Create Packages" })
    .closest("form");
  if (!createPackagesSection) {
    throw new Error("Could not find Create Packages form");
  }
  return within(createPackagesSection).getAllByRole("row").slice(1);
}

function firstCheckbox() {
  return screen.getAllByRole("checkbox")[0];
}

function latestPackagePost() {
  const calls = fetchMock().mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith("/api/v1/packages") && init?.method === "POST",
  );
  return calls[calls.length - 1];
}

function parseRequestBody(call: Parameters<typeof fetch> | undefined) {
  if (!call?.[1]?.body) return {};
  return JSON.parse(String(call[1].body));
}

function parseBody(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)) : {};
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
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data, meta: {} }),
  } as Response);
}

function fetchMock() {
  return vi.mocked(fetch);
}

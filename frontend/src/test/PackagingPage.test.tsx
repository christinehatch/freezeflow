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
    expect(screen.getByRole("button", { name: "Create Packages" })).toBeDisabled();

    await user.click(firstCheckbox());
    const packageRow = packageEditorRows()[0];
    expect(within(packageRow).getByDisplayValue("500cc")).toBeInTheDocument();

    await user.clear(within(packageRow).getByRole("spinbutton"));
    await user.type(within(packageRow).getByRole("spinbutton"), "8.7");
    await user.clear(within(packageRow).getByDisplayValue("500cc"));
    await user.type(within(packageRow).getByPlaceholderText("default"), "750cc");

    expect(
      screen.getByText(/Package weights differ from selected Finished Product Weight/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Packages" }));

    expect(
      await screen.findByRole("heading", { name: "Packaging Complete" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Storage: Unassigned")).toBeInTheDocument();
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
          package_weight_grams: "246.641",
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
    expect(labelPdf).toContain("Oxygen absorber: 750cc");
    expect(labelPdf).toContain("Storage: Unassigned");
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
    await user.clear(within(rows[0]).getByRole("spinbutton"));
    await user.type(within(rows[0]).getByRole("spinbutton"), "4.2");
    await user.clear(within(rows[1]).getByRole("spinbutton"));
    await user.type(within(rows[1]).getByRole("spinbutton"), "5.1");
    await user.selectOptions(
      within(rows[1]).getAllByRole("combobox")[0],
      pintPackageType.id,
    );
    await user.selectOptions(
      within(rows[1]).getAllByRole("combobox")[2],
      pantryStorageLocation.id,
    );

    await user.click(screen.getByRole("button", { name: "Create Packages" }));

    expect(await screen.findByText("Created 2 Packages.")).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("PKG-2026-000002")).toBeInTheDocument();

    const body = parseRequestBody(latestPackagePost());
    expect(body.tray_ids).toEqual(["tray-1", "tray-2"]);
    expect(body.packages).toHaveLength(2);
    expect(body.packages[0]).toMatchObject({
      package_type_id: "package-type-1",
      package_weight_grams: "119.068",
      oxygen_absorber: "500cc",
      storage_location_id: null,
    });
    expect(body.packages[1]).toMatchObject({
      package_type_id: "package-type-2",
      package_weight_grams: "144.583",
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
    expect(screen.getByText("Skittles")).toBeInTheDocument();
    expect(
      screen.queryByText("Previously Packaged Pears"),
    ).not.toBeInTheDocument();

    await user.click(firstCheckbox());

    const skittlesRow = rowForText("Skittles");
    expect(within(skittlesRow).getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Packages" })).toBeEnabled();
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
    expect(screen.getByText("Status: In Storage")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reprint Avery 5163 Labels" }),
    );

    const labelPdf = await printedPdfText(createObjectURL);
    expect(labelPdf).toContain("PKG-2026-000001");
    expect(labelPdf).toContain("Taco Chicken");
    expect(labelPdf).toContain("Quart Mylar");
    expect(labelPdf).toContain("Batch 005");
    expect(labelPdf).toContain("black");
    expect(labelPdf).toContain("Slot 1");
    expect(labelPdf).toContain("Storage: Unassigned");
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
  return {
    package_id: packageItem.id,
    package_identifier: packageItem.package_identifier,
    batch_number: "Batch 005",
    freeze_dryer: firstTray?.production_batch_id === "batch-2" ? "white" : "black",
    product_summary: selectedTrays
      .map((tray) => tray.product_name)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + "),
    package_type: packageItem.package_type.name,
    package_weight_grams: packageItem.package_weight_grams,
    oxygen_absorber: packageItem.oxygen_absorber,
    storage_location: packageItem.storage_location.name,
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

function rowForText(text: string) {
  const row = screen.getByText(text).closest("tr");
  if (!row) {
    throw new Error(`Could not find row for ${text}`);
  }
  return row;
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

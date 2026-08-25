import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Package, StorageLocation } from "../api/client";
import {
  type BinContents,
  type BinContentsEntry,
  printBinContents,
  toBinContents,
} from "../utils/binContentsPrintouts";

describe("Bin Contents printout", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("builds one Letter-size PDF page per bin, in the order given", async () => {
    const bins: BinContents[] = [
      createBin("Bin A", [createEntry({ productName: "Apples" })]),
      createBin("Bin B", [createEntry({ productName: "Chicken" })]),
    ];
    const { blob } = await printBins(bins);
    const pdf = await blobText(blob);

    expect(blob.type).toBe("application/pdf");
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toContain("/Count 2");
    expect(pdf.match(/\/MediaBox \[0 0 612 792\]/g)).toHaveLength(2);
    const binAIndex = pdf.indexOf("Bin A");
    const binBIndex = pdf.indexOf("Bin B");
    expect(binAIndex).toBeGreaterThan(-1);
    expect(binBIndex).toBeGreaterThan(binAIndex);
  });

  it("splits an oversized bin across numbered pages", async () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      createEntry({
        productName: `Product ${String(index + 1).padStart(2, "0")}`,
      }),
    );
    const { blob } = await printBins([createBin("Large Bin", entries)]);
    const pdf = await blobText(blob);

    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("Large Bin - Page 1 of 2");
    expect(pdf).toContain("Large Bin - Page 2 of 2");
  });

  it("does not number pages for a bin that fits on one page", async () => {
    const { blob } = await printBins([createBin("Bin A", [createEntry()])]);
    const pdf = await blobText(blob);

    expect(pdf).toContain("(Bin A)");
    expect(pdf).not.toContain("Page 1 of");
  });

  it("wraps long product names across up to two lines instead of truncating", async () => {
    const { blob } = await printBins([
      createBin("Bin A", [
        createEntry({
          productName:
            "Freeze Dried Strawberry Cheesecake Bites With Extra Topping",
        }),
      ]),
    ]);
    const pdf = await blobText(blob);

    expect(pdf).not.toContain("...");
    expect(pdf).toContain("Freeze Dried Strawberry Cheesecake Bites With");
    expect(pdf).toContain("Extra Topping");
  });

  it("shows a dash for Packages with no recorded weight", async () => {
    const { blob } = await printBins([
      createBin("Bin A", [createEntry({ weightGrams: null })]),
    ]);
    const pdf = await blobText(blob);

    expect(pdf).toContain("(-) Tj");
  });

  it("sorts entries by product name, then packaged date", () => {
    const location: StorageLocation = {
      id: "loc-1",
      name: "Bin A",
      notes: null,
      archived: false,
    };
    const packages = [
      makePackage("Chicken", "2026-01-01T00:00:00Z"),
      makePackage("Apples", "2026-02-01T00:00:00Z"),
      makePackage("Apples", "2026-01-01T00:00:00Z"),
    ];
    const bin = toBinContents(location, packages);

    expect(
      bin.entries.map((entry) => `${entry.productName}@${entry.packagedAt}`),
    ).toEqual([
      "Apples@2026-01-01T00:00:00Z",
      "Apples@2026-02-01T00:00:00Z",
      "Chicken@2026-01-01T00:00:00Z",
    ]);
  });

  it("escapes PDF punctuation and delays blob revocation", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const { blob } = await printBins([
      createBin("Bin (Mom's)", [
        createEntry({ productName: String.raw`Soup \ batch` }),
      ]),
    ]);
    const pdf = await blobText(blob);

    expect(pdf).toContain(String.raw`Bin \(Mom's\)`);
    expect(pdf).toContain(String.raw`Soup \\ batch`);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:bin-contents-test");
  });
});

async function printBins(bins: BinContents[]) {
  let createdBlob: Blob | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    if (!(blob instanceof Blob)) {
      throw new Error("Bin Contents output must be created from a PDF Blob");
    }
    createdBlob = blob;
    return "blob:bin-contents-test";
  });
  const locationReplace = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({
    closed: false,
    close: vi.fn(),
    document: {
      title: "",
      body: {
        replaceChildren: vi.fn(),
        append: vi.fn(),
      },
      createElement: vi.fn(() => ({
        textContent: "",
        style: { cssText: "" },
      })),
    },
    location: { replace: locationReplace },
  } as unknown as Window);

  expect(printBinContents(bins)).toBe(true);
  if (!createdBlob) throw new Error("No Bin Contents PDF Blob was created");
  return { blob: createdBlob, locationReplace };
}

function createBin(name: string, entries: BinContentsEntry[]): BinContents {
  return { storageLocationName: name, entries };
}

function createEntry(
  overrides: Partial<BinContentsEntry> = {},
): BinContentsEntry {
  return {
    productName: "Taco Chicken",
    weightGrams: "240.000",
    packagedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function makePackage(productName: string, packagedAt: string): Package {
  return {
    id: `package-${productName}-${packagedAt}`,
    packaging_allocation_id: "allocation-1",
    packaging_operation_id: "operation-1",
    package_type_id: "package-type-1",
    package_type: {
      id: "package-type-1",
      name: "Quart Mylar",
      default_oxygen_absorber: null,
      default_label_template: null,
      notes: null,
      archived: false,
    },
    package_identifier: "PKG-2026-000001",
    packaged_at: packagedAt,
    package_weight_grams: "245.000",
    finished_product_weight_grams: "240.000",
    oxygen_absorber: null,
    storage_location_id: "bin-a",
    storage_location: {
      id: "bin-a",
      name: "Bin A",
      notes: null,
      archived: false,
    },
    status: "In Storage",
    notes: null,
    label: {
      id: "label-1",
      package_id: "package-1",
      status: "Ready",
      display_name: productName,
      description: null,
      ingredients_summary: null,
      preparation_summary: null,
      rehydration_instructions: null,
      serving_notes: null,
      net_weight_display: null,
      fresh_equivalent_display: null,
      created_at: "2026-05-03T00:00:00Z",
      updated_at: "2026-05-03T00:00:00Z",
      print_events: [],
    },
  };
}

function blobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

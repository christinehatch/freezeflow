import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type Avery5163Label,
  printAvery5163Labels,
} from "../utils/avery5163Labels";

describe("Avery 5163 PDF output", () => {
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

  it("builds paginated Letter-size PDF 1.4 with valid stream lengths and offsets", async () => {
    const { blob, locationReplace } = await printLabels(
      Array.from({ length: 11 }, (_, index) =>
        createLabel({
          packageIdentifier: `PKG-2026-${String(index + 1).padStart(6, "0")}`,
        }),
      ),
    );
    const pdf = await blobText(blob);

    expect(blob.type).toBe("application/pdf");
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.match(/\/MediaBox \[0 0 612 792\]/g)).toHaveLength(2);
    expect(pdf).toContain("/Count 2");
    expect(locationReplace).toHaveBeenCalledWith("blob:avery-5163-test");

    for (const match of pdf.matchAll(
      /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g,
    )) {
      expect(match[2].length).toBe(Number(match[1]));
    }
    for (const match of pdf.matchAll(/^(\d{10}) 00000 n $/gm)) {
      const offset = Number(match[1]);
      expect(pdf.slice(offset)).toMatch(/^\d+ 0 obj\n/);
    }
    const startXref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(startXref)).toMatch(/^xref\n/);
  });

  it("escapes PDF punctuation, replaces unsupported characters, omits Storage Location, and delays revocation", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const { blob } = await printLabels([
      createLabel({
        productName: String.raw`Soup (Mom's) \ batch – 🍲`,
        preparationSummary: String.raw`Stir (gently) \ then serve`,
      }),
    ]);
    const pdf = await blobText(blob);

    expect(pdf).toContain(String.raw`Soup \(Mom's\) \\ batch`);
    expect(pdf).toContain(String.raw`Stir \(gently\) \\ then serve`);
    expect(pdf).not.toContain("–");
    expect(pdf).not.toContain("🍲");
    expect(pdf).not.toContain("Storage:");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:avery-5163-test");
  });
});

async function printLabels(labels: Avery5163Label[]) {
  let createdBlob: Blob | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    if (!(blob instanceof Blob)) {
      throw new Error("Avery 5163 output must be created from a PDF Blob");
    }
    createdBlob = blob;
    return "blob:avery-5163-test";
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

  expect(printAvery5163Labels(labels)).toBe(true);
  if (!createdBlob) throw new Error("No Avery 5163 PDF Blob was created");
  return { blob: createdBlob, locationReplace };
}

function createLabel(overrides: Partial<Avery5163Label> = {}): Avery5163Label {
  return {
    packageIdentifier: "PKG-2026-000001",
    productName: "Taco Chicken",
    preparationSummary: "Cubed and seasoned",
    netWeightDisplay: "8.4 oz freeze-dried",
    freshEquivalentDisplay: "2.05 lb",
    freshEquivalentGrams: "929.864",
    finishedProductWeightGrams: "238.1",
    packageType: "Quart Mylar",
    batchLine: "Batch 014 · White",
    oxygenAbsorber: "500cc",
    packagedAt: "2026-07-18T10:00:00.000Z",
    ...overrides,
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

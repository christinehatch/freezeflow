import type { Package, PackageLabel } from "../api/client";
import {
  loadPdfIntoWindow,
  paginateItems,
  pdfText,
  reservePrintWindow,
  serializePdf,
  streamObject,
  truncateText,
  wrapText,
} from "./pdf";

export type Avery5163Label = {
  packageIdentifier: string;
  productName: string;
  preparationSummary: string;
  netWeightDisplay?: string | null;
  freshEquivalentDisplay?: string | null;
  freshEquivalentGrams: string | null;
  finishedProductWeightGrams: string | null;
  packageType: string;
  batchLine: string;
  oxygenAbsorber: string | null;
  packagedAt: string;
};

export function toAvery5163Label(item: {
  label: PackageLabel;
  recordedPackage: Package;
}): Avery5163Label {
  const { label, recordedPackage } = item;
  return {
    packageIdentifier: recordedPackage.package_identifier,
    productName: label.display_name,
    preparationSummary:
      label.ingredients_summary ||
      label.preparation_summary ||
      label.description ||
      "No ingredients or preparation summary",
    netWeightDisplay: label.net_weight_display,
    freshEquivalentDisplay: label.fresh_equivalent_display,
    freshEquivalentGrams: null,
    finishedProductWeightGrams:
      recordedPackage.finished_product_weight_grams === null
        ? null
        : String(recordedPackage.finished_product_weight_grams),
    packageType:
      recordedPackage.package_type?.name ?? "Package Type unavailable",
    batchLine: "",
    oxygenAbsorber: recordedPackage.oxygen_absorber,
    packagedAt: recordedPackage.packaged_at,
  };
}

export const AVERY_5163_LABELS_PER_SHEET = 10;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LABEL_WIDTH = 288;
const LABEL_HEIGHT = 144;
const LEFT_MARGIN = 13.5;
const TOP_MARGIN = 36;
const COLUMN_GAP = 9;

export type Avery5163PrintOutput = {
  close: () => void;
  load: (labels: Avery5163Label[]) => boolean;
};

export function reserveAvery5163PrintOutput(): Avery5163PrintOutput | null {
  const pdfWindow = reservePrintWindow(
    "Preparing Avery 5163 output",
    "Freezeflow is recording the Print Events and preparing Avery 5163 output…",
  );
  if (!pdfWindow) return null;

  return {
    close: () => {
      try {
        if (!pdfWindow.closed) pdfWindow.close();
      } catch {
        // The output window may have been closed or navigated by the browser.
      }
    },
    load: (labels) => loadPdfIntoWindow(pdfWindow, buildPdf(labels)),
  };
}

export function printAvery5163Labels(labels: Avery5163Label[]) {
  const output = reserveAvery5163PrintOutput();
  if (!output) return false;

  const loaded = output.load(labels);
  if (!loaded) output.close();
  return loaded;
}

function buildPdf(labels: Avery5163Label[]) {
  const pages = paginateAvery5163Items(labels);
  if (pages.length === 0) pages.push([]);
  const pageContentObjects = pages.map(renderPageContent);
  const pageReferences = pages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`,
  ];

  pages.forEach((_, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(streamObject(pageContentObjects[index]));
  });

  return serializePdf(objects);
}

function renderPageContent(labels: Avery5163Label[]) {
  return labels.map(renderLabel).join("\n");
}

function renderLabel(label: Avery5163Label, index: number) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const labelLeft = LEFT_MARGIN + column * (LABEL_WIDTH + COLUMN_GAP);
  const labelTop = TOP_MARGIN + row * LABEL_HEIGHT;
  const textX = labelLeft + 13;
  const productLines = wrapText(label.productName, 31, 1);
  const preparationLines = wrapText(label.preparationSummary, 48, 2);
  const equivalence = freshEquivalentLine(label);
  const detailLines = [
    `${label.packageType} · ${formatPackagingDate(label.packagedAt)}`,
    label.batchLine,
    `Oxygen absorber: ${label.oxygenAbsorber ?? "None"}`,
  ].filter((line): line is string => Boolean(line));

  return [
    pdfText(
      textX,
      yFromTop(labelTop + 20),
      label.packageIdentifier.toUpperCase(),
      {
        font: "F2",
        size: 8,
        color: "0.28 0.33 0.41",
      },
    ),
    ...productLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 38 + lineIndex * 15), line, {
        font: "F2",
        size: 14,
        color: "0.01 0.02 0.09",
      }),
    ),
    pdfText(textX, yFromTop(labelTop + 56), equivalence, {
      font: "F2",
      size: 10,
      color: "0.01 0.02 0.09",
    }),
    ...preparationLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 72 + lineIndex * 10), line, {
        font: "F1",
        size: 7,
        color: "0.20 0.25 0.33",
      }),
    ),
    ...detailLines.map((line, lineIndex) =>
      pdfText(
        textX,
        yFromTop(labelTop + 98 + lineIndex * 11),
        truncateText(line, 48),
        {
          font: "F1",
          size: 8,
          color: "0.20 0.25 0.33",
        },
      ),
    ),
  ].join("\n");
}

function freshEquivalentLine(label: Avery5163Label) {
  if (label.netWeightDisplay || label.freshEquivalentDisplay) {
    return [
      label.freshEquivalentDisplay
        ? `${label.freshEquivalentDisplay} fresh`
        : "Fresh equivalent unavailable",
      label.netWeightDisplay ?? "Freeze-dried weight unavailable",
    ].join(" = ");
  }
  if (
    label.freshEquivalentGrams === null ||
    label.finishedProductWeightGrams === null
  ) {
    return "Fresh equivalent unavailable";
  }
  return `${formatConvertedWeight(label.freshEquivalentGrams, 453.59237)} lb fresh = ${formatConvertedWeight(label.finishedProductWeightGrams, 28.349523125)} oz freeze-dried`;
}

function formatConvertedWeight(value: string, gramsPerUnit: number) {
  return (Number(value) / gramsPerUnit).toFixed(2).replace(/\.?0+$/, "");
}

function formatPackagingDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function yFromTop(y: number) {
  return PAGE_HEIGHT - y;
}

export function paginateAvery5163Items<Item>(items: Item[]) {
  return paginateItems(items, AVERY_5163_LABELS_PER_SHEET);
}

import type { Package, StorageLocation } from "../api/client";
import { formatGrams } from "./weights";
import {
  formatNumber,
  loadPdfIntoWindow,
  paginateItems,
  pdfText,
  reservePrintWindow,
  serializePdf,
  streamObject,
  wrapText,
} from "./pdf";

export type BinContentsEntry = {
  productName: string;
  weightGrams: string | null;
  packagedAt: string;
};

export type BinContents = {
  storageLocationName: string;
  entries: BinContentsEntry[];
};

export function toBinContents(
  location: StorageLocation,
  packages: Package[],
): BinContents {
  const entries = packages
    .map((item) => ({
      productName: item.label.display_name,
      weightGrams:
        item.finished_product_weight_grams === null
          ? null
          : String(item.finished_product_weight_grams),
      packagedAt: item.packaged_at,
    }))
    .sort((a, b) => {
      const nameCompare = a.productName.localeCompare(b.productName);
      return nameCompare !== 0
        ? nameCompare
        : a.packagedAt.localeCompare(b.packagedAt);
    });
  return { storageLocationName: location.name, entries };
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 54;
const TITLE_Y = 60;
const COUNT_Y = 88;
const PRINTED_Y = 104;
const COLUMN_HEADER_Y = 134;
const RULE_Y = 140;
const ROWS_START_Y = 158;
const ROW_HEIGHT = 34;
const BOTTOM_MARGIN = 40;
const ROWS_PER_PAGE = Math.floor(
  (PAGE_HEIGHT - ROWS_START_Y - BOTTOM_MARGIN) / ROW_HEIGHT,
);
const PRODUCT_X = MARGIN_LEFT;
const WEIGHT_X = 380;
const PACKAGED_X = 460;
const PRODUCT_MAX_CHARS = 50;

const TITLE_COLOR = "0.01 0.02 0.09";
const TEXT_COLOR = "0.06 0.09 0.16";
const MUTED_COLOR = "0.39 0.45 0.55";
const RULE_COLOR = "0.85 0.88 0.92";

export type BinContentsPrintOutput = {
  close: () => void;
  load: (bins: BinContents[]) => boolean;
};

export function reserveBinContentsPrintOutput(): BinContentsPrintOutput | null {
  const pdfWindow = reservePrintWindow(
    "Preparing Bin Contents printout",
    "Freezeflow is preparing the Bin Contents printout…",
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
    load: (bins) => loadPdfIntoWindow(pdfWindow, buildPdf(bins)),
  };
}

export function printBinContents(bins: BinContents[]) {
  const output = reserveBinContentsPrintOutput();
  if (!output) return false;

  const loaded = output.load(bins);
  if (!loaded) output.close();
  return loaded;
}

type RenderedPage = {
  bin: BinContents;
  pageEntries: BinContentsEntry[];
  pageNumber: number;
  totalPages: number;
};

function buildPdf(bins: BinContents[]) {
  const printedAt = new Date();
  const allPages: RenderedPage[] = bins.flatMap((bin) => {
    const chunks = paginateItems(bin.entries, ROWS_PER_PAGE);
    const pages = chunks.length === 0 ? [[]] : chunks;
    return pages.map((pageEntries, index) => ({
      bin,
      pageEntries,
      pageNumber: index + 1,
      totalPages: pages.length,
    }));
  });
  if (allPages.length === 0) {
    allPages.push({
      bin: EMPTY_BIN,
      pageEntries: [],
      pageNumber: 1,
      totalPages: 1,
    });
  }

  const pageContentObjects = allPages.map((page) =>
    renderPageContent(page, printedAt),
  );
  const pageReferences = allPages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${allPages.length} >>`,
  ];

  allPages.forEach((_, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(streamObject(pageContentObjects[index]));
  });

  return serializePdf(objects);
}

const EMPTY_BIN: BinContents = { storageLocationName: "", entries: [] };

function renderPageContent(page: RenderedPage, printedAt: Date) {
  const { bin, pageEntries, pageNumber, totalPages } = page;
  const titleLine =
    totalPages > 1
      ? `${bin.storageLocationName} - Page ${pageNumber} of ${totalPages}`
      : bin.storageLocationName;
  const packageCount = bin.entries.length;

  return [
    pdfText(MARGIN_LEFT, yFromTop(TITLE_Y), titleLine, {
      font: "F2",
      size: 24,
      color: TITLE_COLOR,
    }),
    pdfText(
      MARGIN_LEFT,
      yFromTop(COUNT_Y),
      `${packageCount} Package${packageCount === 1 ? "" : "s"}`,
      { font: "F1", size: 11, color: MUTED_COLOR },
    ),
    pdfText(
      MARGIN_LEFT,
      yFromTop(PRINTED_Y),
      `Printed: ${formatPrintedAt(printedAt)}`,
      { font: "F1", size: 10, color: MUTED_COLOR },
    ),
    pdfText(PRODUCT_X, yFromTop(COLUMN_HEADER_Y), "PRODUCT", {
      font: "F2",
      size: 9,
      color: MUTED_COLOR,
    }),
    pdfText(WEIGHT_X, yFromTop(COLUMN_HEADER_Y), "WEIGHT", {
      font: "F2",
      size: 9,
      color: MUTED_COLOR,
    }),
    pdfText(PACKAGED_X, yFromTop(COLUMN_HEADER_Y), "PACKAGED", {
      font: "F2",
      size: 9,
      color: MUTED_COLOR,
    }),
    pdfLine(
      MARGIN_LEFT,
      yFromTop(RULE_Y),
      PAGE_WIDTH - MARGIN_LEFT,
      yFromTop(RULE_Y),
      RULE_COLOR,
    ),
    ...pageEntries.flatMap((entry, index) => renderRow(entry, index)),
  ].join("\n");
}

function renderRow(entry: BinContentsEntry, index: number) {
  const rowTop = ROWS_START_Y + index * ROW_HEIGHT;
  const nameLines = wrapText(entry.productName, PRODUCT_MAX_CHARS, 2);

  return [
    ...nameLines.map((line, lineIndex) =>
      pdfText(PRODUCT_X, yFromTop(rowTop + lineIndex * 13), line, {
        font: "F1",
        size: 11,
        color: TEXT_COLOR,
      }),
    ),
    pdfText(WEIGHT_X, yFromTop(rowTop), formatGrams(entry.weightGrams), {
      font: "F1",
      size: 11,
      color: TEXT_COLOR,
    }),
    pdfText(
      PACKAGED_X,
      yFromTop(rowTop),
      formatPackagedDate(entry.packagedAt),
      { font: "F1", size: 11, color: TEXT_COLOR },
    ),
  ];
}

function yFromTop(y: number) {
  return PAGE_HEIGHT - y;
}

function pdfLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
) {
  return `${color} RG 0.5 w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`;
}

function formatPackagedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPrintedAt(date: Date) {
  const datePart = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} - ${timePart}`;
}

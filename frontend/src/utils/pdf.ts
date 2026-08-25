export function reservePrintWindow(
  title: string,
  message: string,
): Window | null {
  const pdfWindow = window.open("", "_blank", "height=900,width=900");
  if (!pdfWindow) return null;

  try {
    pdfWindow.document.title = title;
    pdfWindow.document.body.replaceChildren();
    const status = pdfWindow.document.createElement("p");
    status.textContent = message;
    status.style.cssText =
      "font: 16px system-ui, sans-serif; margin: 2rem; color: #334155;";
    pdfWindow.document.body.append(status);
  } catch {
    // A browser may restrict access to the reserved window before navigation.
  }

  return pdfWindow;
}

export function loadPdfIntoWindow(pdfWindow: Window, pdfBytes: string) {
  if (pdfWindow.closed) return false;

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    pdfWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}

export function paginateItems<Item>(items: Item[], itemsPerPage: number) {
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += itemsPerPage) {
    chunks.push(items.slice(index, index + itemsPerPage));
  }
  return chunks;
}

export function pdfText(
  x: number,
  y: number,
  text: string,
  options: { font: string; size: number; color: string },
) {
  return `BT ${options.color} rg /${options.font} ${options.size} Tf 1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm (${escapePdfText(text)}) Tj ET`;
}

export function streamObject(content: string) {
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
}

export function serializePdf(objects: string[]) {
  const lines = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteOffset = lines[0].length;

  objects.forEach((object, index) => {
    const objectNumber = index + 1;
    const serialized = `${objectNumber} 0 obj\n${object}\nendobj\n`;
    offsets.push(byteOffset);
    lines.push(serialized);
    byteOffset += serialized.length;
  });

  const xrefOffset = byteOffset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");

  return `${lines.join("")}${xref}`;
}

export function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, " ");
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function truncateText(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

export function wrapText(value: string, maxLength: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine === "" ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxLength) {
      currentLine = candidate;
      continue;
    }
    if (currentLine !== "") {
      lines.push(currentLine);
    }
    currentLine = word;
    if (lines.length === maxLines) break;
  }

  if (currentLine !== "" && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [truncateText(value, maxLength)];
  }

  if (words.join(" ").length > lines.join(" ").length) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = truncateText(lastLine, maxLength);
  }

  return lines;
}

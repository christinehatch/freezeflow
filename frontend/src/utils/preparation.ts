import type { Tray } from "../api/client";

/**
 * Mirrors the backend's tray_preparation_summary(): prefer the structured
 * ingredients/preparation_methods fields, falling back to the legacy
 * freeform `preparation` string only for pre-Milestone-6 Trays that never
 * had structured data recorded.
 */
export function trayPreparationSummary(
  tray: Pick<Tray, "ingredients" | "preparation_methods" | "preparation">,
): string | null {
  const parts = [
    ...(tray.ingredients ?? []),
    ...(tray.preparation_methods ?? []),
  ];
  if (parts.length > 0) return parts.join(", ");
  return tray.preparation;
}

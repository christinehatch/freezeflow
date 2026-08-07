import type { PackagingOperation } from "../api/client";

export type PackagingStageId =
  | "source"
  | "product"
  | "packages"
  | "review"
  | "finish";

const STAGE_ORDER: PackagingStageId[] = [
  "source",
  "product",
  "packages",
  "review",
  "finish",
];

export function getCurrentPackagingStage(
  operation: PackagingOperation | null,
): PackagingStageId {
  if (!operation) return "source";
  if (operation.status === "Completed") return "finish";
  if (operation.allocations.length === 0) return "product";

  const packageWorkIncomplete = operation.allocations.some((allocation) => {
    const remaining = Number(allocation.remaining_weight_grams);
    return (
      !Number.isFinite(remaining) ||
      Math.abs(remaining) > 0.001 ||
      allocation.packages.length === 0 ||
      allocation.planned_packages.some(
        (plannedPackage) => plannedPackage.recorded_package_id === null,
      )
    );
  });
  if (packageWorkIncomplete) return "packages";

  const labelsNeedReview = operation.packages.some(
    (recordedPackage) =>
      !recordedPackage.label || recordedPackage.label.status === "Draft",
  );
  return labelsNeedReview ? "review" : "finish";
}

export function getPackagingStagePosition(stage: PackagingStageId) {
  return STAGE_ORDER.indexOf(stage);
}

type DescriptionRule = {
  method: string;
  pattern: RegExp;
  label: string;
};

// Coarse, hand-written {method + path pattern} -> plain-English label
// table. Deliberately not exhaustive or self-generating from the path
// alone (a generic update like `PATCH /trays/:id` can't say *what*
// changed) - see ADR-0020. GET requests are never logged here; they're
// just data loading, already covered by the page-navigation log.
const RULES: DescriptionRule[] = [
  {
    method: "POST",
    pattern: /^\/production-batches$/,
    label: "Created a Production Batch",
  },
  {
    method: "PATCH",
    pattern: /^\/production-batches\/[^/]+$/,
    label: "Updated a Production Batch",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/start$/,
    label: "Started a Production Batch",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/complete$/,
    label: "Completed a Production Batch",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/cancel$/,
    label: "Cancelled a Production Batch",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/drying-runs$/,
    label: "Started a Drying Run",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/trays$/,
    label: "Added a Tray",
  },
  {
    method: "POST",
    pattern: /^\/production-batches\/[^/]+\/packaging-operation$/,
    label: "Started Packaging",
  },
  {
    method: "POST",
    pattern: /^\/drying-runs\/[^/]+\/complete$/,
    label: "Completed a Drying Run",
  },
  {
    method: "POST",
    pattern: /^\/drying-runs\/[^/]+\/void$/,
    label: "Voided a Drying Run",
  },
  { method: "PATCH", pattern: /^\/trays\/[^/]+$/, label: "Updated a Tray" },
  { method: "DELETE", pattern: /^\/trays\/[^/]+$/, label: "Deleted a Tray" },
  {
    method: "POST",
    pattern: /^\/trays\/[^/]+\/starting-weight$/,
    label: "Recorded a Starting Weight",
  },
  {
    method: "POST",
    pattern: /^\/trays\/[^/]+\/weight-checks$/,
    label: "Recorded a Weight Check",
  },
  {
    method: "POST",
    pattern: /^\/trays\/[^/]+\/complete$/,
    label: "Completed a Tray",
  },
  {
    method: "POST",
    pattern: /^\/weight-checks\/[^/]+\/correct$/,
    label: "Corrected a Weight Check",
  },
  {
    method: "POST",
    pattern: /^\/freeze-dryers$/,
    label: "Created a Freeze Dryer",
  },
  {
    method: "PATCH",
    pattern: /^\/freeze-dryers\/[^/]+$/,
    label: "Updated a Freeze Dryer",
  },
  {
    method: "POST",
    pattern: /^\/physical-trays$/,
    label: "Created a Physical Tray",
  },
  {
    method: "PATCH",
    pattern: /^\/physical-trays\/[^/]+$/,
    label: "Updated a Physical Tray",
  },
  {
    method: "POST",
    pattern: /^\/packaging-operations\/[^/]+\/allocate-trays$/,
    label: "Allocated Trays for Packaging",
  },
  {
    method: "PATCH",
    pattern: /^\/packaging-operations\/[^/]+\/allocations\/[^/]+$/,
    label: "Updated a Packaging Allocation",
  },
  {
    method: "POST",
    pattern: /^\/packaging-operations\/[^/]+\/allocations\/[^/]+\/packages$/,
    label: "Recorded Packages",
  },
  {
    method: "POST",
    pattern: /^\/packaging-operations\/[^/]+\/allocations\/[^/]+\/losses$/,
    label: "Recorded a Packaging Loss",
  },
  {
    method: "POST",
    pattern: /^\/packaging-operations\/[^/]+\/complete$/,
    label: "Completed Packaging",
  },
  {
    method: "PATCH",
    pattern: /^\/packages\/[^/]+\/label$/,
    label: "Updated a Package Label",
  },
  {
    method: "POST",
    pattern: /^\/package-labels\/preview$/,
    label: "Previewed Package Labels",
  },
  {
    method: "POST",
    pattern: /^\/package-labels\/print$/,
    label: "Printed Package Labels",
  },
  {
    method: "POST",
    pattern: /^\/packages\/[^/]+\/move$/,
    label: "Moved a Package",
  },
  {
    method: "POST",
    pattern: /^\/packages\/[^/]+\/give-away$/,
    label: "Gave Away a Package",
  },
  {
    method: "POST",
    pattern: /^\/packages\/[^/]+\/deplete$/,
    label: "Depleted a Package",
  },
  {
    method: "POST",
    pattern: /^\/package-types$/,
    label: "Created a Package Type",
  },
  {
    method: "PATCH",
    pattern: /^\/package-types\/[^/]+$/,
    label: "Updated a Package Type",
  },
  {
    method: "POST",
    pattern: /^\/storage-locations$/,
    label: "Created a Storage Location",
  },
  {
    method: "PATCH",
    pattern: /^\/storage-locations\/[^/]+$/,
    label: "Updated a Storage Location",
  },
  {
    method: "POST",
    pattern: /^\/storage-locations\/[^/]+\/archive$/,
    label: "Archived a Storage Location",
  },
  {
    method: "POST",
    pattern: /^\/storage-locations\/[^/]+\/restore$/,
    label: "Restored a Storage Location",
  },
  {
    method: "POST",
    pattern: /^\/preparation-presets$/,
    label: "Created a Preparation Preset",
  },
  {
    method: "PATCH",
    pattern: /^\/preparation-presets\/[^/]+$/,
    label: "Updated a Preparation Preset",
  },
  {
    method: "POST",
    pattern: /^\/preparation-presets\/[^/]+\/archive$/,
    label: "Archived a Preparation Preset",
  },
  {
    method: "POST",
    pattern: /^\/preparation-presets\/[^/]+\/restore$/,
    label: "Restored a Preparation Preset",
  },
];

export function describeApiCall(method: string, path: string): string {
  const upperMethod = method.toUpperCase();
  const rule = RULES.find(
    (candidate) =>
      candidate.method === upperMethod && candidate.pattern.test(path),
  );
  return rule ? rule.label : `${upperMethod} ${path}`;
}

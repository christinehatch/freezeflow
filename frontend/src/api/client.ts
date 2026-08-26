import { describeApiCall } from "../utils/actionDescriptions";
import { logAction } from "../utils/actionLog";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
};

export type FreezeDryer = {
  id: string;
  name: string;
  notes: string | null;
  archived: boolean;
  tray_slot_count: number;
  tray_slots: TraySlot[];
};

export type TraySlot = {
  id: string;
  freeze_dryer_id: string;
  slot_number: number;
  label: string | null;
  archived: boolean;
};

export type PhysicalTray = {
  id: string;
  label: string;
  tare_weight_grams: string | null;
  notes: string | null;
  archived: boolean;
};

export type WeightCheck = {
  id: string;
  tray_id: string;
  drying_run_id: string;
  weight_grams: string;
  observed_at: string;
  recorded_at: string;
  notes: string | null;
};

export type Tray = {
  id: string;
  production_batch_id: string;
  tray_slot_id: string;
  tray_slot: TraySlot;
  physical_tray_id: string;
  physical_tray: PhysicalTray;
  preparation_preset_id: string | null;
  preparation_preset_name: string | null;
  product_name: string;
  ingredients: string[] | null;
  preparation_methods: string[] | null;
  /** Legacy freeform fallback, only populated on pre-Milestone-6 Trays. */
  preparation: string | null;
  starting_weight_grams: string | null;
  final_dry_weight_grams: string | null;
  completed_at: string | null;
  notes: string | null;
  status: "Draft" | "Running" | "Completed" | "Packaged" | "Cancelled";
  weight_checks: WeightCheck[];
  latest_weight_grams: string | null;
  previous_weight_grams: string | null;
  packaging: TrayPackaging | null;
};

export type TrayPackaging = {
  packaging_operation_id: string;
  packaging_allocation_id: string;
  packaging_operation_status: PackagingOperationStatus;
  started_at: string;
  completed_at: string | null;
  batch_number: string;
  freeze_dryer: string;
  packages: TrayPackageSummary[];
};

export type TrayPackageSummary = {
  id: string;
  package_identifier: string;
  package_type: string;
  package_weight_grams: string;
  finished_product_weight_grams: string | null;
  oxygen_absorber: string | null;
  storage_location: string;
  status: "In Storage" | "Given Away" | "Depleted";
  notes: string | null;
};

export type DryingRun = {
  id: string;
  production_batch_id: string;
  status: "Active" | "Complete" | "Voided";
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
};

export type ProductionBatch = {
  id: string;
  freeze_dryer_id: string;
  freeze_dryer: FreezeDryer;
  batch_number: string;
  status: "Draft" | "Running" | "Completed" | "Cancelled";
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  trays: Tray[];
  drying_runs: DryingRun[];
  total_drying_seconds: number;
};

export type PackageType = {
  id: string;
  name: string;
  default_oxygen_absorber: string | null;
  default_label_template: string | null;
  notes: string | null;
  archived: boolean;
};

export type StorageLocation = {
  id: string;
  name: string;
  notes: string | null;
  archived: boolean;
};

export type PreparationPreset = {
  id: string;
  name: string;
  product_name: string;
  ingredients: string[] | null;
  preparation_methods: string[] | null;
  notes: string | null;
  archived: boolean;
};

export type ProductGroup = {
  product_name: string;
  available_package_count: number;
  storage_locations: string[];
  oldest_packaged_at: string;
  newest_packaged_at: string;
};

export type Package = {
  id: string;
  packaging_allocation_id: string;
  packaging_operation_id: string;
  package_type_id: string;
  package_type: PackageType;
  package_identifier: string;
  packaged_at: string;
  package_weight_grams: DecimalValue;
  finished_product_weight_grams: DecimalValue | null;
  oxygen_absorber: string | null;
  storage_location_id: string;
  storage_location: StorageLocation;
  status: "In Storage" | "Given Away" | "Depleted";
  notes: string | null;
  label: PackageLabel;
};

export type StorageLocationHistoryEntry = {
  id: string;
  package_id: string;
  previous_storage_location_id: string | null;
  current_storage_location_id: string;
  moved_at: string;
  notes: string | null;
};

export type PackageStatusHistoryEntry = {
  id: string;
  package_id: string;
  previous_status: "In Storage" | "Given Away" | "Depleted" | null;
  current_status: "In Storage" | "Given Away" | "Depleted";
  effective_at: string;
  recorded_at: string;
  notes: string | null;
};

export type PackageEligibleForPrint = Package & {
  production_batch_id: string;
  batch_number: string;
};

export type PackagingOperationStatus = "Open" | "Completed";
export type PackageLabelStatus = "Draft" | "Ready" | "Needs Reprint";

export type PackagingOperation = {
  id: string;
  production_batch_id: string;
  status: PackagingOperationStatus;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  allocations: PackagingAllocation[];
  packages: Package[];
};

export type PackagingAllocationSourceTray = {
  id: string;
  production_batch_id: string;
  tray_slot_id: string;
  slot_number: number;
  physical_tray_id: string;
  physical_tray_label: string;
  product_name: string;
  preparation: string | null;
  final_dry_weight_grams: DecimalValue;
  notes: string | null;
  status: Tray["status"];
};

export type PlannedPackageRow = {
  id: string;
  packaging_allocation_id: string;
  package_type_id: string | null;
  finished_product_weight_grams: DecimalValue | null;
  finished_product_weight_unit: string | null;
  sealed_package_weight_grams: DecimalValue | null;
  sealed_package_weight_unit: string | null;
  oxygen_absorber: string | null;
  storage_location_id: string | null;
  notes: string | null;
  label_status: PackageLabelStatus;
  label_display_name: string | null;
  label_description: string | null;
  label_ingredients_summary: string | null;
  label_preparation_summary: string | null;
  label_rehydration_instructions: string | null;
  label_serving_notes: string | null;
  label_net_weight_display: string | null;
  label_fresh_equivalent_display: string | null;
  recorded_package_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PackagingLossReason = "Sampled" | "Spilled" | "Crumbs" | "Other";

export type PackagingLoss = {
  id: string;
  packaging_allocation_id: string;
  weight_grams: DecimalValue;
  reason: PackagingLossReason;
  reason_detail: string | null;
  recorded_at: string;
};

export type PackagingAllocation = {
  id: string;
  packaging_operation_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  selected_weight_grams: DecimalValue;
  allocated_weight_grams: DecimalValue;
  total_recorded_loss_weight_grams: DecimalValue;
  remaining_weight_grams: DecimalValue;
  bagged_weight_grams: DecimalValue;
  remaining_to_bag_grams: DecimalValue;
  source_trays: PackagingAllocationSourceTray[];
  planned_packages: PlannedPackageRow[];
  packages: Package[];
  packaging_losses: PackagingLoss[];
};

export type PackagingWorksheetItem = {
  production_batch: ProductionBatch;
  eligible_trays: Tray[];
  source_weight_grams: string;
};

export type PrintEvent = {
  id: string;
  package_label_id: string;
  printed_at: string;
  recorded_at: string;
  template: string;
  print_job_id: string;
  notes: string | null;
};

export type PackageLabel = {
  id: string;
  package_id: string;
  status: PackageLabelStatus;
  display_name: string;
  description: string | null;
  ingredients_summary: string | null;
  preparation_summary: string | null;
  rehydration_instructions: string | null;
  serving_notes: string | null;
  net_weight_display: string | null;
  fresh_equivalent_display: string | null;
  created_at: string;
  updated_at: string;
  print_events: PrintEvent[];
};

/** Temporary printable view used by the pre-Phase-3B screens. */
export type PrintablePackageLabel = {
  package_id: string;
  package_identifier: string;
  batch_number: string;
  freeze_dryer: string;
  product_summary: string;
  package_type: string;
  finished_product_weight_grams: string | null;
  package_weight_grams: string;
  fresh_equivalent_grams: string | null;
  preparation_summary: string;
  oxygen_absorber: string | null;
  packaged_at: string;
  label_template: string | null;
  storage_location: string;
  notes: string | null;
};

export type PackagingResult = {
  packaging_operation: PackagingOperation;
  packages: Package[];
  warnings: string[];
  source_weight_grams: string;
  package_weight_grams: string;
  labels: PrintablePackageLabel[];
};

export type PackagingOperationStart = {
  started_at?: string | null;
  notes?: string | null;
};

export type PackagingOperationComplete = {
  completed_at?: string | null;
};

export type PackagingAllocationCreateRequest = {
  tray_ids: string[];
  notes?: string | null;
};

export type PlannedPackageInput = {
  id?: string;
  package_type_id?: string | null;
  finished_product_weight_grams?: DecimalValue | null;
  finished_product_weight_unit?: string | null;
  sealed_package_weight_grams?: DecimalValue | null;
  sealed_package_weight_unit?: string | null;
  oxygen_absorber?: string | null;
  storage_location_id?: string | null;
  notes?: string | null;
  label_display_name?: string | null;
  label_description?: string | null;
  label_ingredients_summary?: string | null;
  label_preparation_summary?: string | null;
  label_rehydration_instructions?: string | null;
  label_serving_notes?: string | null;
  label_net_weight_display?: string | null;
};

export type PackagingAllocationUpdateRequest = {
  tray_ids?: string[];
  notes?: string | null;
  planned_packages?: PlannedPackageInput[];
};

export type PackageLabelValues = {
  display_name?: string | null;
  description?: string | null;
  ingredients_summary?: string | null;
  preparation_summary?: string | null;
  rehydration_instructions?: string | null;
  serving_notes?: string | null;
  net_weight_display?: string | null;
};

export type PackageLineCreate = {
  planned_package_row_id?: string | null;
  package_type_id?: string | null;
  finished_product_weight_grams?: DecimalValue | null;
  sealed_package_weight_grams?: DecimalValue | null;
  oxygen_absorber?: string | null;
  storage_location_id?: string | null;
  packaged_at?: string | null;
  notes?: string | null;
  label?: PackageLabelValues | null;
};

export type RecordAllocationPackagesRequest = {
  packages: PackageLineCreate[];
};

export type RecordPackagingLossRequest = {
  weight_grams: DecimalValue;
  reason: PackagingLossReason;
  reason_detail?: string | null;
};

export type RecordPackagingLossResponse = {
  packaging_loss: PackagingLoss;
  packaging_operation: PackagingOperation;
};

export type RecordAllocationPackagesResponse = {
  packages: Package[];
  packaging_operation: PackagingOperation;
};

export type PackageLabelUpdate = PackageLabelValues & {
  status?: PackageLabelStatus;
};

export type PackageLabelSelection = {
  package_label_ids: string[];
  template?: string;
  printed_at?: string | null;
  notes?: string | null;
};

export type PackageLabelPrintResult = {
  print_job_id: string;
  labels: PackageLabel[];
};

export type LegacyPackageTraysRequest = {
  production_batch_id: string;
  tray_ids: string[];
  packages: {
    package_type_id: string;
    finished_product_weight_grams: string;
    package_weight_grams: string;
    oxygen_absorber?: string | null;
    storage_location_id?: string | null;
    notes?: string | null;
  }[];
  packaged_at?: string | null;
  notes?: string | null;
  batch_number?: string;
  freeze_dryer?: string;
  product_summary?: string;
  preparation_summary?: string;
  source_starting_weight_grams?: DecimalValue | null;
};

export type DecimalValue = string | number;

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  freezeDryerId?: string;
  productName?: string;
  preparationPresetId?: string;
  preparationPresetName?: string;
  productionBatchId?: string;
};

export type FreezeDryerPerformanceRow = {
  freeze_dryer_id: string;
  freeze_dryer_name: string;
  completed_production_batch_count: number;
  average_dry_time_seconds: number | null;
  average_weight_loss_percent: DecimalValue | null;
  average_time_to_completion_seconds: number | null;
};

export type ProductHistoryRow = {
  product_name: string;
  times_produced: number;
  average_drying_time_seconds: number | null;
  average_yield_percent: DecimalValue | null;
  last_batch_completed_at: string | null;
};

export type PreparationHistoryRow = {
  preparation_preset_name: string;
  used_preset: boolean;
  times_used: number;
  average_drying_time_seconds: number | null;
  average_yield_percent: DecimalValue | null;
  last_used_completed_at: string | null;
};

export type DryingTimeRow = {
  production_batch_id: string;
  batch_number: string;
  freeze_dryer_name: string;
  completed_at: string;
  total_drying_time_seconds: number;
  drying_run_count: number;
  voided_drying_run_count: number;
};

export type ProductionHistoryRow = {
  production_batch_id: string;
  batch_number: string;
  freeze_dryer_name: string;
  completed_at: string;
  tray_count: number;
  products: string[];
  total_drying_time_seconds: number;
};

export type MostCommonProduct = {
  product_name: string;
  package_count: number;
};

export type InventorySummary = {
  packages_in_storage: number;
  packages_given_away: number;
  packages_depleted: number;
  total_packaged_weight_grams: DecimalValue;
  total_dried_weight_grams: DecimalValue;
  most_common_products: MostCommonProduct[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: unknown;
  readonly body: unknown;

  constructor({
    status,
    code,
    detail,
    body,
    message,
  }: {
    status: number;
    code: string | null;
    detail: unknown;
    body: unknown;
    message: string;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.body = body;
  }
}

export type DevToolResult = {
  action: string;
  message: string;
  counts: Record<string, number>;
};

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = String(init.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error = toApiError(response.status, errorBody, "API request failed");
    if (method !== "GET") {
      logAction(`Failed: ${describeApiCall(method, path)} — ${error.message}`);
    }
    throw error;
  }

  if (method !== "GET") {
    logAction(describeApiCall(method, path));
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

async function devRequest<T>(path: string, body?: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw toApiError(response.status, errorBody, "Developer action failed");
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function toApiError(status: number, body: unknown, fallback: string) {
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : body;
  const message =
    detail && typeof detail === "object" && "message" in detail
      ? String((detail as { message: unknown }).message)
      : typeof detail === "string"
        ? detail
        : fallback;
  const code =
    detail && typeof detail === "object" && "code" in detail
      ? String((detail as { code: unknown }).code)
      : null;
  return new ApiError({ status, code, detail, body, message });
}

export const productionApi = {
  listFreezeDryers: () => apiGet<FreezeDryer[]>("/freeze-dryers"),
  createFreezeDryer: (body: {
    name: string;
    notes?: string | null;
    tray_slot_count: number;
  }) => apiPost<FreezeDryer>("/freeze-dryers", body),
  updateFreezeDryer: (
    id: string,
    body: {
      name?: string;
      notes?: string | null;
      archived?: boolean;
      tray_slot_count?: number;
    },
  ) => apiPatch<FreezeDryer>(`/freeze-dryers/${id}`, body),
  listTraySlots: (freezeDryerId: string) =>
    apiGet<TraySlot[]>(`/freeze-dryers/${freezeDryerId}/tray-slots`),
  listPhysicalTrays: () => apiGet<PhysicalTray[]>("/physical-trays"),
  createPhysicalTray: (body: {
    label: string;
    tare_weight_grams?: string | null;
    notes?: string | null;
  }) => apiPost<PhysicalTray>("/physical-trays", body),
  updatePhysicalTray: (
    id: string,
    body: {
      label?: string;
      tare_weight_grams?: string | null;
      notes?: string | null;
      archived?: boolean;
    },
  ) => apiPatch<PhysicalTray>(`/physical-trays/${id}`, body),
  listProductionBatches: () => apiGet<ProductionBatch[]>("/production-batches"),
  createProductionBatch: (body: {
    freeze_dryer_id: string;
    batch_number: string;
    notes?: string | null;
  }) => apiPost<ProductionBatch>("/production-batches", body),
  getProductionBatch: (id: string) =>
    apiGet<ProductionBatch>(`/production-batches/${id}`),
  updateProductionBatch: (
    id: string,
    body: { freeze_dryer_id?: string; notes?: string | null },
  ) => apiPatch<ProductionBatch>(`/production-batches/${id}`, body),
  startProductionBatch: (id: string) =>
    apiPost<ProductionBatch>(`/production-batches/${id}/start`),
  cancelProductionBatch: (id: string) =>
    apiPost<ProductionBatch>(`/production-batches/${id}/cancel`),
  completeProductionBatch: (id: string) =>
    apiPost<ProductionBatch>(`/production-batches/${id}/complete`),
  startDryingRun: ({
    batchId,
    body,
  }: {
    batchId: string;
    body?: { started_at?: string; notes?: string | null };
  }) => apiPost<DryingRun>(`/production-batches/${batchId}/drying-runs`, body),
  completeDryingRun: ({
    id,
    body,
  }: {
    id: string;
    body?: { ended_at?: string; notes?: string | null };
  }) => apiPost<DryingRun>(`/drying-runs/${id}/complete`, body),
  voidDryingRun: ({ id, body }: { id: string; body: { notes: string } }) =>
    apiPost<DryingRun>(`/drying-runs/${id}/void`, body),
  addTray: ({
    batchId,
    body,
  }: {
    batchId: string;
    body: {
      tray_slot_id: string;
      physical_tray_id: string;
      preparation_preset_id?: string | null;
      product_name?: string | null;
      ingredients?: string[] | null;
      preparation_methods?: string[] | null;
      starting_weight_grams?: string;
      notes?: string | null;
    };
  }) => apiPost<Tray>(`/production-batches/${batchId}/trays`, body),
  getTray: (id: string) => apiGet<Tray>(`/trays/${id}`),
  updateTray: ({
    id,
    body,
  }: {
    id: string;
    body: {
      tray_slot_id?: string;
      physical_tray_id?: string;
      product_name?: string;
      ingredients?: string[] | null;
      preparation_methods?: string[] | null;
      starting_weight_grams?: string;
      notes?: string | null;
    };
  }) => apiPatch<Tray>(`/trays/${id}`, body),
  recordStartingWeight: ({
    id,
    body,
  }: {
    id: string;
    body: { starting_weight_grams: string };
  }) => apiPost<Tray>(`/trays/${id}/starting-weight`, body),
  recordWeightCheck: ({
    id,
    body,
  }: {
    id: string;
    body: {
      drying_run_id: string;
      weight_grams: string;
      observed_at: string;
      notes?: string | null;
    };
  }) => apiPost<WeightCheck>(`/trays/${id}/weight-checks`, body),
  correctWeightCheck: ({
    id,
    body,
  }: {
    id: string;
    body: { weight_grams: string; reason: string | null };
  }) => apiPost<WeightCheck>(`/weight-checks/${id}/correct`, body),
  completeTray: ({
    id,
    body,
  }: {
    id: string;
    body: { final_dry_weight_grams: string };
  }) => apiPost<Tray>(`/trays/${id}/complete`, body),
  deleteTray: (id: string) => apiDelete<Record<string, never>>(`/trays/${id}`),
};

export const packagingApi = {
  getWorksheet: () => apiGet<PackagingWorksheetItem[]>("/packaging/worksheet"),
  getPackagesEligibleForTodaysPrint: () =>
    apiGet<PackageEligibleForPrint[]>("/package-labels/eligible-today"),
  listPackageTypes: () => apiGet<PackageType[]>("/package-types"),
  createPackageType: (body: {
    name: string;
    default_oxygen_absorber?: string | null;
    default_label_template?: string | null;
    notes?: string | null;
  }) => apiPost<PackageType>("/package-types", body),
  updatePackageType: (
    id: string,
    body: {
      name?: string;
      default_oxygen_absorber?: string | null;
      default_label_template?: string | null;
      notes?: string | null;
      archived?: boolean;
    },
  ) => apiPatch<PackageType>(`/package-types/${id}`, body),
  listStorageLocations: () => apiGet<StorageLocation[]>("/storage-locations"),
  startOrResumePackagingOperation: ({
    batchId,
    body,
  }: {
    batchId: string;
    body?: PackagingOperationStart;
  }) =>
    apiPost<PackagingOperation>(
      `/production-batches/${batchId}/packaging-operation`,
      body,
    ),
  getBatchPackagingOperation: (batchId: string) =>
    apiGet<PackagingOperation>(
      `/production-batches/${batchId}/packaging-operation`,
    ),
  getPackagingOperation: (operationId: string) =>
    apiGet<PackagingOperation>(`/packaging-operations/${operationId}`),
  createPackagingAllocation: ({
    operationId,
    body,
  }: {
    operationId: string;
    body: PackagingAllocationCreateRequest;
  }) =>
    apiPost<PackagingAllocation>(
      `/packaging-operations/${operationId}/allocate-trays`,
      body,
    ),
  updatePackagingAllocation: ({
    operationId,
    allocationId,
    body,
  }: {
    operationId: string;
    allocationId: string;
    body: PackagingAllocationUpdateRequest;
  }) =>
    apiPatch<PackagingAllocation>(
      `/packaging-operations/${operationId}/allocations/${allocationId}`,
      body,
    ),
  recordAllocationPackages: ({
    operationId,
    allocationId,
    body,
  }: {
    operationId: string;
    allocationId: string;
    body: RecordAllocationPackagesRequest;
  }) =>
    apiPost<RecordAllocationPackagesResponse>(
      `/packaging-operations/${operationId}/allocations/${allocationId}/packages`,
      body,
    ),
  recordAllocationLoss: ({
    operationId,
    allocationId,
    body,
  }: {
    operationId: string;
    allocationId: string;
    body: RecordPackagingLossRequest;
  }) =>
    apiPost<RecordPackagingLossResponse>(
      `/packaging-operations/${operationId}/allocations/${allocationId}/losses`,
      body,
    ),
  completePackagingOperation: ({
    operationId,
    body,
  }: {
    operationId: string;
    body?: PackagingOperationComplete;
  }) =>
    apiPost<PackagingOperation>(
      `/packaging-operations/${operationId}/complete`,
      body,
    ),
  getPackage: (packageId: string) => apiGet<Package>(`/packages/${packageId}`),
  getPackageLabel: (packageId: string) =>
    apiGet<PackageLabel>(`/packages/${packageId}/label`),
  updatePackageLabel: ({
    packageId,
    body,
  }: {
    packageId: string;
    body: PackageLabelUpdate;
  }) => apiPatch<PackageLabel>(`/packages/${packageId}/label`, body),
  previewPackageLabels: (body: PackageLabelSelection) =>
    apiPost<PackageLabel[]>("/package-labels/preview", body),
  printPackageLabels: (body: PackageLabelSelection) =>
    apiPost<PackageLabelPrintResult>("/package-labels/print", body),

  /** Phase 3A compatibility for the current Packaging page. */
  packageTrays: (body: LegacyPackageTraysRequest) =>
    packageTraysThroughWorkflow(body),
  labelsForPackages: (body: {
    package_ids: string[];
    batch_number?: string;
    freeze_dryer?: string;
    product_summary?: string;
    preparation_summary?: string;
    source_starting_weight_grams?: DecimalValue | null;
  }) => labelsForRecordedPackages(body),
};

export const inventoryApi = {
  listStorageLocations: ({
    includeArchived,
  }: { includeArchived?: boolean } = {}) =>
    apiGet<StorageLocation[]>(
      `/storage-locations${includeArchived ? "?include_archived=true" : ""}`,
    ),
  createStorageLocation: (body: { name: string; notes?: string | null }) =>
    apiPost<StorageLocation>("/storage-locations", body),
  updateStorageLocation: (
    id: string,
    body: { name?: string; notes?: string | null },
  ) => apiPatch<StorageLocation>(`/storage-locations/${id}`, body),
  archiveStorageLocation: (id: string) =>
    apiPost<StorageLocation>(`/storage-locations/${id}/archive`),
  restoreStorageLocation: (id: string) =>
    apiPost<StorageLocation>(`/storage-locations/${id}/restore`),
  listProductGroups: () => apiGet<ProductGroup[]>("/inventory/products"),
  searchInventory: (params: {
    query?: string;
    status?: string;
    storageLocationId?: string;
    productName?: string;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    if (params.query) search.set("query", params.query);
    if (params.status) search.set("status", params.status);
    if (params.storageLocationId) {
      search.set("storage_location_id", params.storageLocationId);
    }
    if (params.productName) search.set("product_name", params.productName);
    search.set("limit", String(params.limit ?? 100));
    return apiGet<Package[]>(`/inventory?${search.toString()}`);
  },
  movePackage: (
    packageId: string,
    body: {
      storage_location_id: string;
      moved_at?: string;
      notes?: string | null;
    },
  ) => apiPost<Package>(`/packages/${packageId}/move`, body),
  giveAwayPackage: (
    packageId: string,
    body: { effective_at?: string; notes?: string | null } = {},
  ) => apiPost<Package>(`/packages/${packageId}/give-away`, body),
  depletePackage: (
    packageId: string,
    body: { effective_at?: string; notes?: string | null } = {},
  ) => apiPost<Package>(`/packages/${packageId}/deplete`, body),
  getPackageStorageHistory: (packageId: string) =>
    apiGet<StorageLocationHistoryEntry[]>(
      `/packages/${packageId}/storage-history`,
    ),
  getPackageStatusHistory: (packageId: string) =>
    apiGet<PackageStatusHistoryEntry[]>(
      `/packages/${packageId}/status-history`,
    ),
};

export const preparationPresetsApi = {
  listPreparationPresets: ({
    includeArchived,
  }: { includeArchived?: boolean } = {}) =>
    apiGet<PreparationPreset[]>(
      `/preparation-presets${includeArchived ? "?include_archived=true" : ""}`,
    ),
  createPreparationPreset: (body: {
    name: string;
    product_name: string;
    ingredients?: string[];
    preparation_methods?: string[];
    notes?: string | null;
  }) => apiPost<PreparationPreset>("/preparation-presets", body),
  getPreparationPreset: (id: string) =>
    apiGet<PreparationPreset>(`/preparation-presets/${id}`),
  updatePreparationPreset: (
    id: string,
    body: {
      name?: string;
      product_name?: string;
      ingredients?: string[];
      preparation_methods?: string[];
      notes?: string | null;
    },
  ) => apiPatch<PreparationPreset>(`/preparation-presets/${id}`, body),
  archivePreparationPreset: (id: string) =>
    apiPost<PreparationPreset>(`/preparation-presets/${id}/archive`),
  restorePreparationPreset: (id: string) =>
    apiPost<PreparationPreset>(`/preparation-presets/${id}/restore`),
  getSuggestions: (field: "ingredients" | "preparation_methods") =>
    apiGet<string[]>(`/preparation-presets/suggestions?field=${field}`),
};

function buildReportQuery(filters: ReportFilters = {}): string {
  const search = new URLSearchParams();
  if (filters.dateFrom) search.set("date_from", filters.dateFrom);
  if (filters.dateTo) search.set("date_to", filters.dateTo);
  if (filters.freezeDryerId)
    search.set("freeze_dryer_id", filters.freezeDryerId);
  if (filters.productName) search.set("product_name", filters.productName);
  if (filters.preparationPresetId) {
    search.set("preparation_preset_id", filters.preparationPresetId);
  }
  if (filters.preparationPresetName) {
    search.set("preparation_preset_name", filters.preparationPresetName);
  }
  if (filters.productionBatchId) {
    search.set("production_batch_id", filters.productionBatchId);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const reportsApi = {
  getFreezeDryerPerformance: (filters?: ReportFilters) =>
    apiGet<FreezeDryerPerformanceRow[]>(
      `/reports/freeze-dryer-performance${buildReportQuery(filters)}`,
    ),
  getProductHistory: (filters?: ReportFilters) =>
    apiGet<ProductHistoryRow[]>(
      `/reports/product-history${buildReportQuery(filters)}`,
    ),
  getPreparationHistory: (filters?: ReportFilters) =>
    apiGet<PreparationHistoryRow[]>(
      `/reports/preparation-history${buildReportQuery(filters)}`,
    ),
  getDryingTime: (filters?: ReportFilters) =>
    apiGet<DryingTimeRow[]>(`/reports/drying-time${buildReportQuery(filters)}`),
  getProductionHistory: (filters?: ReportFilters) =>
    apiGet<ProductionHistoryRow[]>(
      `/reports/production-history${buildReportQuery(filters)}`,
    ),
  getInventorySummary: (filters?: ReportFilters) =>
    apiGet<InventorySummary>(
      `/reports/inventory-summary${buildReportQuery(filters)}`,
    ),
  listProductNames: () => apiGet<string[]>("/reports/product-names"),
};

async function packageTraysThroughWorkflow(
  body: LegacyPackageTraysRequest,
): Promise<PackagingResult> {
  const operation = await packagingApi.startOrResumePackagingOperation({
    batchId: body.production_batch_id,
    body: { notes: body.notes },
  });
  const allocation = await packagingApi.createPackagingAllocation({
    operationId: operation.id,
    body: { tray_ids: body.tray_ids, notes: body.notes },
  });
  const sourceWeight = Number(allocation.selected_weight_grams);
  const startingWeight = Number(body.source_starting_weight_grams ?? 0);
  const recorded = await packagingApi.recordAllocationPackages({
    operationId: operation.id,
    allocationId: allocation.id,
    body: {
      packages: body.packages.map((line) => {
        return {
          package_type_id: line.package_type_id,
          finished_product_weight_grams: line.finished_product_weight_grams,
          sealed_package_weight_grams: line.package_weight_grams,
          oxygen_absorber: line.oxygen_absorber,
          storage_location_id: line.storage_location_id,
          packaged_at: body.packaged_at,
          notes: line.notes,
          label: {
            display_name: body.product_summary,
            preparation_summary: body.preparation_summary,
            net_weight_display: `${line.finished_product_weight_grams} g`,
          },
        };
      }),
    },
  });
  await Promise.all(
    recorded.packages.map((recordedPackage) =>
      packagingApi.updatePackageLabel({
        packageId: recordedPackage.id,
        body: { display_name: recordedPackage.label.display_name },
      }),
    ),
  );
  const completed = await packagingApi.completePackagingOperation({
    operationId: operation.id,
    body: {},
  });
  const labels = recorded.packages.map((item) =>
    toPrintablePackageLabel(item, body, sourceWeight, startingWeight),
  );
  const packageWeight = recorded.packages.reduce(
    (total, item) => total + Number(item.package_weight_grams),
    0,
  );
  return {
    packaging_operation: completed,
    packages: recorded.packages,
    warnings: [],
    source_weight_grams: String(sourceWeight),
    package_weight_grams: String(packageWeight),
    labels,
  };
}

async function labelsForRecordedPackages(body: {
  package_ids: string[];
  batch_number?: string;
  freeze_dryer?: string;
  product_summary?: string;
  preparation_summary?: string;
  source_starting_weight_grams?: DecimalValue | null;
}) {
  const packages = await Promise.all(
    body.package_ids.map((packageId) => packagingApi.getPackage(packageId)),
  );
  const sourceWeight = packages.reduce(
    (total, item) => total + Number(item.finished_product_weight_grams ?? 0),
    0,
  );
  return packages.map((item) =>
    toPrintablePackageLabel(
      item,
      body,
      sourceWeight,
      Number(body.source_starting_weight_grams ?? 0),
    ),
  );
}

function toPrintablePackageLabel(
  item: Package,
  context: {
    batch_number?: string;
    freeze_dryer?: string;
    product_summary?: string;
    preparation_summary?: string;
  },
  sourceWeight: number,
  startingWeight: number,
): PrintablePackageLabel {
  const finishedWeight = Number(item.finished_product_weight_grams ?? 0);
  const freshEquivalent =
    sourceWeight > 0 && startingWeight > 0
      ? (finishedWeight / sourceWeight) * startingWeight
      : null;
  return {
    package_id: item.id,
    package_identifier: item.package_identifier,
    batch_number: context.batch_number ?? "",
    freeze_dryer: context.freeze_dryer ?? "",
    product_summary: item.label.display_name || context.product_summary || "",
    preparation_summary:
      item.label.preparation_summary ?? context.preparation_summary ?? "",
    fresh_equivalent_grams:
      freshEquivalent === null ? null : String(freshEquivalent),
    finished_product_weight_grams:
      item.finished_product_weight_grams === null
        ? null
        : String(item.finished_product_weight_grams),
    package_type: item.package_type.name,
    package_weight_grams: String(item.package_weight_grams),
    oxygen_absorber: item.oxygen_absorber,
    packaged_at: item.packaged_at,
    label_template: item.package_type.default_label_template,
    storage_location: item.storage_location.name,
    notes: item.notes,
  };
}

export const developerToolsApi = {
  reset: () => devRequest<DevToolResult>("/dev/reset"),
  seedBasic: () => devRequest<DevToolResult>("/dev/demo/basic"),
  seedBusyProductionDay: () =>
    devRequest<DevToolResult>("/dev/demo/busy-production-day"),
  seedEmpty: () => devRequest<DevToolResult>("/dev/demo/empty"),
  seedInventory: () => devRequest<DevToolResult>("/dev/demo/inventory"),
  seedPackagingFresh: () =>
    devRequest<DevToolResult>("/dev/demo/packaging-fresh"),
  seedPackagingResume: () =>
    devRequest<DevToolResult>("/dev/demo/packaging-resume"),
  seedWeightHistory: () =>
    devRequest<DevToolResult>("/dev/demo/weight-history"),
  seedLargeInventory: () =>
    devRequest<DevToolResult>("/dev/demo/large-inventory"),
  createRandomBatches: (count = 100) =>
    devRequest<DevToolResult>("/dev/demo/random-batches", { count }),
  seedEdgeCases: () => devRequest<DevToolResult>("/dev/demo/edge-cases"),
  randomizeDates: () => devRequest<DevToolResult>("/dev/randomize/dates"),
  randomizeWeights: () => devRequest<DevToolResult>("/dev/randomize/weights"),
};

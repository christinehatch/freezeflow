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
  recipe_id: string | null;
  recipe_name: string | null;
  product_name: string;
  preparation: string;
  starting_weight_grams: string | null;
  final_dry_weight_grams: string | null;
  completed_at: string | null;
  notes: string | null;
  status: "Draft" | "Running" | "Completed" | "Packaged" | "Cancelled";
  weight_checks: WeightCheck[];
  latest_weight_grams: string | null;
  previous_weight_grams: string | null;
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

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.detail?.message ?? errorBody?.detail ?? "API request failed";
    throw new Error(message);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
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
  }) =>
    apiPost<PhysicalTray>("/physical-trays", body),
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
      product_name?: string | null;
      preparation?: string | null;
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
      preparation?: string;
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
  completeTray: ({
    id,
    body,
  }: {
    id: string;
    body: { final_dry_weight_grams: string };
  }) => apiPost<Tray>(`/trays/${id}/complete`, body),
  deleteTray: (id: string) => apiDelete<Record<string, never>>(`/trays/${id}`),
};

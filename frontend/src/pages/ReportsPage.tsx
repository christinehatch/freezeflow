import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import {
  preparationPresetsApi,
  productionApi,
  reportsApi,
  type DecimalValue,
  type DryingTimeRow,
  type FreezeDryerPerformanceRow,
  type InventorySummary,
  type PreparationHistoryRow,
  type ProductHistoryRow,
  type ProductionHistoryRow,
} from "../api/client";
import {
  Button,
  Field,
  PageHeader,
  Select,
  StatusBanner,
  Surface,
  SummaryPanel,
  TextField,
  type SelectOption,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";
import { formatGrams } from "../utils/weights";

type ReportType =
  | "freeze-dryer-performance"
  | "product-history"
  | "preparation-history"
  | "drying-time"
  | "production-history"
  | "inventory-summary";

const REPORT_OPTIONS: SelectOption[] = [
  { value: "freeze-dryer-performance", label: "Freeze Dryer Performance" },
  { value: "product-history", label: "Product History" },
  { value: "preparation-history", label: "Preparation History" },
  { value: "drying-time", label: "Drying Time" },
  { value: "production-history", label: "Production History" },
  { value: "inventory-summary", label: "Inventory Summary" },
];

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reportType =
    (searchParams.get("report") as ReportType | null) ??
    "freeze-dryer-performance";
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";
  const freezeDryerId = searchParams.get("freeze_dryer_id") ?? "";
  const productName = searchParams.get("product_name") ?? "";
  const preparationPresetId = searchParams.get("preparation_preset_id") ?? "";
  const productionBatchId = searchParams.get("production_batch_id") ?? "";

  const showsFreezeDryer =
    reportType === "freeze-dryer-performance" ||
    reportType === "drying-time" ||
    reportType === "production-history";
  const showsProduct =
    reportType === "product-history" ||
    reportType === "production-history" ||
    reportType === "inventory-summary";
  const showsPreparationPreset =
    reportType === "preparation-history" || reportType === "production-history";
  const showsProductionBatch =
    reportType === "drying-time" || reportType === "production-history";

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    });
  }

  const freezeDryersQuery = useQuery({
    queryKey: ["freeze-dryers"],
    queryFn: productionApi.listFreezeDryers,
  });
  const preparationPresetsQuery = useQuery({
    queryKey: ["preparation-presets", "including-archived"],
    queryFn: () =>
      preparationPresetsApi.listPreparationPresets({ includeArchived: true }),
  });
  const productionBatchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
  });
  const productNamesQuery = useQuery({
    queryKey: ["report-product-names"],
    queryFn: reportsApi.listProductNames,
  });

  const freezeDryerOptions: SelectOption[] = useMemo(() => {
    const freezeDryers = freezeDryersQuery.data ?? [];
    return [
      { value: "", label: "All Freeze Dryers" },
      ...freezeDryers.map((freezeDryer) => ({
        value: freezeDryer.id,
        label: freezeDryer.archived
          ? `${freezeDryer.name} (archived)`
          : freezeDryer.name,
      })),
    ];
  }, [freezeDryersQuery.data]);

  const productOptions: SelectOption[] = useMemo(() => {
    const names = productNamesQuery.data ?? [];
    return [
      { value: "", label: "All Products" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [productNamesQuery.data]);

  const preparationPresetOptions: SelectOption[] = useMemo(() => {
    const presets = preparationPresetsQuery.data ?? [];
    return [
      { value: "", label: "All Preparation Presets" },
      ...presets.map((preset) => ({
        value: preset.id,
        label: preset.archived ? `${preset.name} (archived)` : preset.name,
      })),
    ];
  }, [preparationPresetsQuery.data]);

  const productionBatchOptions: SelectOption[] = useMemo(() => {
    const batches = productionBatchesQuery.data ?? [];
    return [
      { value: "", label: "All Production Batches" },
      ...batches.map((batch) => ({
        value: batch.id,
        label: batch.batch_number,
      })),
    ];
  }, [productionBatchesQuery.data]);

  const freezeDryerPerformanceQuery = useQuery({
    queryKey: [
      "report-freeze-dryer-performance",
      dateFrom,
      dateTo,
      freezeDryerId,
    ],
    queryFn: () =>
      reportsApi.getFreezeDryerPerformance({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        freezeDryerId: freezeDryerId || undefined,
      }),
    enabled: reportType === "freeze-dryer-performance",
  });

  const productHistoryQuery = useQuery({
    queryKey: ["report-product-history", dateFrom, dateTo, productName],
    queryFn: () =>
      reportsApi.getProductHistory({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        productName: productName || undefined,
      }),
    enabled: reportType === "product-history",
  });

  const preparationHistoryQuery = useQuery({
    queryKey: [
      "report-preparation-history",
      dateFrom,
      dateTo,
      preparationPresetId,
    ],
    queryFn: () =>
      reportsApi.getPreparationHistory({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        preparationPresetId: preparationPresetId || undefined,
      }),
    enabled: reportType === "preparation-history",
  });

  const dryingTimeQuery = useQuery({
    queryKey: [
      "report-drying-time",
      dateFrom,
      dateTo,
      freezeDryerId,
      productionBatchId,
    ],
    queryFn: () =>
      reportsApi.getDryingTime({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        freezeDryerId: freezeDryerId || undefined,
        productionBatchId: productionBatchId || undefined,
      }),
    enabled: reportType === "drying-time",
  });

  const productionHistoryQuery = useQuery({
    queryKey: [
      "report-production-history",
      dateFrom,
      dateTo,
      freezeDryerId,
      productName,
      preparationPresetId,
      productionBatchId,
    ],
    queryFn: () =>
      reportsApi.getProductionHistory({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        freezeDryerId: freezeDryerId || undefined,
        productName: productName || undefined,
        preparationPresetId: preparationPresetId || undefined,
        productionBatchId: productionBatchId || undefined,
      }),
    enabled: reportType === "production-history",
  });

  const inventorySummaryQuery = useQuery({
    queryKey: ["report-inventory-summary", dateFrom, dateTo, productName],
    queryFn: () =>
      reportsApi.getInventorySummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        productName: productName || undefined,
      }),
    enabled: reportType === "inventory-summary",
  });

  return (
    <div className="space-y-4">
      <PageHeader
        description="Learn from completed production history: compare Freeze Dryers, review drying times, and understand production trends."
        eyebrow="Reports"
        title="Reports"
      />

      <Surface>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <Field htmlFor="report-type" label="Report">
            <Select
              id="report-type"
              options={REPORT_OPTIONS}
              value={reportType}
              onChange={(value) =>
                setSearchParams(new URLSearchParams({ report: value }))
              }
            />
          </Field>
          <Field htmlFor="report-date-from" label="Date From">
            <TextField
              id="report-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) =>
                updateParams({ date_from: event.target.value })
              }
            />
          </Field>
          <Field htmlFor="report-date-to" label="Date To">
            <TextField
              id="report-date-to"
              type="date"
              value={dateTo}
              onChange={(event) =>
                updateParams({ date_to: event.target.value })
              }
            />
          </Field>
          {showsFreezeDryer ? (
            <Field htmlFor="report-freeze-dryer" label="Freeze Dryer">
              <Select
                id="report-freeze-dryer"
                options={freezeDryerOptions}
                value={freezeDryerId}
                onChange={(value) => updateParams({ freeze_dryer_id: value })}
              />
            </Field>
          ) : null}
          {showsProduct ? (
            <Field htmlFor="report-product" label="Product">
              <Select
                id="report-product"
                options={productOptions}
                value={productName}
                onChange={(value) => updateParams({ product_name: value })}
              />
            </Field>
          ) : null}
          {showsPreparationPreset ? (
            <Field
              htmlFor="report-preparation-preset"
              label="Preparation Preset"
            >
              <Select
                id="report-preparation-preset"
                options={preparationPresetOptions}
                value={preparationPresetId}
                onChange={(value) =>
                  updateParams({ preparation_preset_id: value })
                }
              />
            </Field>
          ) : null}
          {showsProductionBatch ? (
            <Field htmlFor="report-production-batch" label="Production Batch">
              <Select
                id="report-production-batch"
                options={productionBatchOptions}
                value={productionBatchId}
                onChange={(value) =>
                  updateParams({ production_batch_id: value })
                }
              />
            </Field>
          ) : null}
        </div>
      </Surface>

      {reportType === "freeze-dryer-performance" ? (
        <FreezeDryerPerformanceView
          hasFilters={dateFrom !== "" || dateTo !== "" || freezeDryerId !== ""}
          query={freezeDryerPerformanceQuery}
        />
      ) : reportType === "product-history" ? (
        <ProductHistoryView
          hasFilters={dateFrom !== "" || dateTo !== "" || productName !== ""}
          query={productHistoryQuery}
        />
      ) : reportType === "preparation-history" ? (
        <PreparationHistoryView
          hasFilters={
            dateFrom !== "" || dateTo !== "" || preparationPresetId !== ""
          }
          query={preparationHistoryQuery}
        />
      ) : reportType === "drying-time" ? (
        <DryingTimeView
          hasFilters={
            dateFrom !== "" ||
            dateTo !== "" ||
            freezeDryerId !== "" ||
            productionBatchId !== ""
          }
          query={dryingTimeQuery}
        />
      ) : reportType === "production-history" ? (
        <ProductionHistoryView
          hasFilters={
            dateFrom !== "" ||
            dateTo !== "" ||
            freezeDryerId !== "" ||
            productName !== "" ||
            preparationPresetId !== "" ||
            productionBatchId !== ""
          }
          query={productionHistoryQuery}
        />
      ) : (
        <InventorySummaryView
          hasFilters={dateFrom !== "" || dateTo !== "" || productName !== ""}
          query={inventorySummaryQuery}
        />
      )}
    </div>
  );
}

function ReportStateWrapper<T>({
  children,
  hasFilters,
  query,
}: {
  children: (rows: T[]) => ReactNode;
  hasFilters: boolean;
  query: UseQueryResult<T[]>;
}) {
  if (query.isLoading) {
    return <Surface>Loading Report…</Surface>;
  }
  if (query.isError) {
    return (
      <StatusBanner
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
        body={formatApiError(query.error)}
        title="Report could not be loaded"
        tone="danger"
      />
    );
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <Surface>
        {hasFilters ? (
          <p className="font-semibold">
            No matching production history was found for the selected filters.
          </p>
        ) : (
          <>
            <p className="font-semibold">
              No production history is available yet.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Create Production Batches to begin collecting historical insights.
            </p>
          </>
        )}
      </Surface>
    );
  }
  return <>{children(rows)}</>;
}

function FreezeDryerPerformanceView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<FreezeDryerPerformanceRow[]>;
}) {
  return (
    <ReportStateWrapper hasFilters={hasFilters} query={query}>
      {(rows) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <SummaryPanel
              items={[
                {
                  label: "Average Dry Time",
                  value: formatDuration(row.average_dry_time_seconds),
                },
                {
                  label: "Average Weight Loss",
                  value: formatPercent(row.average_weight_loss_percent),
                },
                {
                  label: "Completed Batches",
                  value: row.completed_production_batch_count,
                  emphasis: true,
                },
                {
                  label: "Average Time to Completion",
                  value: formatDuration(row.average_time_to_completion_seconds),
                },
              ]}
              key={row.freeze_dryer_id}
              title={row.freeze_dryer_name}
            />
          ))}
        </div>
      )}
    </ReportStateWrapper>
  );
}

function ProductHistoryView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<ProductHistoryRow[]>;
}) {
  return (
    <ReportStateWrapper hasFilters={hasFilters} query={query}>
      {(rows) => (
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Times Produced</th>
                <th>Average Drying Time</th>
                <th>Average Yield</th>
                <th>Last Batch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_name}>
                  <td>{row.product_name}</td>
                  <td>{row.times_produced}</td>
                  <td>{formatDuration(row.average_drying_time_seconds)}</td>
                  <td>{formatPercent(row.average_yield_percent)}</td>
                  <td>{formatDate(row.last_batch_completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </ReportStateWrapper>
  );
}

function PreparationHistoryView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<PreparationHistoryRow[]>;
}) {
  return (
    <ReportStateWrapper hasFilters={hasFilters} query={query}>
      {(rows) => (
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Preparation Preset</th>
                <th>Times Used</th>
                <th>Average Drying Time</th>
                <th>Average Yield</th>
                <th>Last Used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.preparation_preset_name}-${row.used_preset}`}>
                  <td>
                    {row.preparation_preset_name}
                    {row.used_preset ? null : (
                      <span className="ml-1 text-sm text-slate-500">
                        (no Preparation Preset used)
                      </span>
                    )}
                  </td>
                  <td>{row.times_used}</td>
                  <td>{formatDuration(row.average_drying_time_seconds)}</td>
                  <td>{formatPercent(row.average_yield_percent)}</td>
                  <td>{formatDate(row.last_used_completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </ReportStateWrapper>
  );
}

function DryingTimeView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<DryingTimeRow[]>;
}) {
  return (
    <ReportStateWrapper hasFilters={hasFilters} query={query}>
      {(rows) => (
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Freeze Dryer</th>
                <th>Completed</th>
                <th>Total Drying Time</th>
                <th>Drying Runs</th>
                <th>Voided Runs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.production_batch_id}>
                  <td>{row.batch_number}</td>
                  <td>{row.freeze_dryer_name}</td>
                  <td>{formatDate(row.completed_at)}</td>
                  <td>{formatDuration(row.total_drying_time_seconds)}</td>
                  <td>{row.drying_run_count}</td>
                  <td>{row.voided_drying_run_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </ReportStateWrapper>
  );
}

function ProductionHistoryView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<ProductionHistoryRow[]>;
}) {
  return (
    <ReportStateWrapper hasFilters={hasFilters} query={query}>
      {(rows) => (
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Freeze Dryer</th>
                <th>Completed</th>
                <th>Trays</th>
                <th>Products</th>
                <th>Total Drying Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.production_batch_id}>
                  <td>{row.batch_number}</td>
                  <td>{row.freeze_dryer_name}</td>
                  <td>{formatDate(row.completed_at)}</td>
                  <td>{row.tray_count}</td>
                  <td>{row.products.join(", ")}</td>
                  <td>{formatDuration(row.total_drying_time_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </ReportStateWrapper>
  );
}

function InventorySummaryView({
  hasFilters,
  query,
}: {
  hasFilters: boolean;
  query: UseQueryResult<InventorySummary>;
}) {
  if (query.isLoading) {
    return <Surface>Loading Report…</Surface>;
  }
  if (query.isError) {
    return (
      <StatusBanner
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
        body={formatApiError(query.error)}
        title="Report could not be loaded"
        tone="danger"
      />
    );
  }
  const summary = query.data;
  const totalPackages =
    (summary?.packages_in_storage ?? 0) +
    (summary?.packages_given_away ?? 0) +
    (summary?.packages_depleted ?? 0);
  if (!summary || totalPackages === 0) {
    return (
      <Surface>
        {hasFilters ? (
          <p className="font-semibold">
            No matching production history was found for the selected filters.
          </p>
        ) : (
          <>
            <p className="font-semibold">
              No production history is available yet.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Create Production Batches to begin collecting historical insights.
            </p>
          </>
        )}
      </Surface>
    );
  }
  return (
    <div className="space-y-4">
      <SummaryPanel
        items={[
          {
            label: "Packages In Storage",
            value: summary.packages_in_storage,
            emphasis: true,
          },
          { label: "Packages Given Away", value: summary.packages_given_away },
          { label: "Packages Depleted", value: summary.packages_depleted },
          {
            label: "Total Packaged Weight",
            value: formatGrams(String(summary.total_packaged_weight_grams)),
          },
          {
            label: "Total Dried Weight",
            value: formatGrams(String(summary.total_dried_weight_grams)),
          },
        ]}
        title="Inventory Summary"
      >
        <p className="text-sm text-slate-600">
          Total Packaged Weight and Total Dried Weight are shown separately and
          are not expected to match — some dried product may not yet be
          packaged, and packaging introduces its own weight differences.
        </p>
      </SummaryPanel>
      {summary.most_common_products.length > 0 ? (
        <Surface className="overflow-x-auto">
          <h3 className="section-title">Most Common Products</h3>
          <table className="data-table mt-2">
            <thead>
              <tr>
                <th>Product</th>
                <th>Packages</th>
              </tr>
            </thead>
            <tbody>
              {summary.most_common_products.map((product) => (
                <tr key={product.product_name}>
                  <td>{product.product_name}</td>
                  <td>{product.package_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds <= 0) return "0 h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatPercent(value: DecimalValue | null) {
  if (value === null) return "—";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string | null) {
  if (value === null) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";

import { inventoryApi, type Package, type ProductGroup } from "../api/client";
import {
  ButtonLink,
  Field,
  PageHeader,
  Select,
  StatusBanner,
  Surface,
  TextField,
  type SelectOption,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";
import { formatGrams } from "../utils/weights";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "In Storage", label: "In Storage" },
  { value: "Given Away", label: "Given Away" },
  { value: "Depleted", label: "Depleted" },
];

export function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "In Storage";
  const storageLocationId = searchParams.get("location") ?? "";
  const productNameFilter = searchParams.get("product");

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

  const storageLocationsQuery = useQuery({
    queryKey: ["storage-locations", "including-archived"],
    queryFn: () => inventoryApi.listStorageLocations({ includeArchived: true }),
  });
  const storageLocationOptions: SelectOption[] = useMemo(() => {
    const locations = storageLocationsQuery.data ?? [];
    return [
      { value: "", label: "All Storage Locations" },
      ...locations.map((location) => ({
        value: location.id,
        label: location.archived
          ? `${location.name} (archived)`
          : location.name,
      })),
    ];
  }, [storageLocationsQuery.data]);

  const storageLocationName = useMemo(
    () =>
      storageLocationsQuery.data?.find(
        (location) => location.id === storageLocationId,
      )?.name ?? null,
    [storageLocationsQuery.data, storageLocationId],
  );

  const isBrowsingGroups =
    query.trim() === "" &&
    status === "In Storage" &&
    storageLocationId === "" &&
    productNameFilter === null;

  const productGroupsQuery = useQuery({
    queryKey: ["inventory-product-groups"],
    queryFn: inventoryApi.listProductGroups,
    enabled: isBrowsingGroups,
  });

  const searchResultsQuery = useQuery({
    queryKey: [
      "inventory-search",
      query,
      status,
      storageLocationId,
      productNameFilter,
    ],
    queryFn: () =>
      inventoryApi.searchInventory({
        query: query.trim() || undefined,
        status,
        storageLocationId: storageLocationId || undefined,
        productName: productNameFilter ?? undefined,
      }),
    enabled: !isBrowsingGroups,
  });

  function clearSearch() {
    setSearchParams(new URLSearchParams());
  }

  const backAction = productNameFilter
    ? {
        label: "Back to Products",
        onClick: () => updateParams({ product: null }),
      }
    : storageLocationId
      ? {
          label: "Back to Storage Locations",
          onClick: () => navigate("/inventory/storage-locations"),
        }
      : null;

  return (
    <div className="space-y-4">
      {backAction ? (
        <nav>
          <button
            className="quiet-action -ml-3"
            type="button"
            onClick={backAction.onClick}
          >
            &larr; {backAction.label}
          </button>
        </nav>
      ) : null}

      <PageHeader
        action={
          <ButtonLink to="/inventory/storage-locations" variant="secondary">
            Storage Locations
          </ButtonLink>
        }
        description="Find a Package in seconds, or browse everything currently in storage by Product."
        eyebrow="Inventory"
        title="Inventory"
      />

      <Surface>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <Field className="flex-1" htmlFor="inventory-search" label="Search">
            <TextField
              id="inventory-search"
              placeholder="Product, Package, Storage Location…"
              value={query}
              onChange={(event) => {
                updateParams({ q: event.target.value, product: null });
              }}
            />
          </Field>
          <Field htmlFor="inventory-status" label="Status">
            <Select
              id="inventory-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                updateParams({
                  status: value === "In Storage" ? null : value,
                  product: null,
                });
              }}
            />
          </Field>
          <Field htmlFor="inventory-storage-location" label="Storage Location">
            <Select
              id="inventory-storage-location"
              options={storageLocationOptions}
              value={storageLocationId}
              onChange={(value) => {
                updateParams({ location: value, product: null });
              }}
            />
          </Field>
          {isBrowsingGroups ? null : (
            <button
              className="secondary-action"
              type="button"
              onClick={clearSearch}
            >
              Clear Search
            </button>
          )}
        </div>
      </Surface>

      {isBrowsingGroups ? (
        <ProductGroupsView
          query={productGroupsQuery}
          onOpenGroup={(productName) => updateParams({ product: productName })}
        />
      ) : (
        <SearchResultsView
          productNameFilter={productNameFilter}
          query={searchResultsQuery}
          storageLocationName={!productNameFilter ? storageLocationName : null}
        />
      )}
    </div>
  );
}

function ProductGroupsView({
  onOpenGroup,
  query,
}: {
  onOpenGroup: (productName: string) => void;
  query: UseQueryResult<ProductGroup[]>;
}) {
  const groups = query.data ?? [];
  return (
    <section aria-labelledby="inventory-product-groups">
      <h3 className="sr-only" id="inventory-product-groups">
        Products in storage
      </h3>
      {query.isLoading ? (
        <Surface>Loading Inventory…</Surface>
      ) : query.isError ? (
        <StatusBanner
          body={formatApiError(query.error)}
          title="Inventory could not be loaded"
          tone="danger"
        />
      ) : groups.length === 0 ? (
        <Surface>
          No Packages in Inventory yet. Package some finished Product to see it
          here.
        </Surface>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <button
              className="w-full rounded-md border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-teal-600"
              key={group.product_name}
              type="button"
              onClick={() => onOpenGroup(group.product_name)}
            >
              <p className="font-semibold text-slate-950">
                {group.product_name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {group.available_package_count} Package
                {group.available_package_count === 1 ? "" : "s"} ·{" "}
                {group.storage_locations.join(", ")} · Oldest{" "}
                {formatDate(group.oldest_packaged_at)}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SearchResultsView({
  productNameFilter,
  query,
  storageLocationName,
}: {
  productNameFilter: string | null;
  query: UseQueryResult<Package[]>;
  storageLocationName: string | null;
}) {
  const results = query.data ?? [];
  const heading = productNameFilter ?? storageLocationName;
  return (
    <section aria-labelledby="inventory-search-results">
      {heading ? (
        <p
          className="text-sm font-semibold text-slate-700"
          id="inventory-search-results"
        >
          {heading} · {results.length} Package
          {results.length === 1 ? "" : "s"}
        </p>
      ) : (
        <h3 className="sr-only" id="inventory-search-results">
          Matching Packages
        </h3>
      )}
      {query.isLoading ? (
        <Surface className="mt-2">Searching Inventory…</Surface>
      ) : query.isError ? (
        <StatusBanner
          body={formatApiError(query.error)}
          title="Inventory search failed"
          tone="danger"
        />
      ) : results.length === 0 ? (
        <Surface className="mt-2">
          <p className="font-semibold">No Packages matched your search.</p>
          <p className="mt-1 text-sm text-slate-600">
            Try different keywords, removing filters, or searching by Product
            name instead.
          </p>
        </Surface>
      ) : (
        <ul className="mt-2 space-y-2" role="list">
          {results.map((item) => (
            <li key={item.id}>
              <Link
                className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-teal-600"
                to={`/packages/${item.id}`}
              >
                <p className="font-semibold">{item.label.display_name}</p>
                <p className="text-sm text-slate-700">
                  {item.package_identifier} · {item.package_type.name} ·{" "}
                  {formatGrams(
                    item.finished_product_weight_grams === null
                      ? null
                      : String(item.finished_product_weight_grams),
                  )}
                </p>
                <p className="text-sm text-slate-600">
                  {item.storage_location.name} · Packaged{" "}
                  {formatDate(item.packaged_at)} · {item.status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

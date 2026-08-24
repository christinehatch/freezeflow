import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { inventoryApi } from "../api/client";
import {
  Button,
  PageHeader,
  SectionHeader,
  StatusBanner,
  Surface,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";

const QUERY_KEY = ["storage-locations", "including-archived"];

export function StorageLocationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const storageLocationsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => inventoryApi.listStorageLocations({ includeArchived: true }),
  });
  const [draft, setDraft] = useState({ name: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const createStorageLocation = useMutation({
    mutationFn: inventoryApi.createStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setDraft({ name: "", notes: "" });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const archiveStorageLocation = useMutation({
    mutationFn: inventoryApi.archiveStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const restoreStorageLocation = useMutation({
    mutationFn: inventoryApi.restoreStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createStorageLocation.mutate({
      name: draft.name,
      notes: draft.notes.trim() || null,
    });
  }

  function goBack() {
    if (location.key === "default") {
      navigate("/inventory");
    } else {
      navigate(-1);
    }
  }

  const locations = storageLocationsQuery.data ?? [];
  const activeLocations = locations.filter((item) => !item.archived);
  const archivedLocations = locations.filter((item) => item.archived);

  return (
    <div className="storage-locations-page">
      <PageHeader
        action={
          <Button variant="secondary" onClick={goBack}>
            &larr; Back
          </Button>
        }
        description="Manage the physical places Packages are stored without interrupting active Inventory work."
        eyebrow="Inventory setup"
        title="Storage Locations"
      />

      {error ? (
        <StatusBanner
          body={error}
          title="Storage Location action failed"
          tone="danger"
        />
      ) : null}

      <Surface>
        <SectionHeader title="Create Storage Location" />
        <form className="storage-location-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="field storage-location-form__notes">
            <span>Notes</span>
            <input
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </label>
          <Button disabled={createStorageLocation.isPending} type="submit">
            {createStorageLocation.isPending
              ? "Creating…"
              : "Add Storage Location"}
          </Button>
        </form>
      </Surface>

      <section aria-labelledby="active-storage-locations">
        <SectionHeader
          id="active-storage-locations"
          title="Active Storage Locations"
        />
        {storageLocationsQuery.isLoading ? (
          <Surface>Loading Storage Locations…</Surface>
        ) : storageLocationsQuery.isError ? (
          <StatusBanner
            body={formatApiError(storageLocationsQuery.error)}
            title="Storage Locations could not be loaded"
            tone="danger"
          />
        ) : activeLocations.length ? (
          <div className="storage-location-list">
            {activeLocations.map((location) => (
              <Surface className="storage-location-card" key={location.id}>
                <div>
                  <h3>{location.name}</h3>
                  {location.notes ? <p>{location.notes}</p> : null}
                </div>
                <Button
                  disabled={
                    archiveStorageLocation.isPending ||
                    location.name === "Unassigned"
                  }
                  variant="secondary"
                  onClick={() => archiveStorageLocation.mutate(location.id)}
                >
                  Archive
                </Button>
              </Surface>
            ))}
          </div>
        ) : (
          <Surface>No active Storage Locations yet.</Surface>
        )}
      </section>

      {archivedLocations.length ? (
        <section aria-labelledby="archived-storage-locations">
          <SectionHeader
            id="archived-storage-locations"
            title="Archived Storage Locations"
          />
          <div className="storage-location-list">
            {archivedLocations.map((location) => (
              <Surface className="storage-location-card" key={location.id}>
                <div>
                  <h3>{location.name}</h3>
                  {location.notes ? <p>{location.notes}</p> : null}
                </div>
                <Button
                  disabled={restoreStorageLocation.isPending}
                  variant="secondary"
                  onClick={() => restoreStorageLocation.mutate(location.id)}
                >
                  Restore
                </Button>
              </Surface>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

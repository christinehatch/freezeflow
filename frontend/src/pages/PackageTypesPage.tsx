import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { packagingApi } from "../api/client";
import {
  Button,
  ButtonLink,
  PageHeader,
  SectionHeader,
  StatusBanner,
  Surface,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";

export function PackageTypesPage() {
  const queryClient = useQueryClient();
  const packageTypesQuery = useQuery({
    queryKey: ["package-types"],
    queryFn: packagingApi.listPackageTypes,
  });
  const [draft, setDraft] = useState({
    name: "",
    default_oxygen_absorber: "",
    default_label_template: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const createPackageType = useMutation({
    mutationFn: packagingApi.createPackageType,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setDraft({
        name: "",
        default_oxygen_absorber: "",
        default_label_template: "",
        notes: "",
      });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["package-types"] });
    },
  });
  const archivePackageType = useMutation({
    mutationFn: (packageTypeId: string) =>
      packagingApi.updatePackageType(packageTypeId, { archived: true }),
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["package-types"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createPackageType.mutate({
      name: draft.name,
      default_oxygen_absorber: draft.default_oxygen_absorber.trim() || null,
      default_label_template: draft.default_label_template.trim() || null,
      notes: draft.notes.trim() || null,
    });
  }

  return (
    <div className="package-types-page">
      <PageHeader
        action={
          <ButtonLink to="/packaging" variant="secondary">
            Back to Packaging
          </ButtonLink>
        }
        description="Manage reusable Package formats and defaults without interrupting active Packaging work."
        eyebrow="Packaging setup"
        title="Package Types"
      />

      {error ? (
        <StatusBanner
          body={error}
          title="Package Type action failed"
          tone="danger"
        />
      ) : null}

      <Surface>
        <SectionHeader title="Create Package Type" />
        <form className="package-type-form" onSubmit={handleSubmit}>
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
          <label className="field">
            <span>Default Oxygen Absorber</span>
            <input
              value={draft.default_oxygen_absorber}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  default_oxygen_absorber: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Default Label Template</span>
            <input
              value={draft.default_label_template}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  default_label_template: event.target.value,
                }))
              }
            />
          </label>
          <label className="field package-type-form__notes">
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
          <Button disabled={createPackageType.isPending} type="submit">
            {createPackageType.isPending ? "Creating…" : "Add Package Type"}
          </Button>
        </form>
      </Surface>

      <section aria-labelledby="active-package-types">
        <SectionHeader id="active-package-types" title="Active Package Types" />
        {packageTypesQuery.isLoading ? (
          <Surface>Loading Package Types…</Surface>
        ) : packageTypesQuery.isError ? (
          <StatusBanner
            body={formatApiError(packageTypesQuery.error)}
            title="Package Types could not be loaded"
            tone="danger"
          />
        ) : packageTypesQuery.data?.length ? (
          <div className="package-type-list">
            {packageTypesQuery.data.map((packageType) => (
              <Surface className="package-type-card" key={packageType.id}>
                <div>
                  <h3>{packageType.name}</h3>
                  <p>
                    {packageType.default_oxygen_absorber ||
                      "No absorber default"}
                    {packageType.default_label_template
                      ? ` · ${packageType.default_label_template}`
                      : ""}
                  </p>
                  {packageType.notes ? <p>{packageType.notes}</p> : null}
                </div>
                <Button
                  disabled={archivePackageType.isPending}
                  variant="secondary"
                  onClick={() => archivePackageType.mutate(packageType.id)}
                >
                  Archive
                </Button>
              </Surface>
            ))}
          </div>
        ) : (
          <Surface>No active Package Types yet.</Surface>
        )}
      </section>
    </div>
  );
}

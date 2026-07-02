import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { productionApi } from "../api/client";

export function TrayDetailsPage() {
  const { trayId } = useParams();
  const trayQuery = useQuery({
    queryKey: ["tray", trayId],
    queryFn: () => productionApi.getTray(trayId ?? ""),
    enabled: Boolean(trayId),
  });

  const tray = trayQuery.data;

  if (trayQuery.isLoading) {
    return <div className="panel">Loading Tray...</div>;
  }

  if (!tray) {
    return <div className="panel">Tray could not be loaded.</div>;
  }

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-600">
        <Link className="text-link" to="/">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link
          className="text-link"
          to={`/production/${tray.production_batch_id}`}
        >
          Production Batch
        </Link>{" "}
        / Tray {tray.tray_number}
      </nav>

      <section className="workspace-header">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Tray {tray.tray_number}
          </p>
          <h2 className="text-3xl font-semibold">{tray.product_name}</h2>
        </div>
        <p className="text-lg font-semibold">{tray.status}</p>
      </section>

      <section className="panel">
        <h3 className="section-title">Product</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="label-text">Recipe</dt>
            <dd>{tray.recipe_name ?? "No Recipe"}</dd>
          </div>
          <div>
            <dt className="label-text">Notes</dt>
            <dd>{tray.notes ?? "No notes"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="section-title">Preparation</h3>
        <p className="mt-3 whitespace-pre-wrap text-slate-700">
          {tray.preparation}
        </p>
      </section>

      <section className="panel">
        <h3 className="section-title">Production</h3>
        <p className="mt-3 text-slate-600">No drying history recorded.</p>
      </section>
    </div>
  );
}

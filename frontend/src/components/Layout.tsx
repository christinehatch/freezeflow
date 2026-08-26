import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { FeedbackModal } from "./FeedbackModal";
import { logAction } from "../utils/actionLog";

const navigationItems = [
  { to: "/", label: "Dashboard" },
  { to: "/production", label: "Production" },
  { to: "/freeze-dryers", label: "Freeze Dryers" },
  { to: "/packaging", label: "Packaging" },
  { to: "/inventory", label: "Inventory" },
  { to: "/reports", label: "Reports" },
  ...(import.meta.env.DEV
    ? [{ to: "/developer-tools", label: "Developer Tools" }]
    : []),
];

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/production": "Production",
  "/production/preparation-presets": "Preparation Presets",
  "/freeze-dryers": "Freeze Dryers",
  "/packaging": "Packaging",
  "/packaging/package-types": "Package Types",
  "/packaging/print-today": "Print Today's Labels",
  "/inventory": "Inventory",
  "/inventory/storage-locations": "Storage Locations",
  "/reports": "Reports",
  "/developer-tools": "Developer Tools",
  "/developer-tools/design-system": "Design System",
};

function describePage(pathname: string): string {
  return PAGE_LABELS[pathname] ?? pathname;
}

export function Layout() {
  const location = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    logAction(`Opened ${describePage(location.pathname)}`);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-slate-500">
              Freezeflow
            </p>
            <h1 className="text-2xl font-semibold">Production Workflow</h1>
          </div>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
      <button
        className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
      >
        Send Feedback
      </button>
      {isFeedbackOpen ? (
        <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />
      ) : null}
    </div>
  );
}

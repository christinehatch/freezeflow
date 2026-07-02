import { NavLink, Outlet } from "react-router";

const navigationItems = [
  { to: "/", label: "Dashboard" },
  { to: "/production", label: "Production" },
  { to: "/freeze-dryers", label: "Freeze Dryers" },
  { to: "/packaging", label: "Packaging" },
  { to: "/inventory", label: "Inventory" },
  { to: "/reports", label: "Reports" },
];

export function Layout() {
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
    </div>
  );
}

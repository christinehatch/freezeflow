import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import { Layout } from "../components/Layout";

const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DesignSystemPage = lazy(() =>
  import("../pages/DesignSystemPage").then((m) => ({
    default: m.DesignSystemPage,
  })),
);
const DeveloperToolsPage = lazy(() =>
  import("../pages/DeveloperToolsPage").then((m) => ({
    default: m.DeveloperToolsPage,
  })),
);
const FreezeDryersPage = lazy(() =>
  import("../pages/FreezeDryersPage").then((m) => ({
    default: m.FreezeDryersPage,
  })),
);
const InventoryPage = lazy(() =>
  import("../pages/InventoryPage").then((m) => ({ default: m.InventoryPage })),
);
const PackageDetailsPage = lazy(() =>
  import("../pages/PackageDetailsPage").then((m) => ({
    default: m.PackageDetailsPage,
  })),
);
const PackagingPage = lazy(() =>
  import("../pages/PackagingPage").then((m) => ({ default: m.PackagingPage })),
);
const PackageTypesPage = lazy(() =>
  import("../pages/PackageTypesPage").then((m) => ({
    default: m.PackageTypesPage,
  })),
);
const PreparationPresetsPage = lazy(() =>
  import("../pages/PreparationPresetsPage").then((m) => ({
    default: m.PreparationPresetsPage,
  })),
);
const PrintTodaysLabelsPage = lazy(() =>
  import("../pages/PrintTodaysLabelsPage").then((m) => ({
    default: m.PrintTodaysLabelsPage,
  })),
);
const ProductionBatchPage = lazy(() =>
  import("../pages/ProductionBatchPage").then((m) => ({
    default: m.ProductionBatchPage,
  })),
);
const ProductionPage = lazy(() =>
  import("../pages/ProductionPage").then((m) => ({
    default: m.ProductionPage,
  })),
);
const ReportsPage = lazy(() =>
  import("../pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const StorageLocationsPage = lazy(() =>
  import("../pages/StorageLocationsPage").then((m) => ({
    default: m.StorageLocationsPage,
  })),
);
const TrayDetailsPage = lazy(() =>
  import("../pages/TrayDetailsPage").then((m) => ({
    default: m.TrayDetailsPage,
  })),
);

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/production", element: <ProductionPage /> },
      {
        path: "/production/preparation-presets",
        element: <PreparationPresetsPage />,
      },
      { path: "/production/:batchId", element: <ProductionBatchPage /> },
      { path: "/trays/:trayId", element: <TrayDetailsPage /> },
      { path: "/packages/:packageId", element: <PackageDetailsPage /> },
      { path: "/freeze-dryers", element: <FreezeDryersPage /> },
      { path: "/packaging", element: <PackagingPage /> },
      { path: "/packaging/package-types", element: <PackageTypesPage /> },
      { path: "/packaging/print-today", element: <PrintTodaysLabelsPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      {
        path: "/inventory/storage-locations",
        element: <StorageLocationsPage />,
      },
      { path: "/reports", element: <ReportsPage /> },
      ...(import.meta.env.DEV
        ? [
            { path: "/developer-tools", element: <DeveloperToolsPage /> },
            {
              path: "/developer-tools/design-system",
              element: <DesignSystemPage />,
            },
          ]
        : []),
    ],
  },
]);

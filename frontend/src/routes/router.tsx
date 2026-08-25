import { createBrowserRouter } from "react-router";

import { Layout } from "../components/Layout";
import { DashboardPage } from "../pages/DashboardPage";
import { DesignSystemPage } from "../pages/DesignSystemPage";
import { DeveloperToolsPage } from "../pages/DeveloperToolsPage";
import { FreezeDryersPage } from "../pages/FreezeDryersPage";
import { InventoryPage } from "../pages/InventoryPage";
import { PackageDetailsPage } from "../pages/PackageDetailsPage";
import { PackagingPage } from "../pages/PackagingPage";
import { PackageTypesPage } from "../pages/PackageTypesPage";
import { PreparationPresetsPage } from "../pages/PreparationPresetsPage";
import { PrintTodaysLabelsPage } from "../pages/PrintTodaysLabelsPage";
import { ProductionBatchPage } from "../pages/ProductionBatchPage";
import { ProductionPage } from "../pages/ProductionPage";
import { ReportsPage } from "../pages/ReportsPage";
import { StorageLocationsPage } from "../pages/StorageLocationsPage";
import { TrayDetailsPage } from "../pages/TrayDetailsPage";

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

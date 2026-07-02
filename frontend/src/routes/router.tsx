import { createBrowserRouter } from "react-router";

import { Layout } from "../components/Layout";
import { DashboardPage } from "../pages/DashboardPage";
import { FreezeDryersPage } from "../pages/FreezeDryersPage";
import { InventoryPage } from "../pages/InventoryPage";
import { PackagingPage } from "../pages/PackagingPage";
import { ProductionBatchPage } from "../pages/ProductionBatchPage";
import { ProductionPage } from "../pages/ProductionPage";
import { ReportsPage } from "../pages/ReportsPage";
import { TrayDetailsPage } from "../pages/TrayDetailsPage";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/production", element: <ProductionPage /> },
      { path: "/production/:batchId", element: <ProductionBatchPage /> },
      { path: "/trays/:trayId", element: <TrayDetailsPage /> },
      { path: "/freeze-dryers", element: <FreezeDryersPage /> },
      { path: "/packaging", element: <PackagingPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      { path: "/reports", element: <ReportsPage /> },
    ],
  },
]);

import { createBrowserRouter } from "react-router";

import { Layout } from "../components/Layout";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../pages/InventoryPage";
import { PackagingPage } from "../pages/PackagingPage";
import { ProductionPage } from "../pages/ProductionPage";
import { ReportsPage } from "../pages/ReportsPage";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/production", element: <ProductionPage /> },
      { path: "/packaging", element: <PackagingPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      { path: "/reports", element: <ReportsPage /> },
    ],
  },
]);

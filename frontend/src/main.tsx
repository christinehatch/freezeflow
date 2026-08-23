import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/design-system.css";
import "./styles/dashboard.css";
import "./styles/packaging.css";
import "./styles/production.css";
import "./styles/inventory.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

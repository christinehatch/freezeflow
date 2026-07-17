import { defineConfig, devices } from "@playwright/test";

const databaseUrl = "sqlite:////private/tmp/freezeflow-playwright-smoke.db";

export default defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  outputDir: "/private/tmp/freezeflow-playwright-real-results",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-real-backend",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: [
        "cd ../backend",
        `FREEZEFLOW_DATABASE_URL=${databaseUrl} FREEZEFLOW_ENVIRONMENT=test .venv/bin/alembic upgrade head`,
        `FREEZEFLOW_DATABASE_URL=${databaseUrl} FREEZEFLOW_ENVIRONMENT=test .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001`,
      ].join(" && "),
      url: "http://127.0.0.1:8001/api/v1/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        "VITE_API_BASE_URL=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

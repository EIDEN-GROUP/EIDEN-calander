import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite. Runs against the production build on :3000 by default.
 * Authenticated tests are skipped unless E2E_EMAIL / E2E_PASSWORD are set —
 * never commit credentials.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  workers: 1, // serial — shared dev/prod server
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

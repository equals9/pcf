import { defineConfig } from "@playwright/test";

// Dedicated ports so acceptance tests never attach to an unrelated server on 3000.
const PRODUCTION_PORT = 3211;
const DEV_PORT = 3210;

// Each server gets a fresh temporary database and the fake `claude` CLI first on PATH
// (tests/fixtures/e2e-server.mjs). Every test runs against the production build and the dev server.
const server = (mode: "production" | "dev", port: number, timeout: number) => ({
  command: `node tests/fixtures/e2e-server.mjs ${mode} ${port}`,
  url: `http://localhost:${port}`,
  reuseExistingServer: false,
  timeout,
  gracefulShutdown: { signal: "SIGTERM" as const, timeout: 10_000 },
});

export default defineConfig({
  testDir: "tests/acceptance",
  // One worker: the tests in a project share one server and one database, and some count stored thoughts.
  workers: 1,
  projects: [
    { name: "production", use: { baseURL: `http://localhost:${PRODUCTION_PORT}` } },
    { name: "dev", use: { baseURL: `http://localhost:${DEV_PORT}` } },
  ],
  // Started in order, so the production build finishes before the dev server starts.
  webServer: [server("production", PRODUCTION_PORT, 180_000), server("dev", DEV_PORT, 60_000)],
});

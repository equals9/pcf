import { defineConfig } from "@playwright/test";

// Dedicated port so acceptance tests never attach to an unrelated dev server on 3000.
const PORT = 3210;

export default defineConfig({
  testDir: "tests/acceptance",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

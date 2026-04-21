import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: [
    "phase4-smoke.spec.ts",
    "phase4-e2e.spec.ts",
    "phase4-coord-literato.spec.ts",
    "phase4-coord-dombosco.spec.ts",
  ],
  outputDir: "test-results-phase4",
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

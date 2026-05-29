import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["test-smoke-3-roles.spec.ts"],
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  fullyParallel: false, // testes usam o mesmo dev server; roda em série
  workers: 1,
  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

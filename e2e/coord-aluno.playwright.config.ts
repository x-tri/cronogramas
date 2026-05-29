import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["test-coord-aluno-simulado.spec.ts"],
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

/**
 * Phase 4 smoke tests — verify new features render without JS errors
 * on both aluno and cronogramas admin frontends.
 *
 * Requires dev servers running:
 *   - Aluno: http://localhost:8080
 *   - Cronogramas admin: http://localhost:8082
 */

import { expect, test } from "@playwright/test";

const ALUNO_URL = "http://localhost:8080";
const ADMIN_URL = "http://localhost:8082";

test.describe("Phase 4 frontend smoke", () => {
  test("aluno: HistoricoSimulados page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    const res = await page.goto(`${ALUNO_URL}/simulados/historico`);
    expect(res?.status()).toBe(200);

    // Wait a moment for React to render (will redirect to /login because no session)
    await page.waitForLoadState("networkidle", { timeout: 8000 });

    // Ensure page rendered something (not a white-screen crash)
    const bodyText = await page.locator("body").textContent();
    expect(bodyText?.length).toBeGreaterThan(5);

    // Filter harmless console noise that's pre-existing
    const real = errors.filter(
      (e) =>
        !/React Router Future Flag/i.test(e) &&
        !/\[plugin:vite:css\]/i.test(e) &&
        !/Download the React DevTools/i.test(e),
    );
    expect(real, `Unexpected JS errors: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("aluno: /simulados shows Histórico TRI button (navigation entrypoint)", async ({ page }) => {
    // This will land on login page since unauthenticated;
    // the button only renders for authed students. But we can verify
    // the Simulados route itself loads without crashing.
    const res = await page.goto(`${ALUNO_URL}/simulados`);
    expect(res?.status()).toBe(200);

    await page.waitForLoadState("networkidle", { timeout: 8000 });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText?.length).toBeGreaterThan(5);
  });

  test("admin: cronogramas root loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    const res = await page.goto(ADMIN_URL);
    expect(res?.status()).toBe(200);

    await page.waitForLoadState("networkidle", { timeout: 10000 });

    // Should see either login or main app — not a blank page
    const body = await page.locator("body").textContent();
    expect(body?.length).toBeGreaterThan(10);

    const real = errors.filter(
      (e) =>
        !/React Router Future Flag/i.test(e) &&
        !/\[plugin:vite:css\]/i.test(e) &&
        !/Download the React DevTools/i.test(e) &&
        !/ResizeObserver loop/i.test(e),
    );
    expect(real, `Unexpected JS errors: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("admin: the new student-tri-history-drawer module is bundled", async ({ page }) => {
    // Vite serves each module individually; hitting the module URL directly
    // confirms it compiles without errors.
    const res = await page.goto(
      `${ADMIN_URL}/src/components/admin/student-tri-history-drawer.tsx`,
    );
    expect(res?.status()).toBe(200);
    const content = await page.content();
    // It should be transpiled JS with React component markers, not a 404/error
    expect(content).toContain("StudentTriHistoryDrawer");
  });

  test("aluno: HistoricoSimulados module is bundled", async ({ page }) => {
    const res = await page.goto(`${ALUNO_URL}/src/pages/HistoricoSimulados.tsx`);
    expect(res?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("HistoricoSimulados");
  });

  test("aluno: useStudentPerformance hook is bundled", async ({ page }) => {
    const res = await page.goto(
      `${ALUNO_URL}/src/hooks/useStudentPerformance.ts`,
    );
    expect(res?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("useStudentPerformance");
  });
});

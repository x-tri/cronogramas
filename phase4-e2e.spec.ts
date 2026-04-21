/**
 * Phase 4 E2E — login real + verificação visual do histórico TRI.
 *
 * Credenciais: XTRI01@xtri.online / senha123 (super_admin).
 * Testa o admin Consultar histórico TRI com matrículas LITERATO reais.
 */

import { expect, test } from "@playwright/test";

const ADMIN_URL = "http://localhost:8082";
const SCREENSHOT_DIR = "test-results-phase4-e2e";

const CREDS = {
  email: "XTRI01@xtri.online",
  password: "admin123",
};

// Matrículas LITERATO selecionadas para demo (3 perfis distintos)
const TEST_STUDENTS = {
  evolucao_positiva: { matricula: "101295", name: "JOAO LUCAS VIEIRA LIMA" },
  queda_critica: { matricula: "101347", name: "YASMIN CRISTINE VAZ CHAGAS" },
  baseline: { matricula: "101051", name: "JOAO PEDRO BULHAO CARACAS" },
};

test.describe("Phase 4 E2E — admin histórico TRI real", () => {
  test.setTimeout(60_000);

  test("admin XTRI01: login + abre drawer TRI com student 101295 (evolução +267)", async ({
    page,
  }) => {
    // Capture JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
    });

    // 1. Login
    await page.goto(ADMIN_URL);
    await page.waitForLoadState("domcontentloaded");

    // Login button → form
    await page.getByRole("button", { name: /entrar com email/i }).click();
    await page.locator("#username").fill(CREDS.email);
    await page.locator("#password").fill(CREDS.password);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    // Wait for login to ACTUALLY complete — login page disappears
    await expect(page.locator("#username")).not.toBeVisible({ timeout: 25_000 });
    // Give React a beat to render the dashboard
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-admin-home.png`,
      fullPage: true,
    });

    // 2. Navegar para Simulados ENEM
    // Super_admin usa sidebar do admin-dashboard → item "Simulados ENEM" ou similar.
    // Coord tem toggle "Simulados ENEM" no header.
    const simuladosLink = page
      .getByRole("button", { name: /simulados.*enem/i })
      .or(page.getByRole("link", { name: /simulados.*enem/i }))
      .or(page.locator("button,a,[role=tab]").filter({ hasText: /simulados/i }))
      .first();

    await expect(simuladosLink).toBeVisible({ timeout: 10_000 });
    await simuladosLink.click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-simulados-page.png`,
      fullPage: true,
    });

    // 3. Usar o novo quick-lookup de histórico TRI
    const lookupInput = page.getByTestId("tri-lookup-input");
    await expect(lookupInput).toBeVisible({ timeout: 8000 });
    await lookupInput.fill(TEST_STUDENTS.evolucao_positiva.matricula);
    await page.getByTestId("tri-lookup-btn").click();

    // 4. Drawer deve abrir
    const drawer = page.getByTestId("tri-history-drawer");
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    // Aguarda conteúdo carregar (cards por área)
    await expect(page.getByTestId("admin-area-lc")).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-tri-drawer-101295-evolucao.png`,
      fullPage: true,
    });

    // Valida que mostra o nome do aluno
    await expect(drawer).toContainText(TEST_STUDENTS.evolucao_positiva.name);

    // Fecha drawer
    await page.getByTestId("tri-drawer-close").click();
    await expect(drawer).not.toBeVisible({ timeout: 3000 });

    // 5. Teste 2: aluno com queda crítica + estimated flag
    await lookupInput.fill(TEST_STUDENTS.queda_critica.matricula);
    await page.getByTestId("tri-lookup-btn").click();
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("admin-area-lc")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-tri-drawer-101347-queda-estimated.png`,
      fullPage: true,
    });
    await expect(drawer).toContainText(TEST_STUDENTS.queda_critica.name);

    // Fecha
    await page.getByTestId("tri-drawer-close").click();

    // 6. Teste 3: baseline
    await lookupInput.fill(TEST_STUDENTS.baseline.matricula);
    await page.getByTestId("tri-lookup-btn").click();
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("admin-area-lc")).toBeVisible({ timeout: 15_000 });
    await expect(drawer).toContainText(TEST_STUDENTS.baseline.name);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-tri-drawer-101051-baseline.png`,
      fullPage: true,
    });

    // 7. Valida sem erros JS críticos
    const real = errors.filter(
      (e) =>
        !/React Router Future Flag/i.test(e) &&
        !/\[plugin:vite:css\]/i.test(e) &&
        !/Download the React DevTools/i.test(e) &&
        !/ResizeObserver loop/i.test(e) &&
        !/Failed to load resource.*favicon/i.test(e),
    );
    expect(real, `JS errors found: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("admin XTRI01: matrícula inválida mostra erro", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /entrar com email/i }).click();
    await page.locator("#username").fill(CREDS.email);
    await page.locator("#password").fill(CREDS.password);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page.locator("#username")).not.toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(1500);

    const simuladosLink = page
      .getByRole("button", { name: /simulados.*enem/i })
      .or(page.locator("button,a,[role=tab]").filter({ hasText: /simulados/i }))
      .first();
    await expect(simuladosLink).toBeVisible({ timeout: 10_000 });
    await simuladosLink.click();
    await page.waitForTimeout(1000);

    const lookupInput = page.getByTestId("tri-lookup-input");
    await expect(lookupInput).toBeVisible({ timeout: 8000 });
    // Matrícula literalmente inexistente (não "99999999" que foi criado no audit)
    await lookupInput.fill("ZZZZ_NOT_REAL");
    await page.getByTestId("tri-lookup-btn").click();

    await expect(page.getByText(/não encontrado/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

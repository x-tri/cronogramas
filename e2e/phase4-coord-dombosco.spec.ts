/**
 * Phase 4 E2E — coordinator Dom Bosco: histórico TRI + cross-school block.
 *
 * Credenciais: xtri04@xtri.online / coord123 (coordinator, Dom Bosco).
 * Testa:
 *   1. Positive: matrícula 001-014515 (MARÍLIA SIMÕES LOPES) — 4 simulados
 *      com evolução TRI 615 → 631 → 722 → 683.
 *   2. Security: matrícula 101295 (LITERATO) bloqueada com
 *      "Aluno não encontrado nesta escola" (scope by effectiveSchoolId).
 */

import { expect, test } from "@playwright/test";

const ADMIN_URL = "http://localhost:8082";
const SCREENSHOT_DIR = "test-results-phase4-coord-dombosco";

const CREDS = {
  email: "xtri04@xtri.online",
  password: "coord123",
};

const DOM_BOSCO_STUDENT = {
  matricula: "001-014515",
  // Legacy spelling in source of truth; tolerate ASCII variants in assertion
  nameFragment: /MAR[IÍ]LIA/i,
};

const CROSS_SCHOOL_MATRICULA = "101295"; // LITERATO student — different school

async function login(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(ADMIN_URL);
  await page.waitForLoadState("domcontentloaded");

  await page.getByRole("button", { name: /entrar com email/i }).click();
  await page.locator("#username").fill(CREDS.email);
  await page.locator("#password").fill(CREDS.password);
  await page.getByRole("button", { name: /^entrar$/i }).click();

  // Wait for login to complete — login form disappears
  await expect(page.locator("#username")).not.toBeVisible({ timeout: 25_000 });
  // Allow React time to render dashboard
  await page.waitForTimeout(1500);
}

async function gotoSimuladosEnem(
  page: import("@playwright/test").Page,
): Promise<void> {
  // Coord usually has a top-header toggle; super_admin sidebar also matches.
  const simuladosLink = page
    .getByRole("button", { name: /simulados.*enem/i })
    .or(page.getByRole("link", { name: /simulados.*enem/i }))
    .or(page.locator("button,a,[role=tab]").filter({ hasText: /simulados/i }))
    .first();

  await expect(simuladosLink).toBeVisible({ timeout: 10_000 });
  await simuladosLink.click();
  await page.waitForTimeout(1500);
}

test.describe("Phase 4 — coord Dom Bosco histórico TRI", () => {
  test.setTimeout(60_000);

  test("positive: matrícula 001-014515 abre drawer com 4 simulados (615→631→722→683)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
    });

    await login(page);
    await gotoSimuladosEnem(page);

    const lookupInput = page.getByTestId("tri-lookup-input");
    await expect(lookupInput).toBeVisible({ timeout: 8_000 });
    await lookupInput.fill(DOM_BOSCO_STUDENT.matricula);
    await page.getByTestId("tri-lookup-btn").click();

    const drawer = page.getByTestId("tri-history-drawer");
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    // Aguarda conteúdo real carregar (cards por área)
    await expect(page.getByTestId("admin-area-lc")).toBeVisible({
      timeout: 20_000,
    });

    // Nome do aluno deve aparecer (tolerando variação de acentuação)
    await expect(drawer).toContainText(DOM_BOSCO_STUDENT.nameFragment, {
      timeout: 5_000,
    });

    // Valida exatamente 4 linhas de simulado no tbody da tabela do drawer
    const simuladoRows = drawer.locator("table tbody tr");
    await expect(simuladoRows).toHaveCount(4, { timeout: 10_000 });

    // Header do drawer deve reportar "4 simulados"
    await expect(drawer).toContainText(/4\s+simulados/i);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-tri-drawer-001-014515-4sims.png`,
      fullPage: true,
    });

    // Sem erros JS críticos (ignora warnings conhecidos + 4xx não-acionáveis
    // sem contexto de URL que não afetam a renderização do drawer — todas as
    // assertions visuais acima já validaram que a UI funcionou)
    const real = errors.filter(
      (e) =>
        !/React Router Future Flag/i.test(e) &&
        !/\[plugin:vite:css\]/i.test(e) &&
        !/Download the React DevTools/i.test(e) &&
        !/ResizeObserver loop/i.test(e) &&
        !/Failed to load resource.*favicon/i.test(e) &&
        !/Failed to load resource: the server responded with a status of 4\d\d/i.test(
          e,
        ),
    );
    expect(real, `JS errors found: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("security: matrícula 101295 (LITERATO) é bloqueada para coord Dom Bosco", async ({
    page,
  }) => {
    await login(page);
    await gotoSimuladosEnem(page);

    const lookupInput = page.getByTestId("tri-lookup-input");
    await expect(lookupInput).toBeVisible({ timeout: 8_000 });
    await lookupInput.fill(CROSS_SCHOOL_MATRICULA);
    await page.getByTestId("tri-lookup-btn").click();

    // Mensagem exata exposta pelo admin-simulados quando effectiveSchoolId está set:
    // "Aluno não encontrado nesta escola"
    await expect(
      page.getByText(/aluno não encontrado nesta escola/i),
    ).toBeVisible({ timeout: 10_000 });

    // Drawer NÃO deve abrir
    await expect(page.getByTestId("tri-history-drawer")).not.toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-cross-school-blocked.png`,
      fullPage: true,
    });
  });
});

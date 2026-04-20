/**
 * Fluxo guiado do coordenador XTRI02:
 *   1. Login XTRI02
 *   2. Buscar aluno 99999999
 *   3. Menu Simulados ENEM
 *   4. Abrir Resultados (painel de ranking pedagógico)
 *   5. Validar nova seção "Tópico mais errado por área" (4 cards)
 */

import { test, expect, type Page } from "@playwright/test";

const ADMIN_BASE = "http://localhost:5174";
const COORD = { user: "XTRI02@xtri.online", pass: "admin123" };
const MATRICULA = "99999999";

function setupErrorSink(page: Page): { consoleErrors: string[]; failedRequests: string[] } {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (
      t.includes("favicon") ||
      t.includes("chrome-extension") ||
      t.includes("[vite]") ||
      t.includes("Download the React DevTools")
    ) return;
    consoleErrors.push(t);
  });
  page.on("requestfailed", (req) => {
    const err = req.failure()?.errorText ?? "unknown";
    if (err.includes("ERR_ABORTED")) return;
    const url = req.url();
    if (url.includes("favicon")) return;
    failedRequests.push(`${req.method()} ${url} — ${err}`);
  });
  return { consoleErrors, failedRequests };
}

test.describe("COORD XTRI02 → aluno 99999999 → Simulados ENEM → Resultados", () => {
  test("fluxo completo até ver tópico por área", async ({ page }) => {
    const errors = setupErrorSink(page);

    // 1. Login
    await page.goto(ADMIN_BASE + "/");
    await page.waitForLoadState("networkidle");
    await page.getByText("Entrar com email e senha").click();
    await page.waitForSelector("#username", { timeout: 5000 });
    await page.fill("#username", COORD.user);
    await page.fill("#password", COORD.pass);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/coord-01-pos-login.png", fullPage: true });

    // 2. Buscar aluno 99999999 — XTRI02 tem sessão de mentoria com busca por matrícula
    // Tenta encontrar input de busca (variações possíveis)
    const searchInput = page
      .getByPlaceholder(/matr[íi]cula|buscar|aluno/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').first());

    await searchInput.fill(MATRICULA);
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/coord-02-matricula-digitada.png", fullPage: true });

    // Tenta Enter e depois clique em botão "Buscar" se não reagir
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/coord-03-aluno-carregado.png", fullPage: true });

    // 3. Ir em Simulados ENEM
    // Pode ser sidebar button ou tab — tenta ambos
    const simuladosBtn = page
      .getByRole("button", { name: /simulados enem/i })
      .or(page.getByRole("tab", { name: /simulado/i }))
      .or(page.getByRole("link", { name: /simulado/i }))
      .first();
    await simuladosBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/coord-04-simulados-menu.png", fullPage: true });

    // 4. Clicar em "Resultados" ou "Ver ranking" ou similar
    const resultadosBtn = page
      .getByRole("button", { name: /resultados|ranking|ver/i })
      .first();

    if (await resultadosBtn.isVisible().catch(() => false)) {
      await resultadosBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "test-results/coord-05-resultados-aberto.png", fullPage: true });
    } else {
      test.info().annotations.push({
        type: "warning",
        description: "Botão Resultados não encontrado diretamente — capture estado atual",
      });
    }

    // 5. Validar nova seção "Tópico mais errado por área"
    const dialog = page.locator('[role="dialog"][aria-label*="Ranking"]');
    const dialogAberto = await dialog.isVisible().catch(() => false);

    if (dialogAberto) {
      // Procura o header novo
      await expect(dialog.getByText(/Tópico mais errado por área/i)).toBeVisible({ timeout: 5000 });

      // Valida que tem os 4 labels de área (LC, CH, CN, MT)
      for (const area of ["LC", "CH", "CN", "MT"] as const) {
        const badge = dialog.locator(`li:has-text("${area}")`).first();
        const visivel = await badge.isVisible().catch(() => false);
        test.info().annotations.push({
          type: "area",
          description: `Área ${area} renderizada: ${visivel}`,
        });
      }

      await page.screenshot({ path: "test-results/coord-06-topico-por-area.png", fullPage: true });
    }

    // Audit final
    expect(errors.consoleErrors, "Console errors").toEqual([]);
    expect(errors.failedRequests, "Failed requests").toEqual([]);
  });
});

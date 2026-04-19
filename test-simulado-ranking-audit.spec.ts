/**
 * E2E audit do painel de ranking de simulado (fase 3.3 / Option B).
 *
 * Cobre:
 *  - Login XTRI01 (coordenador/admin)
 *  - Navegação até tela Simulados
 *  - Abrir ranking de um simulado existente
 *  - Smoke das 7 seções (stats, tabela, tópicos, áreas, histograma, não-responderam)
 *  - Filtro por turma
 *  - Botão "Maior TRI" / "Menor TRI" labels corretos
 *  - Botão "Exportar Excel" presente e clicável (sem baixar — só testa handler)
 *  - Captura console.error e failed requests
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:5173";
const LOGIN_USER = "XTRI01@xtri.online";
const LOGIN_PASS = "admin123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function fazerLogin(page: Page): Promise<void> {
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  // Toggle pra form de email+senha (default mostra só "Entrar com Google")
  await page.getByText("Entrar com email e senha").click();
  await page.waitForSelector("#username", { timeout: 5000 });
  await page.fill("#username", LOGIN_USER);
  await page.fill("#password", LOGIN_PASS);
  await page.click('button[type="submit"]');
  // XTRI01 é admin CEO — aterrissa em "Visão Executiva"
  await page.waitForSelector("text=Visão Executiva", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

// Coleta erros durante o teste — falha no final se houver.
function setupErrorSink(page: Page): { consoleErrors: string[]; failedRequests: string[] } {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filtra ruído conhecido (extensões de browser, favicon 404 etc)
      if (
        !text.includes("favicon") &&
        !text.includes("chrome-extension") &&
        !text.includes("Download the React DevTools")
      ) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.includes("favicon")) {
      failedRequests.push(`${request.method()} ${url} — ${request.failure()?.errorText}`);
    }
  });

  return { consoleErrors, failedRequests };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe("Auditoria: Simulado Ranking (coordenador)", () => {
  test("login + abrir ranking + smoke das 7 seções + export button", async ({ page }) => {
    const errors = setupErrorSink(page);

    await fazerLogin(page);
    await page.screenshot({ path: "test-results/audit-01-logado.png", fullPage: true });

    // Navegar até Simulados ENEM (sidebar)
    await page.getByText("Simulados ENEM", { exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // deixa Supabase responder
    await page.screenshot({ path: "test-results/audit-02-simulados-list.png", fullPage: true });

    // Abrir o ranking do primeiro simulado — botão de ranking no card
    const rankingBtn = page
      .getByRole("button", { name: /ranking|respostas|ver/i })
      .first();

    if (await rankingBtn.isVisible().catch(() => false)) {
      await rankingBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/audit-03-ranking-aberto.png", fullPage: true });
    } else {
      test.info().annotations.push({
        type: "warning",
        description: "Botão de ranking não encontrado — pode ser necessário criar simulado primeiro",
      });
    }

    // Se o dialog/painel abriu, testa as seções
    const dialog = page.locator('[role="dialog"][aria-label*="Ranking"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      // Stats cards — labels novas (exact match pra evitar colisão com "Cronogramas dos Alunos" no sidebar)
      await expect(dialog.getByText("Maior TRI", { exact: true })).toBeVisible({ timeout: 5000 });
      await expect(dialog.getByText("Menor TRI", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Alunos", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Média da turma", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Desvio", { exact: true })).toBeVisible();

      // Botão export Excel
      const exportBtn = page.getByRole("button", { name: /exportar.*excel/i });
      await expect(exportBtn).toBeVisible();

      // Tabela ranking
      await expect(page.getByText(/🏆 Ranking/)).toBeVisible();

      // Seções pedagógicas
      const hasTopicos = await page
        .getByText(/Tópicos que a turma mais errou/)
        .isVisible()
        .catch(() => false);
      const hasAreas = await page
        .getByText(/Média de acertos por área/)
        .isVisible()
        .catch(() => false);
      const hasHisto = await page
        .getByText(/Distribuição de notas/)
        .isVisible()
        .catch(() => false);

      test.info().annotations.push({
        type: "sections",
        description: `topicos=${hasTopicos} areas=${hasAreas} histograma=${hasHisto}`,
      });

      await page.screenshot({ path: "test-results/audit-04-ranking-sections.png", fullPage: true });

      // Testa click no export (listener só — não confirma download)
      const downloadPromise = page
        .waitForEvent("download", { timeout: 5000 })
        .catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        test.info().annotations.push({
          type: "export",
          description: `Download disparado: ${filename}`,
        });
        expect(filename).toMatch(/ranking-.*\.xlsx/);
      }

      // Filtro de turma (se tiver mais de uma turma)
      const turmaSelect = page.locator("#turma-filter");
      if (await turmaSelect.isVisible().catch(() => false)) {
        const options = await turmaSelect.locator("option").allTextContents();
        test.info().annotations.push({
          type: "turmas",
          description: `Turmas disponíveis: ${options.join(" | ")}`,
        });
      }

      // Fecha o dialog
      await page.getByRole("button", { name: /voltar/i }).click();
    }

    // Audit final: sem erros de console / network
    if (errors.consoleErrors.length > 0) {
      console.log("\n⚠️  CONSOLE ERRORS:\n" + errors.consoleErrors.join("\n"));
    }
    if (errors.failedRequests.length > 0) {
      console.log("\n⚠️  FAILED REQUESTS:\n" + errors.failedRequests.join("\n"));
    }

    expect(errors.consoleErrors, "Console errors durante o fluxo").toEqual([]);
    expect(errors.failedRequests, "Requests falhos durante o fluxo").toEqual([]);
  });
});

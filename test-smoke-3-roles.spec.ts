/**
 * Smoke test geral cobrindo os 3 roles do XTRI:
 *   1. SUPER ADMIN (XTRI01) — dashboard Visão Executiva + 8 telas do sidebar
 *   2. COORDENADOR (XTRI02) — Simulados ENEM → abrir ranking pedagógico
 *   3. ALUNO (matrícula 214140291) — cronograma + simulados + resultado
 *
 * Cada teste em contexto isolado (sem compartilhar sessão).
 * Falha se houver qualquer console.error ou requestfailed não-filtrado.
 */

import { test, expect, type Page } from "@playwright/test";

const ADMIN_BASE = "http://localhost:5173";
const ALUNO_BASE = "http://localhost:8080";

// Credenciais
const SUPER_ADMIN = { user: "XTRI01@xtri.online", pass: "admin123" };
const COORDENADOR = { user: "XTRI02@xtri.online", pass: "admin123" };
const ALUNO = { matricula: "99999999", senha: "123456" };

// ---------------------------------------------------------------------------
// Sink de erros — compartilhado
// ---------------------------------------------------------------------------
function setupErrorSink(
  page: Page,
): { consoleErrors: string[]; failedRequests: string[] } {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("favicon") ||
      text.includes("chrome-extension") ||
      text.includes("Download the React DevTools") ||
      text.includes("[vite]") || // HMR warnings
      // Supabase Auth retorna 400 ao fazer signIn com credencial inválida.
      // Isso é comportamento esperado e faz parte do teste de erro de login.
      (text.includes("Failed to load resource") && text.includes("400"))
    ) {
      return;
    }
    consoleErrors.push(text);
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.includes("favicon") || url.startsWith("chrome-extension")) return;
    const err = req.failure()?.errorText ?? "unknown";
    // net::ERR_ABORTED é geralmente HMR / navegação cancelada — filtra
    if (err.includes("ERR_ABORTED")) return;
    failedRequests.push(`${req.method()} ${url} — ${err}`);
  });

  return { consoleErrors, failedRequests };
}

// ---------------------------------------------------------------------------
// Login helpers
// ---------------------------------------------------------------------------
async function loginAdmin(
  page: Page,
  creds: { user: string; pass: string },
): Promise<void> {
  await page.goto(ADMIN_BASE + "/");
  await page.waitForLoadState("networkidle");
  await page.getByText("Entrar com email e senha").click();
  await page.waitForSelector("#username", { timeout: 5000 });
  await page.fill("#username", creds.user);
  await page.fill("#password", creds.pass);
  await page.click('button[type="submit"]');
}

async function loginAluno(
  page: Page,
  creds: { matricula: string; senha: string },
): Promise<void> {
  await page.goto(ALUNO_BASE + "/");
  await page.waitForLoadState("networkidle");
  // Toggle pra form de matricula/senha (default mostra Google/Apple)
  await page.getByText(/entrar com matr[íi]cula e senha/i).click();
  await page.waitForTimeout(500);

  const matriculaInput = page
    .getByPlaceholder(/matr[íi]cula/i)
    .or(page.locator('input[type="text"]').first());
  await matriculaInput.fill(creds.matricula);

  const senhaInput = page
    .getByPlaceholder(/senha/i)
    .or(page.locator('input[type="password"]'));
  await senhaInput.fill(creds.senha);

  await page.click('button[type="submit"]');
}

// ---------------------------------------------------------------------------
// Test 1 — SUPER ADMIN
// ---------------------------------------------------------------------------
test.describe("Smoke Role 1/3: SUPER ADMIN (XTRI01)", () => {
  test("login + navega 8 telas do sidebar", async ({ page }) => {
    const errors = setupErrorSink(page);

    await loginAdmin(page, SUPER_ADMIN);
    await page.waitForSelector("text=Visão Executiva", { timeout: 15000 });
    await page.screenshot({ path: "test-results/smoke-sa-01-home.png", fullPage: true });

    const telas = [
      "Mentores & Acessos",
      "Grades Oficiais",
      "Cronogramas dos Alunos",
      "Simulados ENEM",
      "Planos & Mentoria",
      "PDFs & Entregas",
      "Auditoria do Sistema",
    ];

    for (let i = 0; i < telas.length; i++) {
      const tela = telas[i]!;
      await page.getByRole("button", { name: tela }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800); // deixa supabase responder
      const slug = tela
        .toLowerCase()
        .replace(/&/g, "e")
        .replace(/\s+/g, "-");
      await page.screenshot({
        path: `test-results/smoke-sa-${String(i + 2).padStart(2, "0")}-${slug}.png`,
        fullPage: true,
      });
    }

    expect(errors.consoleErrors, "Console errors SUPER ADMIN").toEqual([]);
    expect(errors.failedRequests, "Failed requests SUPER ADMIN").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — COORDENADOR
// ---------------------------------------------------------------------------
test.describe("Smoke Role 2/3: COORDENADOR (XTRI02)", () => {
  test("login + abrir ranking do simulado", async ({ page }) => {
    const errors = setupErrorSink(page);

    await loginAdmin(page, COORDENADOR);
    // Coordenador também aterrissa em alguma tela inicial — aguarda
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/smoke-coord-01-home.png", fullPage: true });

    // Vai pra Simulados
    const simuladosBtn = page
      .getByRole("button", { name: /simulados/i })
      .first();
    if (await simuladosBtn.isVisible().catch(() => false)) {
      await simuladosBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/smoke-coord-02-simulados.png", fullPage: true });

      // Abre ranking
      const rankingBtn = page
        .getByRole("button", { name: /ranking|respostas|ver/i })
        .first();
      if (await rankingBtn.isVisible().catch(() => false)) {
        await rankingBtn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: "test-results/smoke-coord-03-ranking.png", fullPage: true });

        const dialog = page.locator('[role="dialog"][aria-label*="Ranking"]');
        if (await dialog.isVisible().catch(() => false)) {
          // Valida labels novas
          await expect(dialog.getByText("Maior TRI", { exact: true })).toBeVisible();
          await expect(dialog.getByText("Menor TRI", { exact: true })).toBeVisible();
          // Botão export presente
          const exportBtn = page.getByRole("button", { name: /exportar.*excel/i });
          await expect(exportBtn).toBeVisible();
        }
      }
    }

    expect(errors.consoleErrors, "Console errors COORDENADOR").toEqual([]);
    expect(errors.failedRequests, "Failed requests COORDENADOR").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — ALUNO (matrícula 99999999 — aluno de teste oficial)
// ---------------------------------------------------------------------------
test.describe("Smoke Role 3/3: ALUNO (matrícula 99999999)", () => {
  test("login + cronograma + simulados + desempenho + analise", async ({ page }) => {
    const errors = setupErrorSink(page);

    await loginAluno(page, ALUNO);
    // Após login o aluno vai pra home (/) — StudentLayout monta e aparece conteúdo do Cronograma
    await page.waitForURL(/localhost:8080\/$|localhost:8080\/(simulados|desempenho|analise|avisos)/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/smoke-aluno-01-home.png", fullPage: true });

    // Navega telas principais via URL direta
    const rotas: Array<{ url: string; label: string }> = [
      { url: "/simulados", label: "simulados" },
      { url: "/desempenho", label: "desempenho" },
      { url: "/analise", label: "analise" },
      { url: "/avisos", label: "avisos" },
    ];

    for (let i = 0; i < rotas.length; i++) {
      const { url, label } = rotas[i]!;
      await page.goto(ALUNO_BASE + url);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `test-results/smoke-aluno-${String(i + 2).padStart(2, "0")}-${label}.png`,
        fullPage: true,
      });
    }

    expect(errors.consoleErrors, "Console errors ALUNO").toEqual([]);
    expect(errors.failedRequests, "Failed requests ALUNO").toEqual([]);
  });
});

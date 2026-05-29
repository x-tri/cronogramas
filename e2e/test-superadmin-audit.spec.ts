/**
 * E2E smoke do painel Super Admin (XTRI01).
 *
 * Navega pelas 8 telas do sidebar super_admin:
 *  1. Visão Executiva (overview)
 *  2. Mentores & Acessos (coordinators)
 *  3. Grades Oficiais (schedules)
 *  4. Cronogramas dos Alunos (control)
 *  5. Simulados ENEM (simulados)
 *  6. Planos & Mentoria (performance)
 *  7. PDFs & Entregas (pdfs)
 *  8. Auditoria do Sistema (audit)
 *
 * Para cada tela: aguarda carregar, captura screenshot fullPage, verifica
 * ausência de texto de erro visível. Acumula console.errors e requestfailed
 * filtrando ruído. Falha se houver erros ao final.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:5173";
const LOGIN_USER = "XTRI01@xtri.online";
const LOGIN_PASS = "admin123";

interface ScreenResult {
  readonly label: string;
  readonly status: "ok" | "warning" | "error";
  readonly notes: string;
}

interface ErrorSink {
  readonly consoleErrors: string[];
  readonly failedRequests: string[];
}

const NOISE_PATTERNS: readonly string[] = [
  "favicon",
  "chrome-extension",
  "Download the React DevTools",
  "Download the Apollo DevTools",
  "[vite]",
  "React Router Future Flag",
  // Vite HMR occasionally logs websocket retries — not a product bug
  "WebSocket connection to 'ws://localhost:5173",
];

function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((pat) => text.includes(pat));
}

function setupErrorSink(page: Page): ErrorSink {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNoise(text)) return;
    consoleErrors.push(text);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (isNoise(url)) return;
    const failure = request.failure();
    // Ignore aborted requests (page navigation cancels in-flight)
    if (failure?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(`${request.method()} ${url} — ${failure?.errorText ?? ""}`);
  });

  return { consoleErrors, failedRequests };
}

async function fazerLogin(page: Page): Promise<void> {
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  await page.getByText("Entrar com email e senha").click();
  await page.waitForSelector("#username", { timeout: 5000 });
  await page.fill("#username", LOGIN_USER);
  await page.fill("#password", LOGIN_PASS);
  await page.click('button[type="submit"]');
  // XTRI01 é super_admin — aterrissa em "Visão Executiva"
  await page.waitForSelector("text=Visão Executiva", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function checkForVisibleErrorText(page: Page): Promise<string | null> {
  // Detecta banners/textos de erro comuns — mas ignora labels legítimos
  // como "Erro" em colunas de tabela de auditoria.
  const patterns: readonly RegExp[] = [
    /falha ao carregar/i,
    /erro ao carregar/i,
    /something went wrong/i,
    /request failed/i,
    /Error Boundary/i,
  ];
  for (const pat of patterns) {
    const loc = page.getByText(pat).first();
    if (await loc.isVisible().catch(() => false)) {
      return (await loc.textContent()) ?? pat.source;
    }
  }
  return null;
}

async function navigateAndCapture(
  page: Page,
  sidebarLabel: string,
  screenshotName: string,
): Promise<ScreenResult> {
  try {
    // Sidebar: procura pelo botão com o label exato. Em md+ o label é visível;
    // em telas menores só o ícone aparece — mas como estamos em headless
    // desktop, md+ sempre é verdadeiro.
    const navBtn = page.getByRole("button", { name: sidebarLabel, exact: true }).first();
    await navBtn.click({ timeout: 10000 });
    // Espera header atualizar para o título da tela
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      // networkidle nem sempre ocorre se houver polling — seguir em frente
    });
    await page.waitForTimeout(1500); // deixa Supabase + lazy chunk terminarem
    await page.screenshot({ path: `test-results/${screenshotName}.png`, fullPage: true });

    const errorText = await checkForVisibleErrorText(page);
    if (errorText) {
      return {
        label: sidebarLabel,
        status: "error",
        notes: `Texto de erro visível: ${errorText.slice(0, 120)}`,
      };
    }
    return { label: sidebarLabel, status: "ok", notes: "" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      label: sidebarLabel,
      status: "error",
      notes: `Exceção na navegação: ${msg.slice(0, 200)}`,
    };
  }
}

test.describe("Auditoria Super Admin XTRI01 — smoke de 8 telas", () => {
  test("loga e navega pelas 8 telas do sidebar sem erros visíveis", async ({ page }) => {
    const errors = setupErrorSink(page);
    const results: ScreenResult[] = [];

    await fazerLogin(page);
    await page.screenshot({
      path: "test-results/sa-00-logged-in.png",
      fullPage: true,
    });
    // Overview: já renderizado após o login
    await page.waitForTimeout(1500);
    const overviewErr = await checkForVisibleErrorText(page);
    results.push({
      label: "Visão Executiva",
      status: overviewErr ? "error" : "ok",
      notes: overviewErr ?? "landing após login",
    });
    await page.screenshot({
      path: "test-results/sa-01-overview.png",
      fullPage: true,
    });

    const telas: ReadonlyArray<{ label: string; shot: string }> = [
      { label: "Mentores & Acessos", shot: "sa-02-mentores" },
      { label: "Grades Oficiais", shot: "sa-03-grades" },
      { label: "Cronogramas dos Alunos", shot: "sa-04-cronogramas" },
      { label: "Simulados ENEM", shot: "sa-05-simulados" },
      { label: "Planos & Mentoria", shot: "sa-06-planos" },
      { label: "PDFs & Entregas", shot: "sa-07-pdfs" },
      { label: "Auditoria do Sistema", shot: "sa-08-auditoria" },
    ];

    for (const t of telas) {
      const r = await navigateAndCapture(page, t.label, t.shot);
      results.push(r);
    }

    // Log consolidado
    console.log("\n=== Resultado por tela ===");
    for (const r of results) {
      console.log(`[${r.status.toUpperCase()}] ${r.label} — ${r.notes || "OK"}`);
    }

    if (errors.consoleErrors.length > 0) {
      console.log("\n⚠️  CONSOLE ERRORS (" + errors.consoleErrors.length + "):");
      for (const e of errors.consoleErrors) console.log(" - " + e);
    }
    if (errors.failedRequests.length > 0) {
      console.log("\n⚠️  FAILED REQUESTS (" + errors.failedRequests.length + "):");
      for (const r of errors.failedRequests) console.log(" - " + r);
    }

    // Falha se alguma tela reportou erro visível
    const errorScreens = results.filter((r) => r.status === "error");
    expect(errorScreens, `Telas com erro visível: ${errorScreens.map((e) => e.label).join(", ")}`)
      .toEqual([]);

    // Falha se houve console.error não filtrado
    expect(errors.consoleErrors, "Console errors durante smoke").toEqual([]);

    // Falha se houve requests falhos
    expect(errors.failedRequests, "Requests falhos durante smoke").toEqual([]);
  });
});

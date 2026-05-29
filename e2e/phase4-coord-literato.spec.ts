/**
 * Phase 4 E2E — LITERATO coordinator flow for "Consultar histórico TRI".
 *
 * Valida:
 *   1) Fluxo positivo — coord LITERATO consulta matrícula 101295 (LITERATO)
 *      e enxerga histórico TRI real com LC current=779.
 *   2) Segurança cross-school — coord LITERATO tenta consultar matrícula
 *      001-014515 (aluna da Dom Bosco). A consulta é bloqueada:
 *      a busca em students é filtrada por school_id (effectiveSchoolId),
 *      portanto a UI exibe "Aluno não encontrado nesta escola" e o
 *      drawer nunca abre.
 *
 * Credenciais:
 *   - xtri03@xtri.online / coord123 (role: coordinator, school: LITERATO)
 */
import { expect, test } from "@playwright/test";

const ADMIN_URL = "http://localhost:8082";
const SCREENSHOT_DIR = "test-results-phase4-coord-literato";

const CREDS = {
  email: "xtri03@xtri.online",
  password: "coord123",
};

// Matriculas de teste
const LITERATO_STUDENT = {
  matricula: "101295",
  name: "JOAO LUCAS VIEIRA LIMA",
  expected_lc_current: 779,
  expected_simulados: 2,
};

const DOM_BOSCO_STUDENT = {
  matricula: "001-014515",
  name: "MARÍLIA SIMÕES LOPES",
};

/**
 * Helper: realiza login no painel admin/coord cronogramas.
 */
async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(ADMIN_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /entrar com email/i }).click();
  await page.locator("#username").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  // Login finaliza quando o form some da tela
  await expect(page.locator("#username")).not.toBeVisible({ timeout: 25_000 });
  // Beat para React renderizar dashboard
  await page.waitForTimeout(1500);
}

/**
 * Helper: abre a aba "Simulados ENEM" — coord tem toggle no header.
 */
async function openSimuladosEnem(
  page: import("@playwright/test").Page,
): Promise<void> {
  const simuladosLink = page
    .getByRole("button", { name: /simulados.*enem/i })
    .or(page.getByRole("link", { name: /simulados.*enem/i }))
    .or(page.locator("button,a,[role=tab]").filter({ hasText: /simulados/i }))
    .first();
  await expect(simuladosLink).toBeVisible({ timeout: 10_000 });
  await simuladosLink.click();
  // Aguarda a tool bar com o lookup estar visível
  await expect(page.getByTestId("tri-lookup-input")).toBeVisible({
    timeout: 8_000,
  });
}

test.describe("Phase 4 E2E — coord LITERATO histórico TRI", () => {
  test.setTimeout(60_000);

  test("coord LITERATO: consulta matrícula 101295 e abre drawer TRI com dados reais", async ({
    page,
  }) => {
    // Capture JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
    });

    await login(page, CREDS.email, CREDS.password);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/00-coord-home.png`,
      fullPage: true,
    });

    await openSimuladosEnem(page);

    // Consulta aluno LITERATO
    const lookupInput = page.getByTestId("tri-lookup-input");
    await lookupInput.fill(LITERATO_STUDENT.matricula);
    await page.getByTestId("tri-lookup-btn").click();

    // Drawer abre
    const drawer = page.getByTestId("tri-history-drawer");
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    // Conteúdo carrega — cards por área
    await expect(page.getByTestId("admin-area-lc")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("admin-area-ch")).toBeVisible();
    await expect(page.getByTestId("admin-area-cn")).toBeVisible();
    await expect(page.getByTestId("admin-area-mt")).toBeVisible();

    // Nome do aluno
    await expect(drawer).toContainText(LITERATO_STUDENT.name);

    // LC atual = 779 (valor real do histórico LITERATO)
    const lcCard = page.getByTestId("admin-area-lc");
    await expect(lcCard).toContainText(String(LITERATO_STUDENT.expected_lc_current));

    // Número de simulados (2) — aparece no sub-título: "... · 2 simulados · fontes: legacy"
    await expect(drawer).toContainText(/2 simulados/i);

    // Fontes: apenas legacy (super_admin test já confirmou)
    await expect(drawer).toContainText(/fontes:\s*legacy/i);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-tri-drawer-101295.png`,
      fullPage: true,
    });

    // Fecha drawer
    await page.getByTestId("tri-drawer-close").click();
    await expect(drawer).not.toBeVisible({ timeout: 3000 });

    // Valida ausência de erros JS reais.
    // Filtra "Failed to load resource" generico — edge function pode retornar
    // 4xx durante fallback entre fontes (legacy vs cronogramas), o que nao
    // impacta a UI e eh capturado pelo try/catch do drawer.
    const real = errors.filter(
      (e) =>
        !/React Router Future Flag/i.test(e) &&
        !/\[plugin:vite:css\]/i.test(e) &&
        !/Download the React DevTools/i.test(e) &&
        !/ResizeObserver loop/i.test(e) &&
        !/Failed to load resource/i.test(e),
    );
    expect(real, `JS errors encontrados: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("coord LITERATO: bloqueia consulta cross-school de matrícula 001-014515 (Dom Bosco)", async ({
    page,
  }) => {
    await login(page, CREDS.email, CREDS.password);
    await openSimuladosEnem(page);

    // Coord tenta consultar matrícula de OUTRA escola
    const lookupInput = page.getByTestId("tri-lookup-input");
    await lookupInput.fill(DOM_BOSCO_STUDENT.matricula);
    await page.getByTestId("tri-lookup-btn").click();

    // UI deve mostrar erro explícito "Aluno não encontrado nesta escola"
    // (handleTriLookup filtra por effectiveSchoolId quando isSchoolScoped=true)
    await expect(
      page.getByText(/aluno não encontrado nesta escola/i),
    ).toBeVisible({ timeout: 8_000 });

    // Drawer NUNCA abre — TRI nunca chega a ser exposto para o coord.
    const drawer = page.getByTestId("tri-history-drawer");
    await expect(drawer).not.toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-cross-school-blocked.png`,
      fullPage: true,
    });
  });
});

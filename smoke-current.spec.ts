import { expect, test } from "@playwright/test";

const LOGIN_USER = "XTRI01@xtri.online";
const LOGIN_PASS = "admin123";
const COORDINATOR_USER = "XTRI02@xtri.online";
const COORDINATOR_PASS = "admin123";

test.describe("Smoke atual", () => {
  test("login inicial nao dispara sozinho", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Entrar com Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar com email e senha" }),
    ).toBeVisible();

    await page.waitForTimeout(3000);

    await expect(
      page.getByRole("button", { name: "Entrar com Google" }),
    ).toBeEnabled();
    await expect(page.locator("text=Conectando...")).toHaveCount(0);
    await expect(page.locator("text=Entrando...")).toHaveCount(0);
  });

  test("login por senha abre workspace principal", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Entrar com email e senha" }).click();
    await page.locator("#username").fill(LOGIN_USER);
    await page.locator("#password").fill(LOGIN_PASS);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Selecione um aluno." }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Abrir planejamento")).toBeVisible();
    await expect(page.locator("text=Aluno avulso ou XTRI")).toBeVisible();
  });

  test("login do coordenador abre workspace de mentoria", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Entrar com email e senha" }).click();
    await page.locator("#username").fill(COORDINATOR_USER);
    await page.locator("#password").fill(COORDINATOR_PASS);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Selecione um aluno." }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Abrir planejamento")).toBeVisible();
    await expect(page.locator("text=Aluno avulso ou XTRI")).toBeVisible();
    await expect(page.locator("text=Cronogramas dos Alunos")).toHaveCount(0);
  });
});

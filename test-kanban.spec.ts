import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

test('Kanban view screenshot', async ({ page }) => {
  test.setTimeout(60000)

  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
  await page.waitForTimeout(1000)

  const input = page.locator('input#matricula')
  await input.click()
  await input.clear()
  await input.pressSequentially(MATRICULA, { delay: 30 })
  await page.locator('button', { hasText: /^Buscar$/ }).first().click()
  await page.locator('.turno-banner').first().waitFor({ state: 'visible', timeout: 15000 })

  // Switch to Kanban view
  await page.locator('button', { hasText: /kanban/i }).click()
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'test-results/kanban-01-full.png', fullPage: true })

  // Switch back to Timeline for comparison
  await page.locator('button', { hasText: /timeline/i }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/kanban-02-timeline-compare.png', fullPage: true })
})

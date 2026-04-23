import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

test('Visual check - student info in history panel', async ({ page }) => {
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

  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/visual-header-student.png', fullPage: false })
})

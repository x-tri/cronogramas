import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

test('Audit panel with student data', async ({ page }) => {
  test.setTimeout(60000)

  page.on('console', msg => {
    if (msg.text().includes('[Audit]')) console.log('BROWSER:', msg.text())
  })

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

  // Click audit button
  const auditBtn = page.locator('button[title="Auditoria de cronogramas"]')
  await auditBtn.click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'test-results/audit-02-with-names.png', fullPage: true })

  // Read the table content
  const tableText = await page.locator('.overflow-y-auto').innerText()
  console.log('Table content (first 500):', tableText.substring(0, 500))
})

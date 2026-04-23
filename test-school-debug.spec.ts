import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140076' // CAMILA - one of the "Sem escola" students

test('Debug school join for a student', async ({ page }) => {
  test.setTimeout(60000)

  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('[getStudentByMatricula]') || t.includes('[Audit]') || t.includes('school'))
      console.log('BROWSER:', t)
  })

  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
  await page.waitForTimeout(1000)

  // Search for the student to see what getStudentByMatricula returns
  const input = page.locator('input#matricula')
  await input.click()
  await input.clear()
  await input.pressSequentially(MATRICULA, { delay: 30 })
  await page.locator('button', { hasText: /^Buscar$/ }).first().click()
  await page.waitForTimeout(3000)

  // Check console for school data
  console.log('Test done - check browser console output above')
})

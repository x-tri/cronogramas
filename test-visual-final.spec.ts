import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

test('Visual final: bloquear 3 slots + screenshot completo', async ({ page }) => {
  test.setTimeout(90000)

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text())
  })
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')

  // Login
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
  await page.waitForTimeout(1000)

  // Clear and fill matricula with native input setter to trigger React onChange
  const input = page.locator('input#matricula')
  await input.click()
  await input.clear()
  await input.pressSequentially(MATRICULA, { delay: 30 })
  await page.waitForTimeout(300)

  // Verify input value
  const inputVal = await input.inputValue()
  console.log('Input value:', inputVal)

  // Click Buscar (the search form button, not the header "Buscar aluno")
  const buscarBtn = page.locator('button', { hasText: /^Buscar$/ }).first()
  console.log('Buscar visible:', await buscarBtn.isVisible())
  await buscarBtn.click({ force: true })
  console.log('Clicked Buscar')

  // Wait for response
  await page.waitForTimeout(8000)

  // Check state
  const hasTimetable = await page.locator('.turno-banner').count()
  const pageText = await page.locator('body').innerText()
  console.log(`Turno banners: ${hasTimetable}`)
  console.log('Page text (first 300):', pageText.substring(0, 300))

  await page.screenshot({ path: 'test-results/final-00-after-buscar.png', fullPage: true })

  if (hasTimetable > 0) {
    await page.screenshot({ path: 'test-results/final-01-timetable-limpo.png', fullPage: true })

    // Bloqueia 3 slots vazios
    for (let i = 0; i < 3; i++) {
      const emptySlot = page.locator('.timetable-cell.empty').first()
      const visible = await emptySlot.isVisible().catch(() => false)
      if (!visible) break
      await emptySlot.click()
      await page.waitForTimeout(500)
      const blockBtn = page.locator('button', { hasText: /bloquear este horário/i })
      const btnVisible = await blockBtn.isVisible().catch(() => false)
      if (btnVisible) {
        await blockBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    const blockedCount = await page.locator('.timetable-cell.blocked').count()
    console.log(`✓ ${blockedCount} slots bloqueados`)
    await page.screenshot({ path: 'test-results/final-02-com-bloqueios.png', fullPage: true })
    const timetable = page.locator('.timetable-container')
    await timetable.screenshot({ path: 'test-results/final-03-timetable-only.png' })
  }
})

import { test, expect } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

async function loginAndSearch(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
  await page.locator('input#matricula').fill(MATRICULA)
  await page.locator('button', { hasText: /buscar/i }).first().click()
  await page.waitForTimeout(4000)
}

test('Bloquear + desbloquear um slot', async ({ page }) => {
  await loginAndSearch(page)

  // Captura console errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Conta slots bloqueados iniciais
  const initialBlocked = await page.locator('.timetable-cell.blocked').count()
  console.log(`Slots bloqueados iniciais: ${initialBlocked}`)

  // Encontra um slot vazio e clica
  const emptySlot = page.locator('.timetable-cell.empty').first()
  await expect(emptySlot).toBeVisible()

  await page.screenshot({ path: 'test-results/block-01-antes.png', fullPage: true })

  await emptySlot.click()
  await page.waitForTimeout(500)

  // Modal deve estar aberto
  const modal = page.locator('text=Novo Bloco')
  await expect(modal).toBeVisible()

  // Clica "Bloquear este horário"
  const blockBtn = page.locator('button', { hasText: /bloquear este horário/i })
  await expect(blockBtn).toBeVisible()
  await blockBtn.click()

  // Espera o bloqueio ser salvo
  await page.waitForTimeout(3000)

  // Log errors
  if (errors.length) {
    console.log('Erros no console:')
    errors.forEach(e => console.log(' -', e))
  }

  await page.screenshot({ path: 'test-results/block-02-apos-bloquear.png', fullPage: true })

  // Verifica se o slot foi bloqueado
  const afterBlocked = await page.locator('.timetable-cell.blocked').count()
  console.log(`Slots bloqueados após bloquear: ${afterBlocked}`)

  // Agora desbloqueia
  if (afterBlocked > 0) {
    const blockedSlot = page.locator('.timetable-cell.blocked').first()
    await blockedSlot.click()
    await page.waitForTimeout(2000)

    const finalBlocked = await page.locator('.timetable-cell.blocked').count()
    console.log(`Slots bloqueados após desbloquear: ${finalBlocked}`)

    await page.screenshot({ path: 'test-results/block-03-desbloqueado.png', fullPage: true })
  }
})

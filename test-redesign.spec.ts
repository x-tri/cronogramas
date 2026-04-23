import { test } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

async function fazerLogin(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
}

test.describe('Redesign Visual - Timeline Timetable', () => {

  test('1. Login e tela inicial', async ({ page }) => {
    await fazerLogin(page)
    await page.screenshot({ path: 'test-results/redesign-01-logado.png', fullPage: true })
    console.log('✓ Login OK')
  })

  test('2. Busca aluno + visualiza timetable', async ({ page }) => {
    await fazerLogin(page)

    // Busca aluno
    await page.locator('input#matricula').fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()
    await page.waitForTimeout(4000)

    await page.screenshot({ path: 'test-results/redesign-02-aluno-buscado.png', fullPage: true })

    // Verifica se o timetable está visível
    const turno = page.locator('.turno-banner').first()
    const temTurno = await turno.isVisible().catch(() => false)
    console.log(`✓ Banner de turno visível: ${temTurno}`)

    // Verifica se está no modo timeline
    const timetable = page.locator('.timetable-container').first()
    const temTimetable = await timetable.isVisible().catch(() => false)
    console.log(`✓ Timetable visível: ${temTimetable}`)

    // Scroll down para ver mais turnos
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/redesign-02b-scrolled.png', fullPage: true })
  })

  test('3. Abrir modal e ver botão Bloquear', async ({ page }) => {
    await fazerLogin(page)

    await page.locator('input#matricula').fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()
    await page.waitForTimeout(4000)

    // Clica em um slot vazio no timetable
    const emptySlot = page.locator('.timetable-cell.empty').first()
    const slotVisible = await emptySlot.isVisible().catch(() => false)
    console.log(`Slot vazio visível: ${slotVisible}`)

    if (slotVisible) {
      await emptySlot.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/redesign-03-modal-bloquear.png' })

      // Verifica botão de bloquear
      const blockBtn = page.locator('button', { hasText: /bloquear este horário/i })
      const temBtnBlock = await blockBtn.isVisible().catch(() => false)
      console.log(`✓ Botão "Bloquear este horário" visível: ${temBtnBlock}`)

      if (temBtnBlock) {
        // Clica para bloquear
        await blockBtn.click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'test-results/redesign-04-slot-bloqueado.png', fullPage: true })

        // Verifica se apareceu o ícone de bloqueado
        const blocked = page.locator('.timetable-cell.blocked')
        const blockedCount = await blocked.count()
        console.log(`✓ Slots bloqueados: ${blockedCount}`)
      }
    }
  })

  test('4. Desbloquear slot', async ({ page }) => {
    await fazerLogin(page)

    await page.locator('input#matricula').fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()
    await page.waitForTimeout(4000)

    // Verifica se tem slot bloqueado
    const blocked = page.locator('.timetable-cell.blocked').first()
    const temBloqueado = await blocked.isVisible().catch(() => false)
    console.log(`Slot bloqueado encontrado: ${temBloqueado}`)

    if (temBloqueado) {
      await blocked.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/redesign-05-desbloqueado.png', fullPage: true })

      const blockedCount = await page.locator('.timetable-cell.blocked').count()
      console.log(`✓ Slots bloqueados restantes: ${blockedCount}`)
    }
  })
})

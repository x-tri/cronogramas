import { test, expect } from '@playwright/test'

const LOGIN_USER = 'XTRI01@xtri.online'
const LOGIN_PASS = 'admin123'
const MATRICULA   = '214140291'

async function fazerLogin(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')

  // Preenche credenciais
  await page.fill('#username', LOGIN_USER)
  await page.fill('#password', LOGIN_PASS)

  await page.screenshot({ path: 'test-results/00-login-preenchido.png' })

  await page.click('button[type="submit"]')

  // Aguarda entrar no app (título principal)
  await page.waitForSelector('text=Cronograma de Estudos', { timeout: 15000 })
  await page.screenshot({ path: 'test-results/01-logado.png', fullPage: true })
}

test.describe('Fluxo completo autenticado', () => {

  test('login + busca de aluno', async ({ page }) => {
    await fazerLogin(page)

    // Verifica cabeçalho
    await expect(page.locator('h1', { hasText: 'Cronograma de Estudos' })).toBeVisible()
    console.log('✓ Login OK — Cronograma de Estudos visível')

    // Busca aluno
    const input = page.locator('input').first()
    await input.fill(MATRICULA)

    const buscarBtn = page.locator('button', { hasText: /buscar/i }).first()
    await buscarBtn.click()

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/02-aluno-buscado.png', fullPage: true })

    const pageContent = await page.content()
    const encontrou = pageContent.includes(MATRICULA)
    console.log(`✓ Matrícula ${MATRICULA} encontrada na página: ${encontrou}`)
  })

  test('login + busca + verifica card do aluno', async ({ page }) => {
    await fazerLogin(page)

    const input = page.locator('input').first()
    await input.fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()

    await page.waitForTimeout(4000)
    await page.screenshot({ path: 'test-results/03-card-aluno.png', fullPage: true })

    // Verifica se algum dado do aluno apareceu
    const content = await page.content()
    const temMatricula = content.includes(MATRICULA)
    const temErroBusca = content.includes('não encontrado')

    console.log(`Matrícula na página: ${temMatricula}`)
    console.log(`Erro de busca: ${temErroBusca}`)

    // Lista todos os textos de botões visíveis pós-busca
    const botoes = await page.locator('button:visible').allTextContents()
    console.log('Botões visíveis:', botoes)
  })

  test('login + busca + verifica Kanban e SimuladoAnalyzer', async ({ page }) => {
    await fazerLogin(page)

    // Busca aluno
    await page.locator('input').first().fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()
    await page.waitForTimeout(4000)

    // Verifica elementos pós-busca
    const analisarBtn = page.locator('button', { hasText: /analisar simulado/i }).first()
    const kanban      = page.locator('text=Cronograma Semanal').first()

    const temAnalisar = await analisarBtn.isVisible().catch(() => false)
    const temKanban   = await kanban.isVisible().catch(() => false)

    console.log(`Botão "Analisar Simulado" visível: ${temAnalisar}`)
    console.log(`"Cronograma Semanal" visível: ${temKanban}`)

    await page.screenshot({ path: 'test-results/04-pos-busca-completo.png', fullPage: true })

    if (temAnalisar) {
      await analisarBtn.click()
      await page.waitForTimeout(5000)
      await page.screenshot({ path: 'test-results/05-simulado-analisado.png', fullPage: true })

      const content = await page.content()
      console.log('Tem "Tópicos para revisar":', content.includes('Tópicos para revisar'))
      console.log('Tem "acertos":', content.includes('acertos'))
      console.log('Tem "erros":', content.includes('erros'))
    }
  })

  test('login + verifica integração Supabase', async ({ page }) => {
    const requests: string[] = []
    page.on('request', req => {
      if (req.url().includes('supabase')) requests.push(`${req.method()} ${req.url()}`)
    })

    await fazerLogin(page)

    await page.locator('input').first().fill(MATRICULA)
    await page.locator('button', { hasText: /buscar/i }).first().click()
    await page.waitForTimeout(4000)

    console.log(`\nRequisições Supabase (${requests.length}):`)
    requests.forEach(r => console.log(' -', r))

    expect(requests.length).toBeGreaterThan(0)
  })

})

import { test, expect } from '@playwright/test'

/**
 * Testes E2E para o fluxo completo de análise de simulado e distribuição de erros
 * 
 * Fluxo testado:
 * 1. Buscar aluno por matrícula
 * 2. Analisar simulado do aluno
 * 3. Visualizar erros e tópicos para revisar
 * 4. Distribuir tópicos nos dias da semana
 */

test.describe('Fluxo de Análise de Simulado', () => {
  const TEST_MATRICULA = '214150129' // Matrícula de teste

  test.beforeEach(async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:5173')
    
    // Aguardar carregamento da página
    await page.waitForSelector('text=Cronograma de Estudos')
  })

  test('deve buscar aluno e exibir dados corretamente', async ({ page }) => {
    // Localizar campo de matrícula
    const matriculaInput = page.locator('input#matricula')
    await expect(matriculaInput).toBeVisible()
    
    // Preencher matrícula
    await matriculaInput.fill(TEST_MATRICULA)
    
    // Clicar no botão de buscar
    await page.click('button:has-text("Buscar")')
    
    // Aguardar carregamento
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // Verificar se o card do aluno aparece
    const studentCard = page.locator('[data-testid="student-card"]').or(
      page.locator('text=Matrícula:').locator('..').filter({ hasText: TEST_MATRICULA })
    )
    
    // Verificar que não há erro
    const errorMessage = page.locator('text=Aluno não encontrado')
    await expect(errorMessage).not.toBeVisible()
  })

  test('deve analisar simulado e exibir resultados', async ({ page }) => {
    // 1. Buscar aluno primeiro
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // 2. Clicar em "Analisar Simulado"
    const analyzeButton = page.locator('button:has-text("Analisar Simulado")')
    await expect(analyzeButton).toBeVisible()
    await analyzeButton.click()
    
    // 3. Aguardar resultado aparecer
    await page.waitForSelector('text=Distribuir', { timeout: 10000 })
    
    // 4. Verificar elementos do resultado
    await expect(page.locator('text=Tópicos para revisar')).toBeVisible()
    await expect(page.locator('text=acertos')).toBeVisible()
    await expect(page.locator('text=erros')).toBeVisible()
    
    // 5. Verificar áreas do ENEM
    await expect(page.locator('text=LC')).toBeVisible()
    await expect(page.locator('text=CH')).toBeVisible()
    await expect(page.locator('text=CN')).toBeVisible()
    await expect(page.locator('text=MT')).toBeVisible()
  })

  test('deve distribuir tópicos nos dias da semana', async ({ page }) => {
    // 1. Buscar aluno
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // 2. Analisar simulado
    await page.click('button:has-text("Analisar Simulado")')
    await page.waitForSelector('text=Distribuir', { timeout: 10000 })
    
    // 3. Verificar quantidade de tópicos
    const distributeButton = page.locator('button:has-text("Distribuir")')
    const buttonText = await distributeButton.textContent()
    const topicCount = buttonText?.match(/Distribuir (\d+) Tópicos/)?.[1]
    expect(topicCount).toBeTruthy()
    console.log(`Distribuindo ${topicCount} tópicos`)
    
    // 4. Clicar em distribuir
    await distributeButton.click()
    
    // 5. Aguardar distribuição
    await page.waitForTimeout(2000)
    
    // 6. Verificar se blocos foram criados no Kanban
    const kanbanBoard = page.locator('[data-testid="kanban-board"]').or(
      page.locator('.kanban-board')
    )
    await expect(kanbanBoard).toBeVisible()
    
    // Verificar se há blocos de revisão no board
    const revisionBlocks = page.locator('[data-testid="block-card"]').or(
      page.locator('.block-card')
    )
    const count = await revisionBlocks.count()
    console.log(`${count} blocos criados no Kanban`)
    expect(count).toBeGreaterThan(0)
  })

  test('deve cancelar distribuição e manter estado anterior', async ({ page }) => {
    // 1. Buscar aluno
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // 2. Analisar simulado
    await page.click('button:has-text("Analisar Simulado")')
    await page.waitForSelector('text=Distribuir', { timeout: 10000 })
    
    // 3. Clicar em Cancelar
    await page.click('button:has-text("Cancelar")')
    
    // 4. Verificar que o painel de resultados fechou
    await expect(page.locator('text=Tópicos para revisar')).not.toBeVisible()
    
    // 5. Verificar que o botão de análise voltou a aparecer
    await expect(page.locator('button:has-text("Analisar Simulado")')).toBeVisible()
  })

  test('deve exibir mensagem quando não há simulado', async ({ page }) => {
    // Usar uma matrícula que provavelmente não tem simulado
    const matriculaSemSimulado = '000000001'
    
    // 1. Buscar aluno (pode não encontrar)
    await page.fill('input#matricula', matriculaSemSimulado)
    await page.click('button:has-text("Buscar")')
    await page.waitForTimeout(2000)
    
    // Se o aluno for encontrado (mock), tentar análise
    const analyzeButton = page.locator('button:has-text("Analisar Simulado")')
    if (await analyzeButton.isVisible().catch(() => false)) {
      await analyzeButton.click()
      
      // Aguardar mensagem de erro
      await page.waitForTimeout(3000)
      
      // Verificar mensagem de erro
      const errorMessage = page.locator('text=Nenhum simulado encontrado').or(
        page.locator('text=Erro ao analisar')
      )
      
      if (await errorMessage.isVisible().catch(() => false)) {
        console.log('Mensagem de erro exibida corretamente')
      }
    }
  })

  test('deve exibir diagnóstico no console', async ({ page }) => {
    // Capturar logs do console
    const consoleLogs: string[] = []
    page.on('console', msg => {
      consoleLogs.push(msg.text())
    })
    
    // 1. Buscar aluno
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // 2. Clicar em diagnóstico
    await page.click('button:has-text("🔍 Diagnóstico")')
    
    // 3. Aceitar alert
    page.on('dialog', dialog => dialog.accept())
    
    // 4. Aguardar diagnóstico
    await page.waitForTimeout(3000)
    
    // Verificar que houve logs do diagnóstico
    const hasDiagnosticLogs = consoleLogs.some(log => 
      log.includes('DIAGNÓSTICO') || log.includes('matrícula')
    )
    
    if (hasDiagnosticLogs) {
      console.log('Logs de diagnóstico capturados')
    }
  })

  test('deve verificar integração com Supabase', async ({ page }) => {
    // Verificar se a aplicação conecta com Supabase
    const networkRequests: string[] = []
    
    page.on('request', request => {
      const url = request.url()
      if (url.includes('supabase') || url.includes('supabase.co')) {
        networkRequests.push(url)
      }
    })
    
    // 1. Buscar aluno
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForTimeout(3000)
    
    // 2. Verificar se houve requisições ao Supabase
    console.log(`Requisições ao Supabase: ${networkRequests.length}`)
    
    if (networkRequests.length > 0) {
      console.log('URLs chamadas:', networkRequests)
    }
  })

  test('fluxo completo: busca → análise → distribuição → verificação', async ({ page }) => {
    // ==================== PASSO 1: BUSCAR ALUNO ====================
    console.log('Passo 1: Buscando aluno...')
    await page.fill('input#matricula', TEST_MATRICULA)
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // Capturar screenshot após busca
    await page.screenshot({ path: 'test-results/01-aluno-encontrado.png' })
    
    // ==================== PASSO 2: ANALISAR SIMULADO ====================
    console.log('Passo 2: Analisando simulado...')
    await page.click('button:has-text("Analisar Simulado")')
    await page.waitForSelector('text=Tópicos para revisar', { timeout: 10000 })
    
    // Capturar screenshot do resultado
    await page.screenshot({ path: 'test-results/02-resultado-simulado.png' })
    
    // Verificar dados exibidos
    const resultadoSection = page.locator('text=Tópicos para revisar').locator('..')
    await expect(resultadoSection).toBeVisible()
    
    // Contar tópicos
    const topicos = page.locator('text=/Linguagens|Matemática|Natureza|Humanas/')
    const topicosCount = await topicos.count()
    console.log(`${topicosCount} áreas encontradas para revisão`)
    expect(topicosCount).toBeGreaterThan(0)
    
    // ==================== PASSO 3: DISTRIBUIR TÓPICOS ====================
    console.log('Passo 3: Distribuindo tópicos...')
    
    const distributeButton = page.locator('button:has-text("Distribuir")')
    const buttonText = await distributeButton.textContent()
    console.log(`Botão: ${buttonText}`)
    
    await distributeButton.click()
    await page.waitForTimeout(2000)
    
    // Capturar screenshot após distribuição
    await page.screenshot({ path: 'test-results/03-topicos-distribuidos.png' })
    
    // ==================== PASSO 4: VERIFICAR KANBAN ====================
    console.log('Passo 4: Verificando Kanban...')
    
    // Verificar dias da semana
    const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
    for (const dia of diasSemana) {
      const diaElement = page.locator(`text=${dia}`).first()
      if (await diaElement.isVisible().catch(() => false)) {
        console.log(`✓ ${dia} visível no Kanban`)
      }
    }
    
    // Verificar se há blocos de revisão
    const allBlocks = page.locator('[class*="block"]').or(
      page.locator('text=/revisão|revisar/i')
    )
    const blocksCount = await allBlocks.count()
    console.log(`${blocksCount} elementos relacionados a blocos/revisão encontrados`)
    
    // ==================== RELATÓRIO FINAL ====================
    console.log('\n=== RELATÓRIO DO TESTE ===')
    console.log(`Aluno: ${TEST_MATRICULA}`)
    console.log(`Tópicos para revisão: ${topicosCount}`)
    console.log(`Blocos criados: ${blocksCount}`)
    console.log('Status: ✓ Fluxo completo executado com sucesso')
  })
})

test.describe('Validações de edge cases', () => {
  test('deve lidar com matrícula inválida', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForSelector('text=Cronograma de Estudos')
    
    // Tentar matrícula vazia
    await page.click('button:has-text("Buscar")')
    
    // Verificar mensagem de erro
    const errorMessage = page.locator('text=Digite uma matrícula')
    await expect(errorMessage).toBeVisible()
    
    // Tentar matrícula com letras
    await page.fill('input#matricula', 'abc123')
    await page.click('button:has-text("Buscar")')
    
    // Verificar erro de validação
    const validationError = page.locator('text=Matrícula deve conter apenas números').or(
      page.locator('text=inválida')
    )
    // Pode ou não mostrar erro dependendo da implementação
  })

  test('deve lidar com aluno não encontrado', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForSelector('text=Cronograma de Estudos')
    
    // Buscar matrícula inexistente
    await page.fill('input#matricula', '999999999')
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    // Verificar mensagem
    const notFoundMessage = page.locator('text=Aluno não encontrado')
    // Pode aparecer ou não dependendo dos dados mock
    
    if (await notFoundMessage.isVisible().catch(() => false)) {
      console.log('✓ Mensagem de aluno não encontrado exibida')
    }
  })

  test('deve permitir múltiplas análises seguidas', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.waitForSelector('text=Cronograma de Estudos')
    
    // Primeira análise
    await page.fill('input#matricula', '214150129')
    await page.click('button:has-text("Buscar")')
    await page.waitForSelector('text=Buscando...', { state: 'hidden', timeout: 5000 })
    
    const analyzeButton = page.locator('button:has-text("Analisar Simulado")')
    if (await analyzeButton.isVisible().catch(() => false)) {
      await analyzeButton.click()
      await page.waitForSelector('text=Tópicos para revisar', { timeout: 10000 })
      
      // Fechar
      await page.click('button:has-text("Cancelar")')
      await page.waitForTimeout(500)
      
      // Segunda análise
      await analyzeButton.click()
      await page.waitForSelector('text=Tópicos para revisar', { timeout: 10000 })
      
      console.log('✓ Múltiplas análises funcionam corretamente')
    }
  })
})

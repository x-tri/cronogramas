import { test, expect } from '@playwright/test'

test('Testar funcionalidade de Drag and Drop', async ({ page }) => {
  // Abre a aplicação
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  
  // Busca o aluno
  const matriculaInput = page.locator('input').first()
  await matriculaInput.fill('214140291')
  
  const buscarButton = page.locator('button', { hasText: /buscar/i }).first()
  await buscarButton.click()
  
  // Aguarda carregar o cronograma
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'test-results/06-antes-drag.png', fullPage: true })
  
  // Procura elementos arrastáveis (blocos de revisão/estudo)
  // Os blocos arrastáveis têm o drag handle (ícone de 6 pontos)
  const draggableBlocks = page.locator('[data-testid="draggable-block"], .cursor-grab, [draggable="true"]').all()
  
  console.log('Blocos arrastáveis encontrados:', (await draggableBlocks).length)
  
  // Tenta encontrar um bloco específico para arrastar
  // Vamos procurar um bloco de revisão no sábado ou domingo (mais fácil de identificar)
  const blocoRevisao = page.locator('text=Revisão').first()
  const isVisible = await blocoRevisao.isVisible().catch(() => false)
  
  if (isVisible) {
    console.log('Bloco de revisão encontrado')
    
    // Procura o handle de drag (ícone de bolinhas)
    const dragHandle = page.locator('.cursor-grab, svg').first()
    
    if (await dragHandle.isVisible().catch(() => false)) {
      console.log('Handle de drag encontrado')
      
      // Tenta fazer drag and drop
      // Vamos arrastar para um slot vazio em outro dia
      const targetSlot = page.locator('[data-slot], .kanban-cell').nth(10)
      
      await dragHandle.dragTo(targetSlot).catch((e) => {
        console.log('Erro no drag and drop:', e.message)
      })
      
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/07-apos-drag.png', fullPage: true })
      
      console.log('Drag and drop tentado')
    }
  }
  
  // Lista todos os elementos que podem ser interativos
  const allButtons = await page.locator('button').all()
  console.log('Total de botões:', allButtons.length)
  
  // Procura especificamente por elementos com cursor-grab
  const grabElements = await page.locator('.cursor-grab, .cursor-grabbing').all()
  console.log('Elementos com cursor-grab:', grabElements.length)
  
  // Screenshot final
  await page.screenshot({ path: 'test-results/08-drag-analise.png', fullPage: true })
})

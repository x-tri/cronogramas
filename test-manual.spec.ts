import { test, expect } from '@playwright/test'

test('Teste manual - Busca de aluno', async ({ page }) => {
  // Abre a aplicação
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  
  // Screenshot inicial
  await page.screenshot({ path: 'test-results/01-pagina-inicial.png', fullPage: true })
  
  // Procura o input de matrícula (pode ser por label ou placeholder)
  const matriculaInput = page.locator('input').first()
  await expect(matriculaInput).toBeVisible()
  
  // Digita a matrícula
  await matriculaInput.fill('214140291')
  await page.screenshot({ path: 'test-results/02-matricula-digitada.png' })
  
  // Clica no botão de buscar
  const buscarButton = page.locator('button', { hasText: /buscar/i }).first()
  await buscarButton.click()
  
  // Aguarda carregar
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/03-resultado-busca.png', fullPage: true })
  
  // Verifica se encontrou o aluno (procura o nome)
  const pageContent = await page.content()
  const encontrouNicole = pageContent.includes('Nicole') || pageContent.includes('214140291')
  
  console.log('Aluno encontrado:', encontrouNicole)
  console.log('URL atual:', page.url())
})

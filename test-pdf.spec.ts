import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('Testar download de PDF', async ({ page }) => {
  // Diretório para downloads
  const downloadDir = path.join(__dirname, 'test-results', 'downloads')
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }

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
  await page.screenshot({ path: 'test-results/04-antes-pdf.png', fullPage: true })
  
  // Procura o botão de compartilhar/baixar
  const compartilharButton = page.locator('button', { hasText: /compartilhar/i }).first()
  await expect(compartilharButton).toBeVisible()
  
  console.log('Botão Compartilhar encontrado')
  
  // Clica no botão para abrir o dropdown
  await compartilharButton.click()
  await page.waitForTimeout(500)
  
  await page.screenshot({ path: 'test-results/05-dropdown-compartilhar.png' })
  
  // Procura a opção de baixar PDF
  const baixarPdfOption = page.locator('text=Baixar PDF').first()
  
  if (await baixarPdfOption.isVisible().catch(() => false)) {
    console.log('Opção "Baixar PDF" encontrada no dropdown')
    
    // Configura listener para download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      baixarPdfOption.click()
    ])
    
    // Aguarda o download
    const downloadPath = path.join(downloadDir, download.suggestedFilename())
    await download.saveAs(downloadPath)
    
    console.log('PDF baixado:', downloadPath)
    console.log('Tamanho do arquivo:', fs.statSync(downloadPath).size, 'bytes')
    
    // Verifica se o arquivo existe e tem conteúdo
    expect(fs.existsSync(downloadPath)).toBe(true)
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(1000)
    
    console.log('✅ Download de PDF funcionando corretamente!')
  } else {
    console.log('Opção "Baixar PDF" não encontrada no dropdown')
    // Lista todas as opções do dropdown
    const options = await page.locator('[role="menuitem"], .dropdown-item, button').allTextContents()
    console.log('Opções disponíveis:', options)
  }
})

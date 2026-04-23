import { test } from '@playwright/test'

test('Login page visual check', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/login-page.png', fullPage: false })
})

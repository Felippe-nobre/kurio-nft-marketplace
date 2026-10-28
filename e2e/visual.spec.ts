import { test, expect, open, login, addFirstEditionToCart, fillCheckoutAndConnect } from './fixtures'
import type { Page } from '@playwright/test'

/** Regressão visual com dados determinísticos (seed fixo, latência zero, relógio fixo). */
async function stabilize(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    // Imagens lazy abaixo da dobra nunca carregariam: força o carregamento para a captura de página inteira.
    for (const img of document.images) if (img.loading === 'lazy') img.loading = 'eager'
    const pending = [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => ((i.onload = r), (i.onerror = r))))
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 10_000))])
  })
}
const mask = (page: Page) => [page.getByTestId('realtime-status'), page.locator('[data-sonner-toaster]')]

test.describe('Regressão visual @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-01T15:00:00-03:00'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('início', async ({ app: page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: mask(page) })
  })

  test('detalhe', async ({ app: page }) => {
    await open(page, '/nft/1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: mask(page) })
  })

  test('carrinho', async ({ app: page }) => {
    await addFirstEditionToCart(page, '1', 2)
    await addFirstEditionToCart(page, '5')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: mask(page) })
  })

  test('pagamento', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '1', 2)
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: mask(page) })
  })
})

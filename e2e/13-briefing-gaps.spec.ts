import { test, expect, open, login, server, addFirstEditionToCart, cartCount, fillCheckoutAndConnect } from './fixtures'

/**
 * Cenários do briefing sem cobertura nos demais grupos:
 * simulação de recusa e desconexão de carteira, e expiração de sessão durante o checkout.
 */
test.describe('13. Carteira (recusa e desconexão) e expiração durante o checkout', () => {
  test('recusa de conexão mostra o motivo; após aprovar, desconectar volta ao estado sem carteira', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '2')
    await open(page, '/checkout')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await server(page).setScenario({ walletConnect: 'reject' })
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByText('A conexão foi recusada na MetaMask.').first()).toBeVisible()
    await expect(page.getByTestId('wallet-connected')).toBeHidden()

    await server(page).setScenario({ walletConnect: 'approve' })
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByTestId('wallet-connected')).toBeVisible()
    await page.getByRole('button', { name: /Desconectar/ }).first().click()
    await expect(page.getByTestId('wallet-connected')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Conectar MetaMask' })).toBeVisible()
    // Desconectar não altera o carrinho.
    await expect(cartCount(page)).toHaveText('1')
  })

  test('sessão expira durante o checkout: pede login, preserva o carrinho e retorna ao checkout', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '1')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await server(page).expireSessions()
    await page.getByTestId('confirm-purchase').click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/Sua sessão expirou/).first()).toBeVisible()
    await login(page, 'ana', '/login')
    await expect(page).toHaveURL(/\/checkout/)
    await expect(cartCount(page)).toHaveText('1')
  })

  test('reflow em 320 px (equivale a zoom de 400%): sem rolagem horizontal e com o conteúdo principal visível', async ({ app: page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    for (const path of ['/', '/nft/1', '/cart']) {
      await open(page, path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${path} @320px`).toBeLessThanOrEqual(0)
    }
  })
})

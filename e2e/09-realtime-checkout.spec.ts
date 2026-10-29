import { test, expect, open, login, server, addFirstEditionToCart, fillCheckoutAndConnect } from './fixtures'

test.describe('9. Preço/disponibilidade via Socket.IO durante o checkout', () => {
  test('cenário obrigatório: atualização ao vivo, bloqueio por cotação desatualizada e nova confirmação @mobile', async ({ app: page }) => {
    await login(page)
    // 1. Adicionar um NFT ao carrinho
    await addFirstEditionToCart(page, '1')
    await expect(page.getByTestId('subtotal')).toHaveText('1.19 ETH')

    // 2/3. Preço muda no servidor enquanto o usuário navega → carrinho e resumo atualizam (evento nft.updated)
    await server(page).updateEdition('1', '1-50', { price: '1.25' })
    await expect(page.getByTestId('line-total')).toContainText('1.25 ETH')
    await expect(page.getByTestId('subtotal')).toHaveText('1.25 ETH')
    // A interface informa a alteração (aviso visível e região aria-live).
    await expect(page.getByTestId('cart-changed')).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('live-polite')).toContainText('Emerald Ape #042')

    // Checkout com a cotação nova
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await fillCheckoutAndConnect(page)
    await expect(page.getByTestId('total')).toHaveText('1.266 ETH')

    // 4. Nova mudança durante a revisão → confirmação bloqueada
    await server(page).updateEdition('1', '1-50', { price: '1.30' })
    await expect(page.getByTestId('quote-stale')).toContainText('Cotação desatualizada')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()

    // 5. Exigir nova confirmação: atualizar → aceitar → confirmar
    await page.getByRole('button', { name: 'Atualizar cotação' }).click()
    await expect(page.getByTestId('quote-stale')).toContainText('Os valores mudaram')
    await expect(page.getByTestId('total')).toHaveText('1.316 ETH')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    await page.getByRole('button', { name: /Aceitar nova cotação/ }).click()
    await expect(page.getByTestId('confirm-purchase')).toBeEnabled()
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.316 ETH')
  })

  test('preço alterado no servidor durante a confirmação exige nova confirmação', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '6')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await server(page).setScenario({ priceChangeOnConfirm: true })
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Os valores mudaram desde a sua revisão' })).toBeVisible()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    expect(await server(page).orders()).toHaveLength(0)
    await page.getByRole('button', { name: /Aceitar nova cotação/ }).click()
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
  })

  test('edição esgotada durante a compra bloqueia a finalização', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '8')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await server(page).setScenario({ soldOutOnConfirm: true })
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'não estão mais disponíveis' })).toBeVisible()
    await expect(page.getByText(/esgotou/)).toBeVisible()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
  })
})

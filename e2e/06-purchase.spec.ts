import { test, expect, open, login, server, addFirstEditionToCart, cartCount, fillCheckoutAndConnect } from './fixtures'

test.describe('6. Compra completa até o recibo confirmado', () => {
  test('carrinho → pagamento → pedido pendente → confirmado com recibo @mobile', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '1', 2)
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await fillCheckoutAndConnect(page)
    await expect(page.getByTestId('total')).toHaveText('2.396 ETH')
    await page.getByTestId('confirm-purchase').click()

    await expect(page).toHaveURL(/\/pedido\/ord_/)
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByTestId('order-confirmed')).toBeVisible()
    await expect(dialog.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
    await expect(dialog.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(dialog.getByTestId('tx-id')).toHaveText(/^0x[0-9A-F]{4}…[0-9A-F]{4}$/)
    await expect(cartCount(page)).toHaveText('0')

    // Recibo imutável: o catálogo muda depois, o recibo não.
    const orderUrl = page.url()
    await server(page).updateEdition('1', '1-50', { price: '9.99' })
    await page.goto(orderUrl)
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('receipt-line')).toContainText('2.38 ETH')
  })

  test('remove só as quantidades compradas quando o carrinho muda durante o pagamento', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ payment: 'manual' })
    await addFirstEditionToCart(page, '7', 1)
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderId = (await page.getByTestId('order-id').innerText()).trim()
    // Enquanto pendente, outro item igual entra no carrinho.
    await addFirstEditionToCart(page, '7', 2)
    await expect(cartCount(page)).toHaveText('3')
    await server(page).settleOrder(orderId, 'confirmed')
    await expect(cartCount(page)).toHaveText('2')
  })
})

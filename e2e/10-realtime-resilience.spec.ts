import { test, expect, open, login, server, addFirstEditionToCart, fillCheckoutAndConnect } from './fixtures'

test.describe('10. Eventos duplicados/antigos, desconexão e retomada de pedido pendente', () => {
  test('eventos duplicados e antigos são ignorados (sem regressão de estado)', async ({ app: page }) => {
    await open(page, '/nft/2')
    await expect(page.getByTestId('detail-price')).toContainText('1.69 ETH')
    await server(page).updateEdition('2', '1-50', { price: '1.80' }) // v2
    await expect(page.getByTestId('detail-price')).toContainText('1.80 ETH')
    const history = await server(page).history()
    const v2 = history.filter((e) => e.type === 'nft.updated' && e.resource.id === '2').at(-1)!
    // Evento antigo (versão 1, id novo) e duplicata do v2 com preço adulterado
    await server(page).emitRaw({ ...v2, eventId: 'evt_stale_1', version: 1, data: { ...v2.data, price: '0.01' } })
    await server(page).emitRaw({ ...v2, data: { ...v2.data, price: '0.02' } })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('detail-price')).toContainText('1.80 ETH')
    // Um evento realmente novo é aplicado
    await server(page).updateEdition('2', '1-50', { price: '1.85' })
    await expect(page.getByTestId('detail-price')).toContainText('1.85 ETH')
  })

  test('desconexão com pedido pendente: reconecta, reconcilia e não duplica após refresh @mobile', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ payment: 'manual' })
    await addFirstEditionToCart(page, '9')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderId = (await page.getByTestId('order-id').innerText()).trim()

    // 6. Interromper a conexão: o servidor fica inalcançável e o evento de confirmação se perde
    await server(page).setBlackout(true)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', /reconnecting|offline/)
    await server(page).settleOrder(orderId, 'confirmed')
    await page.waitForTimeout(300)

    // 7. Reconectar → reconciliação via REST recupera o estado
    await server(page).setBlackout(false)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected', { timeout: 10_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible()

    // Refresh: mesmo pedido, sem duplicação
    await page.reload()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/pedido/${orderId}$`))
    const orders = await server(page).orders()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ id: orderId, status: 'confirmed' })
  })

  test('refresh durante pedido pendente retoma o mesmo pedido; estado terminal não regride', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ payment: 'manual' })
    await addFirstEditionToCart(page, '3')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderId = (await page.getByTestId('order-id').innerText()).trim()
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await server(page).settleOrder(orderId, 'declined')
    await expect(page.getByTestId('order-declined')).toBeVisible()
    // Tentativa de "reconfirmar" no servidor é ignorada (terminal) e evento antigo não regride
    await server(page).settleOrder(orderId, 'confirmed')
    const history = await server(page).history()
    const first = history.find((e) => e.type === 'order.updated')
    if (first) await server(page).emitRaw({ ...first, eventId: 'evt_old_order', version: 1, data: { ...first.data, status: 'pending' } })
    await page.waitForTimeout(400)
    await expect(page.getByTestId('order-declined')).toBeVisible()
    // Checkout mostra o aviso de pedido em andamento apenas enquanto pendente
    await open(page, '/checkout')
    await expect(page.getByText('Você tem um pedido em andamento.')).toHaveCount(0)
  })
})

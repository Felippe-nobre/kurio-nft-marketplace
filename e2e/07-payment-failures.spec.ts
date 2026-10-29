import { test, expect, open, login, server, addFirstEditionToCart, cartCount, fillCheckoutAndConnect } from './fixtures'

test.describe('7. Recusa, clique repetido e timeout recuperado por idempotência', () => {
  test('pagamento recusado mantém o carrinho', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ payment: 'decline' })
    await addFirstEditionToCart(page, '2')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-declined')).toBeVisible()
    await expect(page.getByText(/Nenhum valor foi cobrado/)).toBeVisible()
    await expect(cartCount(page)).toHaveText('1')
  })

  test('clique duplo não duplica a compra', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ latency: 'fast' })
    await addFirstEditionToCart(page, '3')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').dblclick()
    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    expect((await server(page).orders()).length).toBe(1)
  })

  test('timeout após a criação do pedido é recuperado sem duplicar', async ({ app: page }) => {
    await login(page)
    await server(page).setScenario({ orderTimeoutAfterCreate: true, clientTimeoutMs: 1500 })
    await addFirstEditionToCart(page, '4')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await page.getByTestId('confirm-purchase').click()
    // 1ª tentativa estoura o timeout; o retry com a MESMA chave recupera o pedido.
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 15_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    const orders = await server(page).orders()
    expect(orders).toHaveLength(1)
  })

  test('falha de rede preserva o carrinho e nova tentativa reaproveita a chave', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '5')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    await server(page).setScenario({ failures: { 'POST /api/orders': { kind: 'network' } } })
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Não recebemos a confirmação' })).toBeVisible()
    await expect(cartCount(page)).toHaveText('1')
    expect(await server(page).orders()).toHaveLength(0)
    await server(page).setScenario({ failures: {} })
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    expect(await server(page).orders()).toHaveLength(1)
  })

  test('chave de idempotência: mesma tentativa recupera o pedido; conteúdo diferente gera conflito', async ({ app: page }) => {
    await login(page)
    await addFirstEditionToCart(page, '1')
    await open(page, '/checkout')
    await fillCheckoutAndConnect(page)
    // Captura a requisição real enviada pelo app (Axios → MSW).
    const sent = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/orders' && r.method() === 'POST')
    await page.getByTestId('confirm-purchase').click()
    const req = await sent
    const key = req.headers()['idempotency-key']
    const body = req.postData()!
    expect(key.length).toBeGreaterThanOrEqual(8)
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    const orderId = new URL(page.url()).pathname.split('/').pop()

    // Reenvio da mesma tentativa e da mesma chave com outro conteúdo, pelos handlers MSW.
    const result = await page.evaluate(
      async ({ key, body }) => {
        const { token } = JSON.parse(localStorage.getItem('kurio:session')!)
        const send = async (b: string) => {
          const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: b })
          return { status: r.status, replayed: r.headers.get('Idempotent-Replayed'), json: await r.json() }
        }
        const same = await send(body)
        const changed = JSON.parse(body)
        changed.network = changed.network === 'Ethereum' ? 'Polygon' : 'Ethereum'
        const diff = await send(JSON.stringify(changed))
        return { same, diff }
      },
      { key, body },
    )
    expect(result.same.status).toBe(200)
    expect(result.same.replayed).toBe('true')
    expect(result.same.json.id).toBe(orderId)
    expect(result.diff.status).toBe(409)
    expect(result.diff.json.code).toBe('IDEMPOTENCY_CONFLICT')
    expect(await server(page).orders()).toHaveLength(1)
  })
})

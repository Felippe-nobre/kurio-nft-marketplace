import { test, expect, open, server } from './fixtures'

test.describe('12. Skeletons, falha e recuperação', () => {
  test.use({ scenario: { latency: 'slow' } })

  test('skeleton durante latência, sem deslocamento de layout @mobile', async ({ app: page }) => {
    await page.goto('/')
    await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
    const box = await page.locator('#catalogo-grid').boundingBox()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })
    const after = await page.locator('#catalogo-grid').boundingBox()
    expect(Math.abs((after?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(2)

    await page.goto('/nft/1')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  })

  test('falha 500 mostra erro e nova tentativa recupera', async ({ app: page }) => {
    await open(page, '/nft/2')
    await server(page).setScenario({ latency: 'none', failures: { 'GET /api/nfts': { kind: '500' } } })
    await page.goto('/?q=Golden')
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Não foi possível carregar.' })).toBeVisible({ timeout: 10_000 })
    await server(page).setScenario({ failures: {} })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('timeout e falha de conexão também são tratados', async ({ app: page }) => {
    await open(page, '/nft/2')
    await server(page).setScenario({ latency: 'none', clientTimeoutMs: 800, failures: { 'GET /api/nfts/:id': { kind: 'timeout' } } })
    await page.goto('/nft/3')
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: /demorou para responder/ })).toBeVisible({ timeout: 15_000 })
    await server(page).setScenario({ failures: { 'GET /api/nfts/:id': { kind: 'network', times: 1 } } })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })).toBeVisible({ timeout: 10_000 })
  })
})

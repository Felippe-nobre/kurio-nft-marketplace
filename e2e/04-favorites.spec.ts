import { test, expect, login, open, server } from './fixtures'

test.describe('4. Favoritos com atualização otimista e rollback', () => {
  test('favoritar e desfavoritar persiste no servidor', async ({ app: page }) => {
    await login(page)
    await open(page, '/nft/2')
    const btn = page.getByRole('button', { name: 'Favoritar' })
    await btn.click()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
    await open(page, '/favorites')
    await expect(page.getByTestId('favorites-grid')).toContainText('Sage Nomad #009')
  })

  test('falha na mutation desfaz a alteração otimista', async ({ app: page }) => {
    await login(page)
    await open(page, '/nft/2')
    await server(page).setScenario({ latency: 'fast', failures: { 'PUT /api/favorites/:id': { kind: '500' } } })
    await page.getByRole('button', { name: 'Favoritar' }).click()
    // Otimista: muda imediatamente…
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
    // …e volta após a falha, com feedback acessível.
    await expect(page.getByRole('button', { name: 'Favoritar' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/A alteração foi desfeita/).first()).toBeVisible()
  })
})

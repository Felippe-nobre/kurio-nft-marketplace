import { test, expect, open, server } from './fixtures'

test.describe('2. Detalhe do NFT', () => {
  test('acesso direto, refresh e informações @mobile', async ({ app: page }) => {
    await open(page, '/nft/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('detail-price')).toContainText('1.19 ETH')
    await expect(page.getByText('ID do token:')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    // Troca de edição altera preço e disponibilidade
    await page.locator('label').filter({ has: page.getByRole('radio', { name: /^1\/10 / }) }).click()
    await expect(page.getByRole('radio', { name: /^1\/10 / })).toBeChecked()
    await expect(page.getByTestId('detail-price')).toContainText('2.38 ETH')
    // Galeria
    await page.getByRole('button', { name: 'Ver imagem 2 de 2' }).click()
    await expect(page.getByRole('button', { name: 'Ver imagem 2 de 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('NFT inexistente mostra mensagem e caminho de volta @mobile', async ({ app: page }) => {
    await open(page, '/nft/inexistente')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/#catalogo$|\/$/)
  })

  test('edição esgotada fica indisponível', async ({ app: page }) => {
    await open(page, '/nft/14')
    await expect(page.getByTestId('availability')).toContainText('esgotada')
    await expect(page.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  })

  test('limite de quantidade respeita a disponibilidade da edição', async ({ app: page }) => {
    await open(page, '/')
    await server(page).updateEdition('1', '1-50', { available: 3 })
    await open(page, '/nft/1')
    await expect(page.getByTestId('availability')).toContainText('3 de 50 disponíveis')
    const increase = page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })
    await increase.click()
    await increase.click()
    await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).locator('output')).toHaveText('3')
    await expect(increase).toBeDisabled()
  })
})

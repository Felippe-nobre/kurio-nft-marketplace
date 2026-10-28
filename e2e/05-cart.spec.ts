import { test, expect, open, login, cartCount, addFirstEditionToCart } from './fixtures'

test.describe('5. Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh @mobile', async ({ app: page }) => {
    await addFirstEditionToCart(page, '1', 2)
    await expect(cartCount(page)).toHaveText('2')
    await addFirstEditionToCart(page, '6')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByTestId('subtotal')).toHaveText('4.17 ETH') // 2×1.19 + 1.79

    await page.getByRole('button', { name: /Aumentar quantidade de Ivory Baron/ }).click()
    await expect(page.getByTestId('subtotal')).toHaveText('5.96 ETH')
    await page.getByRole('button', { name: /Diminuir quantidade de Emerald Ape/ }).click()
    await expect(page.getByTestId('subtotal')).toHaveText('4.77 ETH')

    // Cupons
    await page.getByLabel('Código promocional').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido.')).toBeVisible()
    await page.getByLabel('Código promocional').fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este cupom expirou.')).toBeVisible()
    await page.getByLabel('Código promocional').fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    await expect(page.getByTestId('discount')).toHaveText('(-) 0.477')
    await expect(page.getByTestId('total')).toHaveText('4.309 ETH') // 4.77 − 0.477 + 0.016

    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByTestId('coupon-applied')).toBeVisible()
    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('discount')).toHaveText('(-) 0.00')

    await page.getByRole('button', { name: /Remover Emerald Ape/ }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await page.getByRole('button', { name: /Remover Ivory Baron/ }).click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('itens do visitante são preservados (mesclados) no login', async ({ app: page }) => {
    await addFirstEditionToCart(page, '7')
    await expect(cartCount(page)).toHaveText('1')
    await login(page, 'ana')
    await open(page, '/cart')
    await expect(page.getByTestId('cart-line')).toContainText('Golden Beat #207')
    await expect(cartCount(page)).toHaveText('1')
  })
})

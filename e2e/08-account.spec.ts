import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, open, login } from './fixtures'

const here = path.dirname(fileURLToPath(import.meta.url))

test.describe('8. Perfil, avatar, senha e carteiras', () => {
  test('perfil: validação, conflito e atualização @mobile', async ({ app: page }) => {
    await login(page)
    await open(page, '/profile')
    const name = page.getByLabel('Nome de exibição')
    await name.fill('A')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    await name.fill('Ana Atualizada')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('bruno@kurio.test')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('main').getByText('Este e-mail já está em uso.')).toBeVisible()
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@kurio.test')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Perfil atualizado.' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Minha conta \(Ana Atualizada\)/ })).toBeVisible()
  })

  test('avatar: formato inválido e upload válido', async ({ app: page }) => {
    await login(page)
    await open(page, '/profile')
    const input = page.locator('#avatar-file')
    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(page.getByText('Use uma imagem PNG, JPG ou WebP.')).toBeVisible()
    await input.setInputFiles(path.join(here, '..', 'public', 'img', 'art', 'golden-beat.webp'))
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
  })

  test('senha: atual incorreta e alteração bem-sucedida', async ({ app: page }) => {
    await login(page)
    await open(page, '/profile')
    await page.getByLabel('Senha atual').fill('errada')
    await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
    await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()
    await page.getByLabel('Senha atual').fill('senha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Senha alterada com sucesso.' })).toBeVisible()
  })

  test('carteiras: endereço inválido, secundária, troca de principal e remoção @mobile', async ({ app: page }) => {
    await login(page)
    await open(page, '/wallets')
    await expect(page.getByTestId('wallet-card')).toHaveCount(1)
    await page.getByRole('button', { name: 'Adicionar' }).nth(1).click()
    const form = page.getByRole('form', { name: 'Nova carteira secundária' })
    await form.getByLabel('Apelido da carteira').fill('Reserva')
    await form.getByLabel('Rede').selectOption('Polygon')
    await form.getByLabel('Tipo de carteira').selectOption('WalletConnect')
    await form.getByLabel('Endereço da carteira').fill('0x123')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText(/Use 0x seguido de 40/)).toBeVisible()
    await form.getByLabel('Endereço da carteira').fill('0x' + 'b'.repeat(40))
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-card')).toHaveCount(2)

    await page.getByRole('button', { name: 'Tornar principal' }).click()
    await expect(page.getByRole('article', { name: 'Carteira Reserva' })).toContainText('Principal')
    await page.getByRole('button', { name: 'Remover carteira Cofre principal' }).click()
    await expect(page.getByTestId('wallet-card')).toHaveCount(1)
  })
})

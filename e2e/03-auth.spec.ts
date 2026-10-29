import { test, expect, open, login, server, USERS } from './fixtures'

test.describe('3. Cadastro, login, expiração, logout e troca de usuário', () => {
  test('cadastro com validação, conflito e sucesso @mobile', async ({ app: page }) => {
    await open(page, '/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(dialog.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(dialog.getByLabel('Nome de usuário')).toBeFocused()

    await dialog.getByLabel('Nome de usuário').fill('novo.colecionador')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email) // conflito
    await dialog.getByLabel('Senha', { exact: true }).fill('senha-forte-1')
    await dialog.getByLabel('Confirmar senha').fill('senha-forte-1')
    await dialog.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(dialog.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await dialog.getByLabel('E-mail').fill('novo@kurio.test')
    await dialog.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByRole('link', { name: /Minha conta \(novo.colecionador\)/ })).toBeVisible()
  })

  test('login inválido e retorno à página protegida após login', async ({ app: page }) => {
    await open(page, '/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill('errada123')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('E-mail ou senha inválidos')
    await dialog.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('sessão recuperada após refresh e expiração redireciona ao login', async ({ app: page }) => {
    await login(page)
    await open(page, '/profile')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

    await server(page).expireSessions()
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
    await expect(page.getByText(/Sua sessão expirou/).first()).toBeVisible()
    await login(page)
    await expect(page).toHaveURL(/\/wallets$/)
  })

  test('logout limpa dados privados e troca de usuário isola o cache', async ({ app: page }) => {
    await login(page, 'ana')
    await open(page, '/favorites')
    await expect(page.getByTestId('favorites-grid')).toContainText('Neon Vessel #552')
    await page.getByRole('button', { name: 'Sair da conta' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.goto('/favorites')
    await expect(page).toHaveURL(/\/login/)

    await login(page, 'bruno')
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByText('Você ainda não favoritou nenhum NFT.')).toBeVisible()
    await expect(page.getByText('Neon Vessel #552')).toHaveCount(0)
  })
})

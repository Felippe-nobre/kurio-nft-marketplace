import { test, expect, open, login } from './fixtures'

test.describe('11. Teclado, foco em diálogos e validação de formulários', () => {
  test('link de pular conteúdo e navegação por teclado até um card', async ({ app: page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
    // Foco visível
    const link = page.getByRole('link', { name: 'Emerald Ape #042' }).first()
    await link.focus()
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/1$/)
  })

  test('diálogo de login prende e devolve o foco; Esc fecha @mobile', async ({ app: page }) => {
    await open(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await open(page, '/login')
    const login = page.getByRole('dialog')
    await expect(login).toBeVisible()
    expect(await login.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/)
  })

  test('erros de validação ficam associados aos campos', async ({ app: page }) => {
    await open(page, '/login')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText(/Informe um e-mail válido/)
    await expect(email).toBeFocused()
  })

  test('sem overflow horizontal nas larguras 390, 768 e 1440 @mobile', async ({ app: page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/nft/1', '/cart']) {
        await open(page, path)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} @${width}px`).toBeLessThanOrEqual(0)
      }
    }
    // Área logada (menu lateral rolável no mobile).
    await login(page)
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/profile', '/wallets', '/favorites', '/activity', '/checkout']) {
        await open(page, path)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} @${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })
})

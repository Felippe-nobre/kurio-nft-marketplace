import { test, expect, open, isMobile } from './fixtures'
import type { Page } from '@playwright/test'

const names = (page: Page) => page.getByTestId('catalog-grid').getByRole('heading', { level: 3 }).allInnerTexts()

async function openFilters(page: Page) {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    return page.getByRole('dialog')
  }
  return page.getByRole('complementary', { name: 'Filtros do catálogo' })
}

test.describe('1. Catálogo: busca, filtros, ordenação, paginação e URL', () => {
  test('filtros combinados, ordenação e paginação refletem na URL e no histórico @mobile', async ({ app: page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByRole('navigation', { name: 'Paginação do catálogo' })).toBeVisible()

    // Paginação
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro de rede + coleção (combinados) volta para a página 1
    let filters = await openFilters(page)
    await filters.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(page).toHaveURL(/net=Ethereum/)
    await expect(page).not.toHaveURL(/page=2/)
    if (isMobile(page)) await page.keyboard.press('Escape')
    filters = await openFilters(page)
    await filters.getByRole('button', { name: /^Arte digital/ }).click()
    await expect(page).toHaveURL(/cat=Arte(\+|%20)digital/)
    if (isMobile(page)) await page.keyboard.press('Escape')
    const filtered = await names(page)
    expect(filtered).toContain('Emerald Ape #042')
    for (const n of filtered) expect(n).not.toBe('Sage Nomad #009') // Polygon

    // Ordenação por menor preço
    await page.getByLabel('Ordenar por:').selectOption('price_asc')
    await expect(page).toHaveURL(/sort=price_asc/)
    const prices = (await page.getByTestId('catalog-grid').getByTestId('nft-price').allInnerTexts()).map((t) => t.replace(/[^\d.]/g, ''))
    const sorted = [...prices].sort((a, b) => Number(a) - Number(b))
    expect(prices).toEqual(sorted)

    // Histórico: voltar desfaz a ordenação; avançar refaz.
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=price_asc/)
    await expect(page).toHaveURL(/cat=Arte/)
    await page.goForward()
    await expect(page).toHaveURL(/sort=price_asc/)

    // Acesso direto com a URL reproduz o estado
    const url = page.url()
    await page.goto(url)
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('price_asc')
    await expect(page.getByRole('button', { name: 'Remover filtro Ethereum' })).toBeVisible()
  })

  test('busca por texto, resultado vazio e limpeza dos filtros', async ({ app: page }) => {
    await open(page, '/')
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Golden')
    await expect(page).toHaveURL(/q=Golden/)
    await expect.poll(() => names(page)).toEqual(expect.arrayContaining(['Golden Beat #207', 'Golden Frequency #071', 'Golden Signal #160']))
    for (const n of await names(page)) expect(n).toContain('Golden')

    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('zzz-inexistente')
    await expect(page.getByTestId('catalog-empty')).toContainText('Nenhum NFT encontrado')
    await page.getByRole('button', { name: 'Limpar tudo' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ app: page }) => {
    await open(page, '/')
    const { server } = await import('./fixtures')
    await server(page).setScenario({ outOfOrder: true })
    // 1ª requisição (lenta): "Emerald"; 2ª (rápida): "Golden".
    await page.getByLabel('Ordenar por:').selectOption('price_desc')
    await page.getByLabel('Ordenar por:').selectOption('name')
    await expect(page).toHaveURL(/sort=name/)
    await page.waitForTimeout(2000) // a resposta antiga (1,6 s) chega depois e deve ser descartada
    const list = await names(page)
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  test('faixa de preço filtra pelo intervalo aplicado', async ({ app: page }) => {
    await open(page, '/?min=1.00&max=1.50')
    const prices = (await page.getByTestId('catalog-grid').getByTestId('nft-price').allInnerTexts()).map((t) => Number(t.replace(/[^\d.]/g, '').slice(0, 4)))
    expect(prices.length).toBeGreaterThan(0)
    for (const p of prices) expect(p >= 1 && p <= 1.5).toBeTruthy()
    await expect(page.getByText(/Preço: 1,00 - 1,50 ETH/)).toBeVisible()
  })
})

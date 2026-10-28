import { test as base, expect, type Page } from '@playwright/test'

/** Cenário padrão dos testes: sem latência artificial e pagamentos rápidos (determinístico). */
export const TEST_SCENARIO = {
  latency: 'none',
  failures: {},
  outOfOrder: false,
  payment: 'confirm',
  paymentDelayMs: 400,
  walletConnect: 'approve',
  orderTimeoutAfterCreate: false,
  priceChangeOnConfirm: false,
  soldOutOnConfirm: false,
  clientTimeoutMs: 2500,
}

export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'senha123', name: 'Ana Kurio' },
  bruno: { email: 'bruno@kurio.test', password: 'senha123', name: 'Bruno Lima' },
}

type Scenario = Partial<typeof TEST_SCENARIO> & { failures?: Record<string, { kind: string; times?: number }>; sessionTtlMs?: number }

/** Controles do "servidor" simulado (window.__kurio). */
export function server(page: Page) {
  const call = <T,>(fn: string, ...args: unknown[]) =>
    page.evaluate(
      ([f, a]) => {
        const ctl = window.__kurio as unknown as Record<string, unknown>
        const path = (f as string).split('.')
        let target: unknown = ctl
        let self: unknown = ctl
        for (const p of path) {
          self = target
          target = (target as Record<string, unknown>)[p]
        }
        return (target as (...x: unknown[]) => unknown).apply(self, a as unknown[])
      },
      [fn, args] as const,
    ) as Promise<T>
  return {
    setScenario: (p: Scenario) => call('scenario.set', p),
    updateEdition: (nftId: string, editionId: string, patch: { price?: string; available?: number }) => call('updateEdition', nftId, editionId, patch),
    settleOrder: (id: string, outcome: 'confirmed' | 'declined') => call('settleOrder', id, outcome),
    orders: () => call<{ id: string; status: string; userId: string; version: number }[]>('orders'),
    expireSessions: () => call('expireSessions'),
    dropSockets: () => call('socket.dropAll'),
    setBlackout: (on: boolean) => call('socket.setBlackout', on),
    replay: (eventId?: string) => call('socket.replay', eventId),
    history: () => call<{ eventId: string; type: string; version: number; resource: { id: string }; data: Record<string, unknown> }[]>('socket.history'),
    emitRaw: (event: unknown) => call('socket.emitRaw', event),
    nft: (id: string) => page.evaluate((nid) => window.__kurio!.db.nfts.find((n: { id: string }) => n.id === nid)!, id),
  }
}

export const test = base.extend<{ scenario: Scenario; app: Page }>({
  scenario: [{}, { option: true }],
  app: async ({ page, scenario }, use) => {
    // Executa antes de qualquer script da página, só na 1ª carga (reloads preservam o estado).
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('kurio:e2e-init')) {
        sessionStorage.setItem('kurio:e2e-init', '1')
        localStorage.setItem('kurio:scenario', JSON.stringify(s))
      }
    }, { ...TEST_SCENARIO, ...scenario })
    await use(page)
  },
})

export { expect }

export async function open(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => !!window.__kurio)
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
}

export async function login(page: Page, who: keyof typeof USERS = 'ana', from = '/login') {
  if (!page.url().includes('/login')) await open(page, from)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill(USERS[who].email)
  await dialog.getByLabel('Senha', { exact: true }).fill(USERS[who].password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('link', { name: new RegExp(`Minha conta \\(${USERS[who].name}\\)`) })).toBeVisible()
}

export const cartCount = (page: Page) => page.getByTestId('cart-count')

export async function addFirstEditionToCart(page: Page, nftId = '1', qty = 1) {
  await open(page, `/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: /Aumentar quantidade/ }).first().click()
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page).toHaveURL(/\/cart$/)
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

export async function fillCheckoutAndConnect(page: Page) {
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await expect(page.getByTestId('quote-line').first()).toBeVisible()
  // Pré-preenchido com a carteira principal da Ana (MetaMask/Ethereum).
  await expect(page.getByLabel('Rede')).toHaveValue('Ethereum')
  await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
  await expect(page.getByTestId('wallet-connected')).toBeVisible()
}


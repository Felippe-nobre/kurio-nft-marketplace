import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { db, persist, resetDb } from './db'
import { getScenario, resetScenario, setScenario, type Scenario } from './scenario'
import { settleOrder, startSettlementLoop, updateEdition } from './services'
import { realtimeControls } from './realtime'

export const worker = setupWorker(...handlers)

/**
 * Controles da API simulada para o painel de cenários e para os testes E2E.
 * Representam ações "do servidor" (admin, liquidação de pagamento, rede), nunca
 * atalhos de UI: toda mudança chega ao cliente via REST ou Socket.IO.
 */
export const mockControls = {
  reset() {
    resetDb()
    resetScenario()
  },
  scenario: { get: getScenario, set: (p: Partial<Scenario>) => setScenario(p), reset: resetScenario },
  db,
  persist,
  /** Altera preço/estoque de uma edição (emite nft.updated). */
  updateEdition,
  /** Liquida manualmente um pedido pendente (emite order.updated). */
  settleOrder,
  orders: () => db.orders.map((o) => ({ id: o.id, status: o.status, userId: o.userId, version: o.version, idempotencyKey: o.idempotencyKey })),
  /** Expira todas as sessões ativas (simula expiração no servidor). */
  expireSessions() {
    db.sessions.forEach((s) => (s.expiresAt = Date.now() - 1))
    persist()
  },
  socket: realtimeControls,
}

declare global {
  interface Window {
    __kurio?: typeof mockControls
  }
}

export async function startMocks() {
  window.__kurio = mockControls
  startSettlementLoop()
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}

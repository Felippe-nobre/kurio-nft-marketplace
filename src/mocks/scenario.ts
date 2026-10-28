import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/api/contracts'
import { seeded } from './fixtures'

/**
 * Cenários configuráveis da API simulada. Persistidos em localStorage para
 * sobreviver a refresh; controláveis pelo painel (?dev=1) ou por window.__kurio.
 */
export type FailureKind = 'network' | 'timeout' | '400' | '401' | '403' | '404' | '409' | '422' | '500' | '503' | 'empty'

export interface Scenario {
  /** none = 0 ms (testes), fast = 40–120 ms, realistic = 150–600 ms, slow = 1.5–2.5 s */
  latency: 'none' | 'fast' | 'realistic' | 'slow'
  /** Falhas injetadas por rota ("GET /api/nfts"). times = quantas vezes (padrão: sempre). */
  failures: Record<string, { kind: FailureKind; times?: number }>
  /** Respostas do catálogo chegam fora de ordem (a 1ª requisição demora mais que as seguintes). */
  outOfOrder: boolean
  payment: 'confirm' | 'decline' | 'manual'
  paymentDelayMs: number
  walletConnect: 'approve' | 'reject'
  /** O pedido é criado, mas a resposta HTTP nunca chega (timeout no cliente). Consome uma vez. */
  orderTimeoutAfterCreate: boolean
  /** O preço do 1º item sobe no momento da confirmação (antes da validação). Consome uma vez. */
  priceChangeOnConfirm: boolean
  /** A edição do 1º item esgota no momento da confirmação. Consome uma vez. */
  soldOutOnConfirm: boolean
  sessionTtlMs: number
  /** Timeout do Axios usado com os mocks (permite testes rápidos de timeout). */
  clientTimeoutMs: number
}

const KEY = 'kurio:scenario'
export const DEFAULT_SCENARIO: Scenario = {
  latency: 'realistic',
  failures: {},
  outOfOrder: false,
  payment: 'confirm',
  paymentDelayMs: 1500,
  walletConnect: 'approve',
  orderTimeoutAfterCreate: false,
  priceChangeOnConfirm: false,
  soldOutOnConfirm: false,
  sessionTtlMs: 30 * 60 * 1000,
  clientTimeoutMs: Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 8000),
}

export function getScenario(): Scenario {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SCENARIO, ...(JSON.parse(raw) as Partial<Scenario>) } : { ...DEFAULT_SCENARIO }
  } catch {
    return { ...DEFAULT_SCENARIO }
  }
}

export function setScenario(patch: Partial<Scenario>) {
  const next = { ...getScenario(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function resetScenario() {
  localStorage.removeItem(KEY)
}

/** Consome um cenário de uso único. */
export function consume(flag: 'orderTimeoutAfterCreate' | 'priceChangeOnConfirm' | 'soldOutOnConfirm') {
  const s = getScenario()
  if (!s[flag]) return false
  setScenario({ [flag]: false })
  return true
}

const rand = seeded(7)
export async function latency() {
  const { latency: mode } = getScenario()
  if (mode === 'none') return
  const [min, max] = mode === 'fast' ? [40, 120] : mode === 'slow' ? [1500, 2500] : [150, 600]
  await delay(Math.round(min + rand() * (max - min)))
}

export const apiError = (status: number, body: ApiErrorBody, init?: ResponseInit) => HttpResponse.json(body, { status, ...init })

const STATUS_BODIES: Record<string, ApiErrorBody> = {
  '400': { code: 'VALIDATION_ERROR', message: 'Requisição inválida (cenário simulado).' },
  '401': { code: 'UNAUTHORIZED', message: 'Acesso não autorizado (cenário simulado).' },
  '403': { code: 'FORBIDDEN', message: 'Acesso negado (cenário simulado).' },
  '404': { code: 'NOT_FOUND', message: 'Recurso não encontrado (cenário simulado).' },
  '409': { code: 'CONFLICT', message: 'Conflito (cenário simulado).' },
  '422': { code: 'VALIDATION_ERROR', message: 'Dados inválidos (cenário simulado).' },
  '500': { code: 'INTERNAL', message: 'Erro interno do servidor (cenário simulado).' },
  '503': { code: 'INTERNAL', message: 'Serviço indisponível (cenário simulado).' },
}

/**
 * Aplica latência e falhas configuradas. Retorna uma resposta de falha
 * (ou 'empty') quando o cenário pede; caso contrário, undefined.
 */
export async function injected(routeKey: string): Promise<Response | 'empty' | undefined> {
  await latency()
  const s = getScenario()
  const f = s.failures[routeKey]
  if (!f) return undefined
  if (f.times !== undefined) {
    const left = f.times - 1
    const failures = { ...s.failures }
    if (left <= 0) delete failures[routeKey]
    else failures[routeKey] = { ...f, times: left }
    setScenario({ failures })
  }
  if (f.kind === 'empty') return 'empty'
  if (f.kind === 'network') return HttpResponse.error()
  if (f.kind === 'timeout') {
    await delay(s.clientTimeoutMs + 1500)
    return apiError(504, { code: 'INTERNAL', message: 'Tempo esgotado.' })
  }
  const status = Number(f.kind)
  return apiError(status, STATUS_BODIES[f.kind])
}

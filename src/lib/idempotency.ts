/**
 * Chave de idempotência por tentativa de compra. A mesma tentativa (mesmo
 * conteúdo) reutiliza a chave — inclusive após refresh, timeout ou clique
 * duplo —, então o servidor devolve o mesmo pedido. Conteúdo diferente gera
 * chave nova. Persistida por usuário em localStorage.
 */
const KEY = (userId: string) => `kurio:checkout-attempt:${userId}`

export interface Attempt {
  key: string
  contentHash: string
  orderId?: string
  createdAt: number
}

export function attemptFor(userId: string, contentHash: string): Attempt {
  const current = readAttempt(userId)
  if (current && current.contentHash === contentHash && !current.orderId) return current
  const next = { key: crypto.randomUUID(), contentHash, createdAt: Date.now() }
  localStorage.setItem(KEY(userId), JSON.stringify(next))
  return next
}

export function readAttempt(userId: string): Attempt | null {
  try {
    const raw = localStorage.getItem(KEY(userId))
    return raw ? (JSON.parse(raw) as Attempt) : null
  } catch {
    return null
  }
}

export function markAttemptOrder(userId: string, orderId: string) {
  const a = readAttempt(userId)
  if (a) localStorage.setItem(KEY(userId), JSON.stringify({ ...a, orderId }))
}

export function clearAttempt(userId: string) {
  localStorage.removeItem(KEY(userId))
}

/** Pedido pendente em andamento (para retomar após refresh/reconexão). */
const PENDING = (userId: string) => `kurio:pending-order:${userId}`
export const pendingOrder = {
  get: (userId: string) => localStorage.getItem(PENDING(userId)),
  set: (userId: string, id: string) => localStorage.setItem(PENDING(userId), id),
  clear: (userId: string) => localStorage.removeItem(PENDING(userId)),
}

export function contentHash(value: unknown) {
  const s = JSON.stringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

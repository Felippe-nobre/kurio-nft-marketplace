import { ws, type WebSocketHandlerConnection } from 'msw'
import type { Nft, NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { db, nextEventId, persist, type OrderRecord } from './db'

/**
 * Servidor Socket.IO simulado. O MSW intercepta o WebSocket aberto pelo
 * socket.io-client (transporte "websocket") e o adaptador abaixo fala o
 * protocolo Engine.IO v4 / Socket.IO v5 (handshake, conexão ao namespace "/",
 * heartbeat ping/pong e pacotes EVENT).
 *
 * Por que não o @mswjs/socket.io-binding: na versão 0.2.0 ele não envia
 * heartbeat (o cliente derruba a conexão por "ping timeout" a cada ~45 s) e
 * não responde ao pacote CONNECT do cliente.
 *
 * Roteamento: a partir do MSW 2.15 o prefixo "/socket.io/" é removido do
 * caminho antes do casamento (por isso o link é a raiz "/"). Conexões que não
 * são do Socket.IO (ex.: HMR do Vite em dev) seguem para o servidor real.
 *
 * Isolamento: o token da sessão vai na query string do handshake; eventos
 * de pedido só são entregues às conexões do dono do pedido.
 */
export const socketLink = ws.link('/')

const PING_INTERVAL_MS = 20_000
const PING_TIMEOUT_MS = 20_000

type Listener = (...args: unknown[]) => void
interface Io {
  client: { on: (event: string, fn: Listener) => void; emit: (event: string, ...data: unknown[]) => void }
}

/** Adaptador mínimo do protocolo Socket.IO sobre a conexão interceptada pelo MSW. */
function toSocketIo(connection: WebSocketHandlerConnection): Io {
  const { client } = connection
  const listeners = new Map<string, Listener[]>()
  const sid = Math.random().toString(36).slice(2, 12)
  let closed = false
  const send = (packet: string) => {
    if (!closed) client.send(packet)
  }

  // Engine.IO OPEN (handshake). Enviado numa macrotarefa para chegar depois
  // do evento "open" do WebSocket simulado (que o MSW dispara numa microtarefa).
  const handshake = setTimeout(() => {
    send('0' + JSON.stringify({ sid, upgrades: [], pingInterval: PING_INTERVAL_MS, pingTimeout: PING_TIMEOUT_MS, maxPayload: 1_000_000 }))
  }, 0)
  const heartbeat = setInterval(() => send('2'), PING_INTERVAL_MS)
  client.addEventListener('close', () => {
    closed = true
    clearTimeout(handshake)
    clearInterval(heartbeat)
  })

  client.addEventListener('message', (event) => {
    const raw = event.data
    if (typeof raw !== 'string') return
    if (raw === '3') return // pong
    if (raw === '2') return send('3') // ping do cliente (não usado no v4, mas inofensivo)
    if (raw.startsWith('40')) return send('40' + JSON.stringify({ sid: `${sid}-io` })) // CONNECT "/"
    if (raw.startsWith('41')) return client.close() // DISCONNECT "/"
    const m = /^42\d*(\[[\s\S]*\])$/.exec(raw) // EVENT (com ack id opcional)
    if (!m) return
    try {
      const [name, ...args] = JSON.parse(m[1]) as [string, ...unknown[]]
      listeners.get(name)?.forEach((fn) => fn(...args))
    } catch {
      /* pacote malformado: ignora */
    }
  })

  return {
    client: {
      on(name, fn) {
        listeners.set(name, [...(listeners.get(name) ?? []), fn])
      },
      emit(name, ...data) {
        send('42' + JSON.stringify([name, ...data]))
      },
    },
  }
}
interface Conn {
  id: string
  userId: string | null
  io: Io
  close: () => void
}

const connections = new Map<string, Conn>()
let blackout = false
const history: (NftUpdatedEvent | OrderUpdatedEvent)[] = []

function userFromToken(token: string | null) {
  if (!token) return null
  const s = db.sessions.find((x) => x.token === token)
  return s && s.expiresAt > Date.now() ? s.userId : null
}

export const realtimeHandler = socketLink.addEventListener('connection', (connection) => {
  const { client } = connection
  if (!client.url.pathname.startsWith('/socket.io')) {
    // Não é Socket.IO (ex.: HMR do Vite): repassa ao servidor real.
    connection.server.connect()
    return
  }
  if (blackout) {
    // Simula servidor inalcançável: derruba a conexão imediatamente.
    client.close(1011, 'blackout')
    return
  }
  const token = client.url.searchParams.get('token')
  const userId = userFromToken(token)
  const io = toSocketIo(connection)
  const conn: Conn = { id: client.id, userId, io, close: () => client.close(1001, 'server drop') }
  connections.set(client.id, conn)
  client.addEventListener('close', () => connections.delete(client.id))

  // Ping de aplicação usado pelo cliente para medir a conexão/reconciliar.
  io.client.on('session.hello', () => {
    io.client.emit('session.ready', { userId, connectedAt: new Date().toISOString() })
  })
})

function deliver(event: NftUpdatedEvent | OrderUpdatedEvent, toUser?: string) {
  history.push(event)
  if (history.length > 200) history.shift()
  if (blackout) return // evento perdido enquanto o "servidor" está fora
  for (const c of connections.values()) {
    if (toUser && c.userId !== toUser) continue
    c.io.client.emit(event.type, event)
  }
}

export function emitNftUpdated(nft: Nft) {
  const event: NftUpdatedEvent = {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: { price: nft.price, available: nft.available, editions: structuredClone(nft.editions), oldPrice: nft.oldPrice },
  }
  persist()
  deliver(event)
  return event
}

export function emitOrderUpdated(o: OrderRecord) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: o.id },
    version: o.version,
    occurredAt: new Date().toISOString(),
    data: { status: o.status, transactionId: o.transactionId, declineReason: o.declineReason, updatedAt: o.updatedAt },
  }
  persist()
  deliver(event, o.userId)
  return event
}

/* ---------------------- Controles para testes / painel ---------------------- */

export const realtimeControls = {
  /** Derruba todas as conexões; o socket.io-client reconecta sozinho. */
  dropAll() {
    for (const c of connections.values()) c.close()
  },
  /** Enquanto ativo, recusa conexões e descarta eventos (perda de eventos). */
  setBlackout(on: boolean) {
    blackout = on
    if (on) this.dropAll()
  },
  get blackout() {
    return blackout
  },
  connectionCount: () => connections.size,
  history: () => [...history],
  /** Reenvia um evento já emitido (duplicata) ou um evento arbitrário (ex.: versão antiga). */
  replay(eventId?: string) {
    const ev = eventId ? history.find((e) => e.eventId === eventId) : history[history.length - 1]
    if (ev) deliver(ev, ev.type === 'order.updated' ? db.orders.find((o) => o.id === ev.resource.id)?.userId : undefined)
    return ev
  },
  emitRaw(event: NftUpdatedEvent | OrderUpdatedEvent) {
    deliver(event, event.type === 'order.updated' ? db.orders.find((o) => o.id === event.resource.id)?.userId : undefined)
  },
}

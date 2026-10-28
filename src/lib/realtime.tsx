import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CatalogPage, Highlights, Nft, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { qk } from '@/api/queryKeys'
import { useSession } from './session'
import { announce } from './announcer'

/**
 * Cliente Socket.IO real (socket.io-client, transporte websocket).
 * - Isolamento: uma conexão por sessão (token na query do handshake); trocar de
 *   usuário ou sair encerra a conexão e remove todos os listeners.
 * - Ordem/duplicatas: eventos têm eventId (dedupe) e version por recurso; o cliente
 *   só aplica versões estritamente maiores que a conhecida (nunca regride).
 * - Reconexão: o socket.io-client reconecta com backoff; ao reconectar, o cliente
 *   reconcilia com a API REST (invalidação) para recuperar eventos perdidos.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

const statusListeners = new Set<() => void>()
let status: RealtimeStatus = 'idle'
const setStatus = (s: RealtimeStatus) => {
  status = s
  statusListeners.forEach((l) => l())
}
export const useRealtimeStatus = () =>
  useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => status,
    () => status,
  )

type NftListener = (e: NftUpdatedEvent) => void
const nftListeners = new Set<NftListener>()
/** Assina eventos nft.updated já validados (sem duplicatas/antigos). */
export function onNftUpdated(fn: NftListener) {
  nftListeners.add(fn)
  return () => {
    nftListeners.delete(fn)
  }
}
type ReconnectListener = () => void
const reconnectListeners = new Set<ReconnectListener>()
export function onReconnected(fn: ReconnectListener) {
  reconnectListeners.add(fn)
  return () => {
    reconnectListeners.delete(fn)
  }
}

const TERMINAL = new Set(['confirmed', 'declined'])

/** Registro de versões e eventos vistos (por sessão). */
export class EventGate {
  private seen = new Set<string>()
  private order: string[] = []
  private versions = new Map<string, number>()
  accept(e: { eventId: string; resource: { type: string; id: string }; version: number }) {
    if (this.seen.has(e.eventId)) return false
    this.seen.add(e.eventId)
    this.order.push(e.eventId)
    if (this.order.length > 500) this.seen.delete(this.order.shift()!)
    const key = `${e.resource.type}:${e.resource.id}`
    if ((this.versions.get(key) ?? 0) >= e.version) return false
    this.versions.set(key, e.version)
    return true
  }
  /** Registra versões vindas do REST para que eventos antigos sejam descartados. */
  observe(type: string, id: string, version: number) {
    const key = `${type}:${id}`
    if ((this.versions.get(key) ?? 0) < version) this.versions.set(key, version)
  }
}

const patchSummary = (n: NftSummary, e: NftUpdatedEvent): NftSummary =>
  n.id === e.resource.id && n.version < e.version ? { ...n, price: e.data.price, available: e.data.available, oldPrice: e.data.oldPrice, version: e.version } : n

export function applyNftEvent(qc: QueryClient, e: NftUpdatedEvent, scope: string) {
  qc.setQueryData<Nft>(qk.nft(e.resource.id), (old) =>
    old && old.version < e.version ? { ...old, price: e.data.price, available: e.data.available, editions: e.data.editions, oldPrice: e.data.oldPrice, version: e.version } : old,
  )
  qc.setQueriesData<CatalogPage>({ queryKey: qk.catalogAll }, (old) => (old ? { ...old, items: old.items.map((n) => patchSummary(n, e)) } : old))
  qc.setQueryData<Highlights>(qk.highlights, (old) => (old ? { hero: old.hero.map((n) => patchSummary(n, e)), featured: patchSummary(old.featured, e) } : old))
  qc.setQueriesData<NftSummary[]>({ queryKey: ['nft'], predicate: (q) => q.queryKey[2] === 'related' }, (old) => old?.map((n) => patchSummary(n, e)))
  qc.setQueryData<NftSummary[]>(qk.favorites(scope), (old) => old?.map((n) => patchSummary(n, e)))
  // O carrinho é calculado no servidor: revalida para refletir preço/estoque.
  void qc.invalidateQueries({ queryKey: qk.cart(scope) })
}

export function applyOrderEvent(qc: QueryClient, e: OrderUpdatedEvent, scope: string) {
  let changed = false
  qc.setQueryData<Order>(qk.order(scope, e.resource.id), (old) => {
    if (!old || old.version >= e.version || TERMINAL.has(old.status)) return old
    changed = true
    return { ...old, status: e.data.status, transactionId: e.data.transactionId, declineReason: e.data.declineReason, updatedAt: e.data.updatedAt, version: e.version }
  })
  if (!qc.getQueryData(qk.order(scope, e.resource.id))) void qc.invalidateQueries({ queryKey: qk.order(scope, e.resource.id) })
  void qc.invalidateQueries({ queryKey: qk.orders(scope) })
  if (e.data.status === 'confirmed') void qc.invalidateQueries({ queryKey: qk.cart(scope) })
  return changed
}

const SocketCtx = createContext<Socket | null>(null)
export const useSocket = () => useContext(SocketCtx)

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '')

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { token, scope } = useSession()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // O socket.io-client é carregado sob demanda: o engine.io-client captura
    // globalThis.WebSocket ao ser avaliado, e o MSW só substitui o WebSocket em
    // worker.start(). Importar aqui garante que a conexão passe pelo mock.
    let disposed = false
    let teardown: (() => void) | undefined
    setStatus('connecting')
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      teardown = connect(io)
    })
    return () => {
      disposed = true
      teardown?.()
      setStatus('idle')
    }

    function connect(io: typeof import('socket.io-client').io) {
    const gate = new EventGate()
    let everConnected = false
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      query: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 300,
      reconnectionDelayMax: 3000,
      timeout: 5000,
    })
    socketRef.current = socket

    const reconcile = () => {
      void qc.invalidateQueries({ queryKey: ['nft'] })
      void qc.invalidateQueries({ queryKey: qk.catalogAll })
      void qc.invalidateQueries({ queryKey: qk.highlights })
      void qc.invalidateQueries({ queryKey: qk.privateScope(scope) })
      reconnectListeners.forEach((l) => l())
    }

    socket.on('connect', () => {
      setStatus('connected')
      if (everConnected) {
        reconcile()
        announce('Conexão em tempo real restabelecida. Dados sincronizados.')
      }
      everConnected = true
      socket.emit('session.hello')
    })
    socket.on('disconnect', (reason) => {
      // "io client disconnect" = encerramento intencional (logout/troca).
      if (reason !== 'io client disconnect') {
        setStatus('reconnecting')
        announce('Conexão em tempo real interrompida. Tentando reconectar…')
      }
    })
    socket.on('connect_error', () => setStatus(everConnected ? 'reconnecting' : 'offline'))

    socket.on('nft.updated', (e: NftUpdatedEvent) => {
      const cached = qc.getQueryData<Nft>(qk.nft(e.resource.id))
      if (cached) gate.observe('nft', cached.id, cached.version)
      if (!gate.accept(e)) return
      const before = cached?.price
      applyNftEvent(qc, e, scope)
      nftListeners.forEach((l) => l(e))
      if (before && before !== e.data.price) announce(`Preço atualizado: ${cached?.name} agora custa ${e.data.price} ETH.`)
    })
    socket.on('order.updated', (e: OrderUpdatedEvent) => {
      const cached = qc.getQueryData<Order>(qk.order(scope, e.resource.id))
      if (cached) gate.observe('order', cached.id, cached.version)
      if (!gate.accept(e)) return
      if (applyOrderEvent(qc, e, scope)) {
        announce(e.data.status === 'confirmed' ? 'Pagamento confirmado.' : e.data.status === 'declined' ? 'Pagamento recusado.' : 'Pedido atualizado.')
      }
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
    }
  }, [qc, token, scope])

  return <SocketCtx.Provider value={socketRef.current}>{children}</SocketCtx.Provider>
}

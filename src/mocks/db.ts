import type { Cart, CartItemInput, Nft, Order, Wallet, WalletConnection } from '@/api/contracts'
import { buildNfts, SEED_USERS, SEED_WALLETS, type UserRecord } from './fixtures'

/**
 * "Banco" da API simulada. Vive no navegador (o MSW executa os handlers na página),
 * é persistido em localStorage para sobreviver a refresh e pode ser restaurado com reset().
 */
export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

export interface CartRecord {
  items: CartItemInput[]
  coupon: string | null
  version: number
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  /** Momento em que a simulação de pagamento deve concluir (ms). null = aguardando liquidação manual. */
  settleAt: number | null
  outcome: 'confirmed' | 'declined' | 'manual'
}

export interface DbState {
  schema: number
  nfts: Nft[]
  users: UserRecord[]
  sessions: SessionRecord[]
  carts: Record<string, CartRecord>
  favorites: Record<string, string[]>
  wallets: Record<string, Wallet[]>
  connections: Record<string, WalletConnection & { userId: string }>
  orders: OrderRecord[]
  idempotency: Record<string, { hash: string; orderId: string }>
  quotes: Record<string, { fingerprint: string; createdAt: number; userId: string }>
  eventSeq: number
}

const KEY = 'kurio:mock-db'
const SCHEMA = 3

function seed(): DbState {
  return {
    schema: SCHEMA,
    nfts: buildNfts(),
    users: structuredClone(SEED_USERS),
    sessions: [],
    carts: {},
    favorites: { 'u-ana': ['3'] },
    wallets: structuredClone(SEED_WALLETS),
    connections: {},
    orders: [],
    idempotency: {},
    quotes: {},
    eventSeq: 0,
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA) return parsed
    }
  } catch {
    /* estado corrompido: recomeça do seed */
  }
  return seed()
}

export const db: DbState = load()

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* cota excedida: mantém em memória */
  }
}

/** Restaura o cenário determinístico inicial. */
export function resetDb() {
  const fresh = seed()
  Object.assign(db, fresh)
  persist()
}

export const findNft = (id: string) => db.nfts.find((n) => n.id === id)
export const findUser = (id: string) => db.users.find((u) => u.id === id)
export const findUserByEmail = (email: string) => db.users.find((u) => u.email === email.trim().toLowerCase())

export const publicUser = (u: UserRecord) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  displayName: u.displayName,
  ensName: u.ensName,
  walletNickname: u.walletNickname,
  avatarUrl: u.avatarUrl ?? null,
})

export function cartOf(owner: string): CartRecord {
  if (!db.carts[owner]) db.carts[owner] = { items: [], coupon: null, version: 0 }
  return db.carts[owner]
}

export const nextEventId = () => {
  db.eventSeq += 1
  return `evt_${db.eventSeq.toString().padStart(6, '0')}`
}

export type { Cart }

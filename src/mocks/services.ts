import type {
  Cart,
  CartItemInput,
  CartLine,
  CatalogPage,
  CatalogQuery,
  Category,
  Network,
  Nft,
  NftSummary,
  Order,
  Quote,
  QuoteLine,
  User,
} from '@/api/contracts'
import { CATEGORIES, NETWORKS } from '@/api/contracts'
import { addEth, compareEth, fromWei, isEthAmount, mulEth, percentOf, toWei } from '@/lib/money'
import { cartOf, db, findNft, findUser, persist, publicUser, type OrderRecord } from './db'
import { COUPONS, NETWORK_FEES } from './fixtures'
import { getScenario } from './scenario'
import { emitNftUpdated, emitOrderUpdated } from './realtime'

/* --------------------------------- Senhas --------------------------------- */

/** Comparação de strings por código (ids e datas ISO). */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
/** Collator reutilizado: criar um por comparação (localeCompare com locale) é caro. */
const NAME_COLLATOR = new Intl.Collator('pt-BR')

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 60_000 }, key, 256)
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
}
export const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')

/* --------------------------------- Sessão --------------------------------- */

export type AuthResult = { ok: true; user: User; userId: string; token: string } | { ok: false; code: 'UNAUTHORIZED' | 'SESSION_EXPIRED' }

export function authenticate(request: Request): AuthResult {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  return authenticateToken(token)
}

export function authenticateToken(token: string | null): AuthResult {
  if (!token) return { ok: false, code: 'UNAUTHORIZED' }
  const session = db.sessions.find((s) => s.token === token)
  if (!session) return { ok: false, code: 'UNAUTHORIZED' }
  if (session.expiresAt <= Date.now()) return { ok: false, code: 'SESSION_EXPIRED' }
  const user = findUser(session.userId)
  if (!user) return { ok: false, code: 'UNAUTHORIZED' }
  return { ok: true, user: publicUser(user), userId: user.id, token }
}

export function createSession(userId: string) {
  const token = `tok_${randomHex(24)}`
  const expiresAt = Date.now() + getScenario().sessionTtlMs
  db.sessions = db.sessions.filter((s) => s.expiresAt > Date.now())
  db.sessions.push({ token, userId, expiresAt })
  persist()
  return { token, expiresAt: new Date(expiresAt).toISOString() }
}

/** Dono do carrinho: usuário autenticado ou visitante (cabeçalho X-Guest-Id). */
export function cartOwner(request: Request): { owner: string } | { error: 'SESSION_EXPIRED' | 'UNAUTHORIZED' } {
  const auth = authenticate(request)
  if (auth.ok) return { owner: `user:${auth.userId}` }
  if (request.headers.get('authorization')) return { error: auth.code }
  const guest = request.headers.get('x-guest-id')
  if (!guest || !/^[a-z0-9-]{8,64}$/i.test(guest)) return { error: 'UNAUTHORIZED' }
  return { owner: `guest:${guest}` }
}

/* -------------------------------- Catálogo -------------------------------- */

export const summarize = (n: Nft): NftSummary => ({
  id: n.id,
  name: n.name,
  tokenId: n.tokenId,
  image: n.image,
  price: n.price,
  oldPrice: n.oldPrice,
  available: n.available,
  rare: n.rare,
  network: n.network,
  category: n.category,
  version: n.version,
  defaultEditionId: n.defaultEditionId,
})

export function parseCatalogQuery(url: URL): CatalogQuery {
  const p = url.searchParams
  const list = (k: string) => (p.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    q: p.get('q') ?? undefined,
    categories: list('categories').filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c)),
    networks: list('networks').filter((n): n is Network => (NETWORKS as string[]).includes(n)),
    minPrice: isEthAmount(p.get('minPrice')) ? p.get('minPrice')! : undefined,
    maxPrice: isEthAmount(p.get('maxPrice')) ? p.get('maxPrice')! : undefined,
    sort: (['recent', 'price_asc', 'price_desc', 'name'] as const).find((s) => s === p.get('sort')) ?? 'recent',
    tab: (['all', 'new', 'trending'] as const).find((s) => s === p.get('tab')) ?? 'all',
    page: Math.max(1, Number.parseInt(p.get('page') ?? '1', 10) || 1),
    pageSize: Math.min(48, Math.max(1, Number.parseInt(p.get('pageSize') ?? '9', 10) || 9)),
  }
}

export function queryCatalog(query: CatalogQuery): CatalogPage {
  const q = (query.q ?? '').trim().toLowerCase()
  const inText = (n: Nft) => !q || n.name.toLowerCase().includes(q) || n.creator.toLowerCase().includes(q) || n.category.toLowerCase().includes(q)
  const inTab = (n: Nft) => query.tab !== 'new' || n.isNew
  const inPrice = (n: Nft) => (!query.minPrice || compareEth(n.price, query.minPrice) >= 0) && (!query.maxPrice || compareEth(n.price, query.maxPrice) <= 0)
  const inCat = (n: Nft) => !query.categories?.length || query.categories.includes(n.category)
  const inNet = (n: Nft) => !query.networks?.length || query.networks.includes(n.network)

  const base = db.nfts.filter((n) => inText(n) && inTab(n))
  // Facetas disjuntivas: cada contagem considera os demais filtros, exceto o próprio.
  const categories: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]))
  base.filter((n) => inPrice(n) && inNet(n)).forEach((n) => (categories[n.category] += 1))
  const networks: Record<string, number> = Object.fromEntries(NETWORKS.map((c) => [c, 0]))
  base.filter((n) => inPrice(n) && inCat(n)).forEach((n) => (networks[n.network] += 1))
  const prices = db.nfts.map((n) => toWei(n.price))
  const priceRange = { min: fromWei(prices.reduce((a, b) => (b < a ? b : a))), max: fromWei(prices.reduce((a, b) => (b > a ? b : a))) }

  let result = base.filter((n) => inPrice(n) && inCat(n) && inNet(n))
  const sort = query.tab === 'trending' && query.sort === 'recent' ? 'trending' : query.sort
  result = [...result].sort((a, b) => {
    switch (sort) {
      case 'price_asc':
        return compareEth(a.price, b.price) || cmp(a.id, b.id)
      case 'price_desc':
        return compareEth(b.price, a.price) || cmp(a.id, b.id)
      case 'name':
        return NAME_COLLATOR.compare(a.name, b.name)
      case 'trending':
        return b.trending - a.trending
      default:
        // Datas ISO 8601 de formato fixo: a comparação direta dá a mesma ordem que localeCompare, sem ICU.
        return cmp(b.listedAt, a.listedAt) || Number(a.id) - Number(b.id)
    }
  })
  const pageSize = query.pageSize ?? 9
  const totalPages = Math.max(1, Math.ceil(result.length / pageSize))
  const page = Math.min(query.page ?? 1, totalPages)
  return {
    items: result.slice((page - 1) * pageSize, page * pageSize).map(summarize),
    page,
    pageSize,
    total: result.length,
    totalPages,
    facets: { categories, networks, priceRange },
  }
}

/* --------------------------- Atualização de NFTs --------------------------- */

export function updateEdition(nftId: string, editionId: string, patch: { price?: string; available?: number }) {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) throw new Error('NFT/edição inexistente')
  if (patch.price !== undefined) edition.price = patch.price
  if (patch.available !== undefined) edition.available = Math.max(0, Math.min(edition.supply, patch.available))
  const def = nft.editions.find((e) => e.id === nft.defaultEditionId)!
  if (patch.price !== undefined && editionId === nft.defaultEditionId && compareEth(patch.price, nft.price) !== 0) {
    nft.oldPrice = compareEth(patch.price, nft.price) < 0 ? nft.price : undefined
  }
  nft.price = def.price
  nft.available = nft.editions.reduce((a, e) => a + e.available, 0)
  nft.version += 1
  persist()
  emitNftUpdated(nft)
  return nft
}

/* -------------------------------- Carrinho -------------------------------- */

export const MAX_PER_LINE = 10

export function lineFor(item: CartItemInput): CartLine | null {
  const nft = findNft(item.nftId)
  const edition = nft?.editions.find((e) => e.id === item.editionId)
  if (!nft || !edition) return null
  return {
    ...item,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    editionLabel: edition.label,
    unitPrice: edition.price,
    lineTotal: mulEth(edition.price, item.quantity),
    available: edition.available,
  }
}

export function cartView(owner: string): Cart {
  const rec = cartOf(owner)
  const items = rec.items.map(lineFor).filter((l): l is CartLine => !!l)
  const coupon = rec.coupon && COUPONS[rec.coupon] ? { code: rec.coupon, percentOff: COUPONS[rec.coupon].percentOff } : null
  const subtotal = items.length ? addEth(...items.map((l) => l.lineTotal)) : '0.00'
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0.00'
  const networkFee = items.length ? NETWORK_FEES.Ethereum : '0.00'
  const total = fromWei(toWei(subtotal) - toWei(discount) + toWei(networkFee))
  return { owner, items, coupon, version: rec.version, count: items.reduce((a, l) => a + l.quantity, 0), subtotal, discount, networkFee, total }
}

export function validateCoupon(code: string): { ok: true; code: string; percentOff: number } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED' } {
  const normalized = code.trim().toUpperCase()
  const c = COUPONS[normalized]
  if (!c) return { ok: false, code: 'COUPON_INVALID' }
  if (new Date(c.expiresAt).getTime() < Date.now()) return { ok: false, code: 'COUPON_EXPIRED' }
  return { ok: true, code: normalized, percentOff: c.percentOff }
}

/* --------------------------------- Cotação -------------------------------- */

const fnv = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function buildQuote(items: CartItemInput[], couponCode: string | null | undefined, network: Network, userId: string): Quote | { error: 'COUPON_INVALID' | 'COUPON_EXPIRED' | 'NOT_FOUND' } {
  const lines: QuoteLine[] = []
  for (const item of items) {
    const line = lineFor(item)
    if (!line) return { error: 'NOT_FOUND' }
    const status: QuoteLine['status'] = line.available === 0 ? 'sold_out' : line.available < line.quantity ? 'insufficient_stock' : 'ok'
    lines.push({ ...line, status })
  }
  let coupon: Quote['coupon'] = null
  if (couponCode) {
    const v = validateCoupon(couponCode)
    if (!v.ok) return { error: v.code }
    coupon = { code: v.code, percentOff: v.percentOff }
  }
  const subtotal = lines.length ? addEth(...lines.map((l) => l.lineTotal)) : '0.00'
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0.00'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0.00'
  const total = fromWei(toWei(subtotal) - toWei(discount) + toWei(networkFee))
  const issues = lines.filter((l) => l.status !== 'ok').map((l) => (l.status === 'sold_out' ? `${l.name} (${l.editionLabel}) esgotou.` : `${l.name} (${l.editionLabel}) tem apenas ${l.available} disponível(is).`))
  const fingerprint = fnv(JSON.stringify([lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice, l.status]), coupon?.code, networkFee, total]))
  const id = `q_${randomHex(6)}`
  const now = Date.now()
  db.quotes[id] = { fingerprint, createdAt: now, userId }
  return {
    id,
    fingerprint,
    lines,
    coupon,
    subtotal,
    discount,
    networkFee,
    total,
    network,
    issues,
    purchasable: lines.length > 0 && issues.length === 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
  }
}

/* --------------------------------- Pedidos -------------------------------- */

export const publicOrder = (o: OrderRecord): Order => ({
  id: o.id,
  status: o.status,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  transactionId: o.transactionId,
  declineReason: o.declineReason,
  receipt: o.receipt,
  version: o.version,
})

/** Conclui pagamentos simulados cujo prazo venceu (chamado periodicamente e em leituras). */
export function settleDueOrders() {
  const now = Date.now()
  for (const o of db.orders) {
    if (o.status === 'pending' && o.settleAt !== null && o.settleAt <= now) {
      settleOrder(o.id, o.outcome === 'declined' ? 'declined' : 'confirmed')
    }
  }
}

export function settleOrder(orderId: string, outcome: 'confirmed' | 'declined') {
  const o = db.orders.find((x) => x.id === orderId)
  if (!o || o.status !== 'pending') return o // estados terminais não mudam
  o.status = outcome
  o.updatedAt = new Date().toISOString()
  o.version += 1
  if (outcome === 'declined') {
    o.declineReason = 'Pagamento recusado pela carteira simulada.'
    // Libera a reserva de estoque.
    for (const l of o.receipt.lines) {
      const ed = findNft(l.nftId)?.editions.find((e) => e.id === l.editionId)
      if (ed) updateEdition(l.nftId, l.editionId, { available: ed.available + l.quantity })
    }
  } else {
    // Remove do carrinho somente as quantidades efetivamente compradas.
    const cart = cartOf(`user:${o.userId}`)
    cart.items = cart.items
      .map((i) => {
        const bought = o.receipt.lines.find((l) => l.nftId === i.nftId && l.editionId === i.editionId)
        return bought ? { ...i, quantity: i.quantity - bought.quantity } : i
      })
      .filter((i) => i.quantity > 0)
    if (o.receipt.coupon && cart.coupon === o.receipt.coupon.code) cart.coupon = null
    cart.version += 1
  }
  persist()
  emitOrderUpdated(o)
  return o
}

let timer: ReturnType<typeof setInterval> | undefined
export function startSettlementLoop() {
  if (timer) return
  timer = setInterval(settleDueOrders, 250)
}

export const ownsOrder = (o: OrderRecord | undefined, userId: string) => !!o && o.userId === userId

export function stableHash(value: unknown) {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)])) : v
  return fnv(JSON.stringify(sort(value)))
}

export const transactionIdFor = (orderId: string) => {
  let h = ''
  for (let i = 0; h.length < 64; i++) h += fnv(`${orderId}:${i}`)
  return `0x${h.slice(0, 64).toUpperCase()}`
}

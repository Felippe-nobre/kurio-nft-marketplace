import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type {
  CartItemInput,
  CreateOrderBody,
  Highlights,
  LoginBody,
  Network,
  PasswordBody,
  ProfileBody,
  QuoteBody,
  RegisterBody,
  SessionResponse,
  WalletBody,
  WalletConnectBody,
  WalletProvider,
} from '@/api/contracts'
import { NETWORKS, WALLET_PROVIDERS } from '@/api/contracts'
import { addEth } from '@/lib/money'
import { cartOf, db, findNft, findUser, findUserByEmail, persist, publicUser, type OrderRecord } from './db'
import { FEATURED_ID, HERO_IDS, reviewsFor } from './fixtures'
import { apiError, consume, getScenario, injected } from './scenario'
import {
  authenticate,
  buildQuote,
  cartOwner,
  cartView,
  createSession,
  hashPassword,
  MAX_PER_LINE,
  ownsOrder,
  parseCatalogQuery,
  publicOrder,
  queryCatalog,
  randomHex,
  settleDueOrders,
  stableHash,
  summarize,
  transactionIdFor,
  updateEdition,
  validateCoupon,
} from './services'
import { realtimeHandler } from './realtime'

const API = '/api'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-z0-9._]{3,30}$/i
const EVM_RE = /^0x[0-9a-fA-F]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** Envolve um resolver com latência e falhas configuráveis por rota. */
function route<P extends PathParams = PathParams>(key: string, resolver: HttpResponseResolver<P, DefaultBodyType>, emptyBody?: () => Response): HttpResponseResolver<P, DefaultBodyType> {
  return async (info) => {
    const inj = await injected(key)
    if (inj === 'empty') return emptyBody ? emptyBody() : HttpResponse.json([])
    if (inj) return inj
    return resolver(info)
  }
}

function requireUser(request: Request) {
  const auth = authenticate(request)
  if (auth.ok) return { auth }
  return {
    response: apiError(401, {
      code: auth.code,
      message: auth.code === 'SESSION_EXPIRED' ? 'Sua sessão expirou. Entre novamente.' : 'Autenticação necessária.',
    }),
  }
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return ((await request.json()) ?? {}) as Partial<T>
  } catch {
    return {}
  }
}

const validAddress = (network: Network, address: string) => (network === 'Solana' ? SOL_RE.test(address) : EVM_RE.test(address))
const sessionPayload = (userId: string): SessionResponse => {
  const s = createSession(userId)
  return { token: s.token, expiresAt: s.expiresAt, user: publicUser(findUser(userId)!) }
}

function toDataUrl(buffer: ArrayBuffer, type: string) {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${type};base64,${btoa(bin)}`
}

export const handlers = [
  realtimeHandler,

  http.post(`${API}/newsletter`, route('POST /api/newsletter', async ({ request }) => {
    const { email = '' } = await body<{ email: string }>(request)
    if (!EMAIL_RE.test(email.trim())) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Informe um e-mail válido.', fields: { email: 'Informe um e-mail válido.' } })
    return HttpResponse.json({ ok: true }, { status: 201 })
  })),

  /* -------------------------------- Catálogo ------------------------------- */
  http.get(
    `${API}/highlights`,
    route('GET /api/highlights', () => {
      const body: Highlights = { hero: HERO_IDS.map((id) => summarize(findNft(id)!)), featured: summarize(findNft(FEATURED_ID)!) }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    `${API}/nfts`,
    route(
      'GET /api/nfts',
      async ({ request }) => {
        const url = new URL(request.url)
        if (getScenario().outOfOrder) {
          // Quanto mais requisições em voo, mais rápida a nova: a mais antiga responde por último.
          const g = globalThis as { __kurioInflight?: number }
          const inflight = g.__kurioInflight ?? 0
          g.__kurioInflight = inflight + 1
          await delay(Math.max(100, 1600 - 700 * inflight))
          g.__kurioInflight = (g.__kurioInflight ?? 1) - 1
        }
        return HttpResponse.json(queryCatalog(parseCatalogQuery(url)))
      },
      () => HttpResponse.json({ items: [], page: 1, pageSize: 9, total: 0, totalPages: 1, facets: { categories: {}, networks: {}, priceRange: { min: '0.00', max: '0.00' } } }),
    ),
  ),

  http.get(
    `${API}/nfts/:id`,
    route<{ id: string }>('GET /api/nfts/:id', ({ params }) => {
      const nft = findNft(params.id)
      return nft ? HttpResponse.json(nft) : apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    }),
  ),

  http.get(
    `${API}/nfts/:id/reviews`,
    route<{ id: string }>('GET /api/nfts/:id/reviews', ({ params }) => {
      const nft = findNft(params.id)
      return nft ? HttpResponse.json(reviewsFor(nft.id, nft.reviewsCount)) : apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    }),
  ),

  http.get(
    `${API}/nfts/:id/related`,
    route<{ id: string }>('GET /api/nfts/:id/related', ({ params }) => {
      const nft = findNft(params.id)
      if (!nft) return apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
      const others = db.nfts.filter((n) => n.id !== nft.id)
      const same = others.filter((n) => n.collection === nft.collection)
      return HttpResponse.json([...same, ...others.filter((n) => n.collection !== nft.collection)].slice(0, 10).map(summarize))
    }),
  ),

  /* ------------------------------ Autenticação ----------------------------- */
  http.post(
    `${API}/auth/register`,
    route('POST /api/auth/register', async ({ request }) => {
      const b = await body<RegisterBody>(request)
      const fields: Record<string, string> = {}
      const email = (b.email ?? '').trim().toLowerCase()
      const username = (b.username ?? '').trim()
      if (!USERNAME_RE.test(username)) fields.username = 'Use de 3 a 30 caracteres: letras, números, ponto ou sublinhado.'
      if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
      if ((b.password ?? '').length < 8) fields.password = 'A senha deve ter ao menos 8 caracteres.'
      if (b.password !== b.confirmPassword) fields.confirmPassword = 'As senhas não conferem.'
      if (Object.keys(fields).length) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.', fields })
      if (findUserByEmail(email)) return apiError(409, { code: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado.', fields: { email: 'Este e-mail já está cadastrado.' } })
      if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
        return apiError(409, { code: 'USERNAME_TAKEN', message: 'Este nome de usuário já está em uso.', fields: { username: 'Este nome de usuário já está em uso.' } })
      const salt = randomHex(8)
      const id = `u-${randomHex(6)}`
      db.users.push({ id, email, username, displayName: username, salt, passwordHash: await hashPassword(b.password!, salt), avatarUrl: null })
      db.wallets[id] = []
      persist()
      return HttpResponse.json(sessionPayload(id), { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route('POST /api/auth/login', async ({ request }) => {
      const b = await body<LoginBody>(request)
      const user = findUserByEmail(b.email ?? '')
      if (!user || user.passwordHash !== (await hashPassword(b.password ?? '', user.salt)))
        return apiError(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' })
      return HttpResponse.json(sessionPayload(user.id))
    }),
  ),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    const token = request.headers.get('authorization')?.slice(7)
    db.sessions = db.sessions.filter((s) => s.token !== token)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(
    `${API}/session`,
    route('GET /api/session', ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const s = db.sessions.find((x) => x.token === r.auth.token)!
      return HttpResponse.json({ token: r.auth.token, expiresAt: new Date(s.expiresAt).toISOString(), user: r.auth.user } satisfies SessionResponse)
    }),
  ),

  /* --------------------------------- Perfil -------------------------------- */
  http.get(`${API}/profile`, route('GET /api/profile', ({ request }) => {
    const r = requireUser(request)
    return r.response ?? HttpResponse.json(r.auth.user)
  })),

  http.patch(
    `${API}/profile`,
    route('PATCH /api/profile', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<ProfileBody>(request)
      const fields: Record<string, string> = {}
      const email = (b.email ?? '').trim().toLowerCase()
      if ((b.displayName ?? '').trim().length < 2) fields.displayName = 'Informe ao menos 2 caracteres.'
      if (!USERNAME_RE.test((b.username ?? '').trim())) fields.username = 'Use de 3 a 30 caracteres: letras, números, ponto ou sublinhado.'
      if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
      if (b.ensName && !/^[a-z0-9-]{3,32}$/i.test(b.ensName)) fields.ensName = 'Nome ENS deve ter de 3 a 32 letras, números ou hífen.'
      if (Object.keys(fields).length) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.', fields })
      const other = findUserByEmail(email)
      if (other && other.id !== r.auth.userId) return apiError(409, { code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso.', fields: { email: 'Este e-mail já está em uso.' } })
      if (db.users.some((u) => u.id !== r.auth.userId && u.username.toLowerCase() === b.username!.trim().toLowerCase()))
        return apiError(409, { code: 'USERNAME_TAKEN', message: 'Este nome de usuário já está em uso.', fields: { username: 'Este nome de usuário já está em uso.' } })
      const user = findUser(r.auth.userId)!
      Object.assign(user, {
        displayName: b.displayName!.trim(),
        username: b.username!.trim(),
        email,
        ensName: b.ensName?.trim() || undefined,
        walletNickname: b.walletNickname?.trim() || undefined,
      })
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.post(
    `${API}/profile/avatar`,
    route('POST /api/profile/avatar', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const form = await request.formData().catch(() => null)
      const file = form?.get('avatar')
      if (!(file instanceof File)) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Selecione uma imagem.' })
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return apiError(415, { code: 'UNSUPPORTED_MEDIA', message: 'Use uma imagem PNG, JPG ou WebP.' })
      if (file.size > 1024 * 1024) return apiError(413, { code: 'PAYLOAD_TOO_LARGE', message: 'A imagem deve ter no máximo 1 MB.' })
      const user = findUser(r.auth.userId)!
      user.avatarUrl = toDataUrl(await file.arrayBuffer(), file.type)
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.delete(`${API}/profile/avatar`, route('DELETE /api/profile/avatar', ({ request }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    const user = findUser(r.auth.userId)!
    user.avatarUrl = null
    persist()
    return HttpResponse.json(publicUser(user))
  })),

  http.post(
    `${API}/profile/password`,
    route('POST /api/profile/password', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<PasswordBody>(request)
      const user = findUser(r.auth.userId)!
      if (user.passwordHash !== (await hashPassword(b.currentPassword ?? '', user.salt)))
        return apiError(422, { code: 'VALIDATION_ERROR', message: 'Senha atual incorreta.', fields: { currentPassword: 'Senha atual incorreta.' } })
      const fields: Record<string, string> = {}
      if ((b.newPassword ?? '').length < 8) fields.newPassword = 'A nova senha deve ter ao menos 8 caracteres.'
      else if (b.newPassword === b.currentPassword) fields.newPassword = 'A nova senha deve ser diferente da atual.'
      if (b.newPassword !== b.confirmPassword) fields.confirmPassword = 'As senhas não conferem.'
      if (Object.keys(fields).length) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.', fields })
      user.salt = randomHex(8)
      user.passwordHash = await hashPassword(b.newPassword!, user.salt)
      // Invalida as demais sessões do usuário.
      db.sessions = db.sessions.filter((s) => s.userId !== user.id || s.token === r.auth.token)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* -------------------------------- Carteiras ------------------------------ */
  http.get(`${API}/wallets`, route('GET /api/wallets', ({ request }) => {
    const r = requireUser(request)
    return r.response ?? HttpResponse.json(db.wallets[r.auth.userId] ?? [])
  })),

  http.post(
    `${API}/wallets`,
    route('POST /api/wallets', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<WalletBody>(request)
      const list = db.wallets[r.auth.userId] ?? []
      const fields: Record<string, string> = {}
      if ((b.label ?? '').trim().length < 2) fields.label = 'Informe um apelido com ao menos 2 caracteres.'
      if (!NETWORKS.includes(b.network as Network)) fields.network = 'Selecione uma rede.'
      if (!WALLET_PROVIDERS.includes(b.provider as WalletProvider)) fields.provider = 'Selecione o tipo de carteira.'
      if (b.network && !validAddress(b.network as Network, (b.address ?? '').trim()))
        fields.address = b.network === 'Solana' ? 'Endereço Solana inválido (base58, 32–44 caracteres).' : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
      if (Object.keys(fields).length) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Revise os campos destacados.', fields })
      if (list.some((w) => w.address.toLowerCase() === b.address!.trim().toLowerCase()))
        return apiError(409, { code: 'CONFLICT', message: 'Esta carteira já está cadastrada.', fields: { address: 'Esta carteira já está cadastrada.' } })
      const role = list.length === 0 ? 'primary' : b.role === 'primary' ? 'primary' : 'secondary'
      const wallet = {
        id: `w-${randomHex(5)}`,
        label: b.label!.trim(),
        provider: b.provider as WalletProvider,
        network: b.network as Network,
        address: b.address!.trim(),
        ensName: b.ensName?.trim() || undefined,
        role,
        createdAt: new Date().toISOString(),
      } as const
      db.wallets[r.auth.userId] = [...list.map((w) => (role === 'primary' ? { ...w, role: 'secondary' as const } : w)), wallet]
      persist()
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),

  http.patch(
    `${API}/wallets/:id`,
    route<{ id: string }>('PATCH /api/wallets/:id', async ({ request, params }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<{ role: 'primary'; label: string }>(request)
      const list = db.wallets[r.auth.userId] ?? []
      const target = list.find((w) => w.id === params.id)
      if (!target) return apiError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
      if (b.label !== undefined && b.label.trim().length < 2) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Apelido muito curto.', fields: { label: 'Informe ao menos 2 caracteres.' } })
      db.wallets[r.auth.userId] = list.map((w) =>
        w.id === target.id ? { ...w, role: b.role === 'primary' ? 'primary' : w.role, label: b.label?.trim() ?? w.label } : b.role === 'primary' ? { ...w, role: 'secondary' } : w,
      )
      persist()
      return HttpResponse.json(db.wallets[r.auth.userId])
    }),
  ),

  http.delete(
    `${API}/wallets/:id`,
    route<{ id: string }>('DELETE /api/wallets/:id', ({ request, params }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const list = db.wallets[r.auth.userId] ?? []
      const target = list.find((w) => w.id === params.id)
      if (!target) return apiError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
      const rest = list.filter((w) => w.id !== target.id)
      if (target.role === 'primary' && rest.length) rest[0] = { ...rest[0], role: 'primary' }
      db.wallets[r.auth.userId] = rest
      persist()
      return HttpResponse.json(rest)
    }),
  ),

  /* -------------------------------- Favoritos ------------------------------ */
  http.get(`${API}/favorites`, route('GET /api/favorites', ({ request }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    const ids = db.favorites[r.auth.userId] ?? []
    return HttpResponse.json(ids.map(findNft).filter(Boolean).map((n) => summarize(n!)))
  })),

  http.put(`${API}/favorites/:id`, route<{ id: string }>('PUT /api/favorites/:id', ({ request, params }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    if (!findNft(params.id)) return apiError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
    db.favorites[r.auth.userId] = [...new Set([...(db.favorites[r.auth.userId] ?? []), params.id])]
    persist()
    return HttpResponse.json({ ids: db.favorites[r.auth.userId] })
  })),

  http.delete(`${API}/favorites/:id`, route<{ id: string }>('DELETE /api/favorites/:id', ({ request, params }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    db.favorites[r.auth.userId] = (db.favorites[r.auth.userId] ?? []).filter((x) => x !== params.id)
    persist()
    return HttpResponse.json({ ids: db.favorites[r.auth.userId] })
  })),

  /* -------------------------------- Carrinho ------------------------------- */
  http.get(`${API}/cart`, route('GET /api/cart', ({ request }) => {
    const o = cartOwner(request)
    if ('error' in o) return apiError(401, { code: o.error, message: 'Sessão inválida.' })
    return HttpResponse.json(cartView(o.owner))
  })),

  http.put(
    `${API}/cart/items`,
    route('PUT /api/cart/items', async ({ request }) => {
      const o = cartOwner(request)
      if ('error' in o) return apiError(401, { code: o.error, message: 'Sessão inválida.' })
      const b = await body<CartItemInput & { mode?: 'set' | 'add' }>(request)
      const nft = findNft(b.nftId ?? '')
      const edition = nft?.editions.find((e) => e.id === b.editionId)
      if (!nft || !edition) return apiError(404, { code: 'NOT_FOUND', message: 'NFT ou edição não encontrada.' })
      if (!Number.isInteger(b.quantity) || b.quantity! < 0) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Quantidade deve ser um número inteiro.' })
      const cart = cartOf(o.owner)
      const current = cart.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)
      const quantity = b.mode === 'add' ? (current?.quantity ?? 0) + b.quantity! : b.quantity!
      if (quantity > 0 && edition.available === 0) return apiError(409, { code: 'OUT_OF_STOCK', message: `${nft.name} (${edition.label}) está esgotado.` })
      if (quantity > Math.min(MAX_PER_LINE, edition.available))
        return apiError(409, { code: 'OUT_OF_STOCK', message: `Quantidade máxima disponível: ${Math.min(MAX_PER_LINE, edition.available)}.`, details: { max: Math.min(MAX_PER_LINE, edition.available) } })
      if (quantity === 0) cart.items = cart.items.filter((i) => i !== current)
      else if (current) current.quantity = quantity
      else cart.items.push({ nftId: nft.id, editionId: edition.id, quantity })
      cart.version += 1
      persist()
      return HttpResponse.json(cartView(o.owner))
    }),
  ),

  http.delete(`${API}/cart/items/:nftId/:editionId`, route<{ nftId: string; editionId: string }>('DELETE /api/cart/items', ({ request, params }) => {
    const o = cartOwner(request)
    if ('error' in o) return apiError(401, { code: o.error, message: 'Sessão inválida.' })
    const cart = cartOf(o.owner)
    cart.items = cart.items.filter((i) => !(i.nftId === params.nftId && i.editionId === params.editionId))
    cart.version += 1
    persist()
    return HttpResponse.json(cartView(o.owner))
  })),

  http.put(
    `${API}/cart/coupon`,
    route('PUT /api/cart/coupon', async ({ request }) => {
      const o = cartOwner(request)
      if ('error' in o) return apiError(401, { code: o.error, message: 'Sessão inválida.' })
      const { code = '' } = await body<{ code: string }>(request)
      const v = validateCoupon(code)
      if (!v.ok)
        return apiError(422, {
          code: v.code,
          message: v.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.',
          fields: { code: v.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.' },
        })
      const cart = cartOf(o.owner)
      cart.coupon = v.code
      cart.version += 1
      persist()
      return HttpResponse.json(cartView(o.owner))
    }),
  ),

  http.delete(`${API}/cart/coupon`, route('DELETE /api/cart/coupon', ({ request }) => {
    const o = cartOwner(request)
    if ('error' in o) return apiError(401, { code: o.error, message: 'Sessão inválida.' })
    const cart = cartOf(o.owner)
    cart.coupon = null
    cart.version += 1
    persist()
    return HttpResponse.json(cartView(o.owner))
  })),

  /** Mescla o carrinho do visitante no do usuário após login (somando quantidades até o limite). */
  http.post(
    `${API}/cart/merge`,
    route('POST /api/cart/merge', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const { guestId } = await body<{ guestId: string }>(request)
      const guestKey = `guest:${guestId}`
      const guest = db.carts[guestKey]
      const mine = cartOf(`user:${r.auth.userId}`)
      if (guest?.items.length) {
        for (const gi of guest.items) {
          const ed = findNft(gi.nftId)?.editions.find((e) => e.id === gi.editionId)
          if (!ed) continue
          const cap = Math.min(MAX_PER_LINE, ed.available)
          const cur = mine.items.find((i) => i.nftId === gi.nftId && i.editionId === gi.editionId)
          if (cur) cur.quantity = Math.min(cap, cur.quantity + gi.quantity)
          else if (cap > 0) mine.items.push({ ...gi, quantity: Math.min(cap, gi.quantity) })
        }
        if (!mine.coupon && guest.coupon) mine.coupon = guest.coupon
        mine.version += 1
        delete db.carts[guestKey]
        persist()
      }
      return HttpResponse.json(cartView(`user:${r.auth.userId}`))
    }),
  ),

  /* ----------------------------- Cupom e cotação --------------------------- */
  http.post(`${API}/coupons/validate`, route('POST /api/coupons/validate', async ({ request }) => {
    const { code = '' } = await body<{ code: string }>(request)
    const v = validateCoupon(code)
    return v.ok ? HttpResponse.json({ code: v.code, percentOff: v.percentOff }) : apiError(422, { code: v.code, message: v.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.' })
  })),

  http.post(
    `${API}/quotes`,
    route('POST /api/quotes', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<QuoteBody>(request)
      if (!Array.isArray(b.items) || !NETWORKS.includes(b.network as Network)) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Cotação inválida.' })
      const q = buildQuote(b.items, b.coupon, b.network as Network, r.auth.userId)
      if ('error' in q) return apiError(q.error === 'NOT_FOUND' ? 404 : 422, { code: q.error, message: q.error === 'NOT_FOUND' ? 'Item inexistente.' : q.error === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.' })
      persist()
      return HttpResponse.json(q)
    }),
  ),

  /* --------------------------- Conexão de carteira -------------------------- */
  http.post(
    `${API}/wallet-connections`,
    route('POST /api/wallet-connections', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const b = await body<WalletConnectBody>(request)
      if (!WALLET_PROVIDERS.includes(b.provider as WalletProvider) || !NETWORKS.includes(b.network as Network))
        return apiError(422, { code: 'VALIDATION_ERROR', message: 'Selecione carteira e rede.' })
      await delay(getScenario().latency === 'none' ? 0 : 500)
      if (getScenario().walletConnect === 'reject') return apiError(403, { code: 'WALLET_REJECTED', message: `A conexão foi recusada na ${b.provider}.` })
      if (b.address && !validAddress(b.network as Network, b.address)) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Endereço inválido para a rede.', fields: { address: 'Endereço inválido para a rede.' } })
      const saved = (db.wallets[r.auth.userId] ?? []).find((w) => w.network === b.network && w.provider === b.provider)
      const address = b.address || saved?.address || (b.network === 'Solana' ? `So1${randomHex(20).replace(/[0OIl]/g, 'a')}` : `0x${randomHex(20)}`)
      const conn = { id: `c_${randomHex(6)}`, provider: b.provider as WalletProvider, network: b.network as Network, address, connectedAt: new Date().toISOString(), userId: r.auth.userId }
      db.connections[conn.id] = conn
      persist()
      const { userId: _u, ...pub } = conn
      return HttpResponse.json(pub, { status: 201 })
    }),
  ),

  http.delete(`${API}/wallet-connections/:id`, route<{ id: string }>('DELETE /api/wallet-connections/:id', ({ request, params }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    const c = db.connections[params.id]
    if (c && c.userId === r.auth.userId) delete db.connections[params.id]
    persist()
    return new HttpResponse(null, { status: 204 })
  })),

  /* --------------------------------- Pedidos -------------------------------- */
  http.post(
    `${API}/orders`,
    route('POST /api/orders', async ({ request }) => {
      const r = requireUser(request)
      if (r.response) return r.response
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) return apiError(400, { code: 'VALIDATION_ERROR', message: 'Cabeçalho Idempotency-Key obrigatório.' })
      const b = await body<CreateOrderBody>(request)
      const hash = stableHash({ items: b.items, coupon: b.coupon ?? null, network: b.network, connectionId: b.connectionId, fingerprint: b.fingerprint, quoteId: b.quoteId })
      const idemKey = `${r.auth.userId}:${key}`
      const prior = db.idempotency[idemKey]
      if (prior) {
        if (prior.hash !== hash) return apiError(409, { code: 'IDEMPOTENCY_CONFLICT', message: 'Esta chave de idempotência já foi usada com outro conteúdo.' })
        settleDueOrders()
        const existing = db.orders.find((o) => o.id === prior.orderId)!
        return HttpResponse.json(publicOrder(existing), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }
      if (!Array.isArray(b.items) || !b.items.length || !NETWORKS.includes(b.network as Network) || !b.collector)
        return apiError(422, { code: 'VALIDATION_ERROR', message: 'Pedido incompleto.' })
      const conn = b.connectionId ? db.connections[b.connectionId] : undefined
      if (!conn || conn.userId !== r.auth.userId) return apiError(422, { code: 'VALIDATION_ERROR', message: 'Conecte uma carteira antes de confirmar.' })
      if (conn.network !== b.network) return apiError(422, { code: 'VALIDATION_ERROR', message: 'A carteira conectada é de outra rede.' })
      const quoteRec = db.quotes[b.quoteId ?? '']
      if (!quoteRec || quoteRec.userId !== r.auth.userId) return apiError(409, { code: 'QUOTE_EXPIRED', message: 'Cotação inexistente. Revise o pedido.' })
      if (Date.now() - quoteRec.createdAt > 5 * 60_000) return apiError(409, { code: 'QUOTE_EXPIRED', message: 'A cotação expirou. Revise os valores.' })

      // Cenários: mudanças concorrentes no momento da confirmação.
      const first = b.items[0]
      if (consume('priceChangeOnConfirm')) {
        const ed = findNft(first.nftId)?.editions.find((e) => e.id === first.editionId)
        if (ed) updateEdition(first.nftId, first.editionId, { price: addEth(ed.price, '0.05') })
      }
      if (consume('soldOutOnConfirm')) updateEdition(first.nftId, first.editionId, { available: 0 })

      // Revalida preço, estoque, cupom e taxas.
      const fresh = buildQuote(b.items, b.coupon, b.network as Network, r.auth.userId)
      if ('error' in fresh) return apiError(422, { code: fresh.error, message: fresh.error === 'COUPON_EXPIRED' ? 'O cupom expirou.' : fresh.error === 'COUPON_INVALID' ? 'Cupom inválido.' : 'Item inexistente.' })
      persist()
      if (!fresh.purchasable) return apiError(409, { code: 'OUT_OF_STOCK', message: 'Alguns itens não estão mais disponíveis.', details: { quote: fresh } })
      if (fresh.fingerprint !== b.fingerprint) return apiError(409, { code: 'QUOTE_CHANGED', message: 'Os valores mudaram desde a sua revisão. Confirme a nova cotação.', details: { quote: fresh } })

      const id = `ord_${randomHex(5)}`
      const now = new Date().toISOString()
      const s = getScenario()
      const order: OrderRecord = {
        id,
        userId: r.auth.userId,
        idempotencyKey: key,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        transactionId: transactionIdFor(id),
        version: 1,
        outcome: s.payment === 'confirm' ? 'confirmed' : s.payment === 'decline' ? 'declined' : 'manual',
        settleAt: s.payment === 'manual' ? null : Date.now() + s.paymentDelayMs,
        receipt: {
          lines: fresh.lines.map((l) => ({
            nftId: l.nftId,
            editionId: l.editionId,
            editionLabel: l.editionLabel,
            name: l.name,
            tokenId: l.tokenId,
            image: l.image,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
          subtotal: fresh.subtotal,
          discount: fresh.discount,
          networkFee: fresh.networkFee,
          total: fresh.total,
          coupon: fresh.coupon,
          network: fresh.network,
          walletProvider: conn.provider,
          walletAddress: conn.address,
          collector: b.collector,
        },
      }
      db.orders.push(order)
      db.idempotency[idemKey] = { hash, orderId: id }
      delete db.quotes[b.quoteId!]
      persist()
      // Reserva o estoque (emite nft.updated para todos).
      for (const l of order.receipt.lines) {
        const ed = findNft(l.nftId)!.editions.find((e) => e.id === l.editionId)!
        updateEdition(l.nftId, l.editionId, { available: ed.available - l.quantity })
      }
      if (consume('orderTimeoutAfterCreate')) {
        await delay(getScenario().clientTimeoutMs + 1500)
        return HttpResponse.error()
      }
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),

  http.get(`${API}/orders`, route('GET /api/orders', ({ request }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    settleDueOrders()
    return HttpResponse.json(db.orders.filter((o) => o.userId === r.auth.userId).map(publicOrder).reverse())
  })),

  http.get(`${API}/orders/:id`, route<{ id: string }>('GET /api/orders/:id', ({ request, params }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    settleDueOrders()
    const o = db.orders.find((x) => x.id === params.id)
    return ownsOrder(o, r.auth.userId) ? HttpResponse.json(publicOrder(o!)) : apiError(404, { code: 'NOT_FOUND', message: 'Pedido não encontrado.' })
  })),

  http.get(`${API}/orders/:id/receipt`, route<{ id: string }>('GET /api/orders/:id/receipt', ({ request, params }) => {
    const r = requireUser(request)
    if (r.response) return r.response
    const o = db.orders.find((x) => x.id === params.id)
    if (!ownsOrder(o, r.auth.userId)) return apiError(404, { code: 'NOT_FOUND', message: 'Pedido não encontrado.' })
    if (o!.status !== 'confirmed') return apiError(409, { code: 'CONFLICT', message: 'O recibo fica disponível após a confirmação.' })
    return HttpResponse.json(o!.receipt)
  })),
]

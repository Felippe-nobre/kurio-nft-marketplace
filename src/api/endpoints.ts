import type {
  Cart,
  CartItemInput,
  CatalogPage,
  CatalogQuery,
  CreateOrderBody,
  Highlights,
  LoginBody,
  Nft,
  NftSummary,
  Order,
  PasswordBody,
  ProfileBody,
  Quote,
  QuoteBody,
  Receipt,
  RegisterBody,
  Review,
  SessionResponse,
  User,
  Wallet,
  WalletBody,
  WalletConnectBody,
  WalletConnection,
} from './contracts'
import { request } from './http'

type Opt = { signal?: AbortSignal }

export function catalogParams(q: CatalogQuery) {
  return {
    q: q.q || undefined,
    categories: q.categories?.length ? q.categories.join(',') : undefined,
    networks: q.networks?.length ? q.networks.join(',') : undefined,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    sort: q.sort,
    tab: q.tab,
    page: q.page,
    pageSize: q.pageSize,
  }
}

export const api = {
  highlights: (o: Opt = {}) => request<Highlights>({ url: '/highlights', signal: o.signal }),
  catalog: (q: CatalogQuery, o: Opt = {}) => request<CatalogPage>({ url: '/nfts', params: catalogParams(q), signal: o.signal }),
  nft: (id: string, o: Opt = {}) => request<Nft>({ url: `/nfts/${encodeURIComponent(id)}`, signal: o.signal }),
  reviews: (id: string, o: Opt = {}) => request<Review[]>({ url: `/nfts/${encodeURIComponent(id)}/reviews`, signal: o.signal }),
  related: (id: string, o: Opt = {}) => request<NftSummary[]>({ url: `/nfts/${encodeURIComponent(id)}/related`, signal: o.signal }),

  register: (b: RegisterBody) => request<SessionResponse>({ url: '/auth/register', method: 'POST', data: b }),
  login: (b: LoginBody) => request<SessionResponse>({ url: '/auth/login', method: 'POST', data: b }),
  logout: () => request<void>({ url: '/auth/logout', method: 'POST' }),
  session: (o: Opt = {}) => request<SessionResponse>({ url: '/session', signal: o.signal }),

  profile: (o: Opt = {}) => request<User>({ url: '/profile', signal: o.signal }),
  updateProfile: (b: ProfileBody) => request<User>({ url: '/profile', method: 'PATCH', data: b }),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return request<User>({ url: '/profile/avatar', method: 'POST', data: form })
  },
  removeAvatar: () => request<User>({ url: '/profile/avatar', method: 'DELETE' }),
  changePassword: (b: PasswordBody) => request<void>({ url: '/profile/password', method: 'POST', data: b }),

  wallets: (o: Opt = {}) => request<Wallet[]>({ url: '/wallets', signal: o.signal }),
  addWallet: (b: WalletBody) => request<Wallet>({ url: '/wallets', method: 'POST', data: b }),
  updateWallet: (id: string, b: { role?: 'primary'; label?: string }) => request<Wallet[]>({ url: `/wallets/${id}`, method: 'PATCH', data: b }),
  removeWallet: (id: string) => request<Wallet[]>({ url: `/wallets/${id}`, method: 'DELETE' }),

  favorites: (o: Opt = {}) => request<NftSummary[]>({ url: '/favorites', signal: o.signal }),
  addFavorite: (id: string) => request<{ ids: string[] }>({ url: `/favorites/${id}`, method: 'PUT' }),
  removeFavorite: (id: string) => request<{ ids: string[] }>({ url: `/favorites/${id}`, method: 'DELETE' }),

  cart: (o: Opt = {}) => request<Cart>({ url: '/cart', signal: o.signal }),
  setCartItem: (b: CartItemInput & { mode?: 'set' | 'add' }) => request<Cart>({ url: '/cart/items', method: 'PUT', data: b }),
  removeCartItem: (nftId: string, editionId: string) => request<Cart>({ url: `/cart/items/${nftId}/${editionId}`, method: 'DELETE' }),
  applyCoupon: (code: string) => request<Cart>({ url: '/cart/coupon', method: 'PUT', data: { code } }),
  removeCoupon: () => request<Cart>({ url: '/cart/coupon', method: 'DELETE' }),
  /** Recebe o token explicitamente: o merge roda antes de a sessão ser publicada no cliente. */
  mergeCart: (guestId: string, token: string) =>
    request<Cart>({ url: '/cart/merge', method: 'POST', data: { guestId }, headers: { Authorization: `Bearer ${token}` } }),

  quote: (b: QuoteBody) => request<Quote>({ url: '/quotes', method: 'POST', data: b }),
  connectWallet: (b: WalletConnectBody) => request<WalletConnection>({ url: '/wallet-connections', method: 'POST', data: b }),
  disconnectWallet: (id: string) => request<void>({ url: `/wallet-connections/${id}`, method: 'DELETE' }),

  createOrder: (b: CreateOrderBody, idempotencyKey: string) =>
    request<Order>({ url: '/orders', method: 'POST', data: b, headers: { 'Idempotency-Key': idempotencyKey } }),
  orders: (o: Opt = {}) => request<Order[]>({ url: '/orders', signal: o.signal }),
  order: (id: string, o: Opt = {}) => request<Order>({ url: `/orders/${encodeURIComponent(id)}`, signal: o.signal }),
  receipt: (id: string, o: Opt = {}) => request<Receipt>({ url: `/orders/${encodeURIComponent(id)}/receipt`, signal: o.signal }),
}

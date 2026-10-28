/**
 * Contratos REST e de eventos compartilhados entre o cliente (Axios/TanStack Query)
 * e a API simulada (MSW). Valores em ETH trafegam SEMPRE como string decimal
 * (ex.: "1.19"); quantidades são inteiros.
 */

export type EthAmount = string
export type Network = 'Ethereum' | 'Polygon' | 'Solana'
export const NETWORKS: Network[] = ['Ethereum', 'Polygon', 'Solana']
export type WalletProvider = 'MetaMask' | 'WalletConnect' | 'Coinbase Wallet'
export const WALLET_PROVIDERS: WalletProvider[] = ['MetaMask', 'WalletConnect', 'Coinbase Wallet']

export const CATEGORIES = [
  'Arte digital',
  'Fotografia',
  'Música',
  'Arte 3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
] as const
export type Category = (typeof CATEGORIES)[number]

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'OUT_OF_STOCK'
  | 'QUOTE_CHANGED'
  | 'QUOTE_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WALLET_REJECTED'
  | 'UNSUPPORTED_MEDIA'
  | 'PAYLOAD_TOO_LARGE'
  | 'CONFLICT'
  | 'INTERNAL'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fields?: Record<string, string>
  details?: unknown
}

export interface Edition {
  id: string // ex.: "1-50"
  label: string // ex.: "1/50"
  price: EthAmount
  supply: number
  available: number
}

export interface Nft {
  id: string
  name: string
  tokenId: string
  category: Category
  collection: string
  network: Network
  creator: string
  description: string
  attributes: string[]
  image: string
  gallery: string[]
  price: EthAmount // preço da edição padrão
  oldPrice?: EthAmount
  defaultEditionId: string
  editions: Edition[]
  available: number // soma das edições
  rare: boolean
  isNew: boolean
  trending: number
  listedAt: string
  rating: number
  reviewsCount: number
  contract: string
  /** Versão monotônica do recurso. Eventos Socket.IO carregam a mesma versão. */
  version: number
}

export type NftSummary = Pick<
  Nft,
  'id' | 'name' | 'tokenId' | 'image' | 'price' | 'oldPrice' | 'available' | 'rare' | 'network' | 'category' | 'version' | 'defaultEditionId'
>

export type CatalogSort = 'recent' | 'price_asc' | 'price_desc' | 'name'
export type CatalogTab = 'all' | 'new' | 'trending'

export interface CatalogQuery {
  q?: string
  categories?: Category[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
  pageSize?: number
}

export interface CatalogPage {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    categories: Record<string, number>
    networks: Record<string, number>
    priceRange: { min: EthAmount; max: EthAmount }
  }
}

export interface Highlights {
  hero: NftSummary[]
  featured: NftSummary
}

export interface Review {
  id: string
  author: string
  rating: number
  text: string
  date: string
}

/* ------------------------------ Conta/sessão ------------------------------ */

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  ensName?: string
  walletNickname?: string
  avatarUrl?: string | null
}

export interface SessionResponse {
  token: string
  expiresAt: string
  user: User
}

export interface RegisterBody {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface LoginBody {
  email: string
  password: string
}

export interface ProfileBody {
  displayName: string
  username: string
  email: string
  ensName?: string
  walletNickname?: string
}

export interface PasswordBody {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface Wallet {
  id: string
  label: string
  provider: WalletProvider
  network: Network
  address: string
  ensName?: string
  role: 'primary' | 'secondary'
  createdAt: string
}

export interface WalletBody {
  label: string
  provider: WalletProvider
  network: Network
  address: string
  ensName?: string
  role?: 'primary' | 'secondary'
}

/* --------------------------------- Carrinho -------------------------------- */

export interface CartItemInput {
  nftId: string
  editionId: string
  quantity: number
}

export interface CartLine extends CartItemInput {
  name: string
  tokenId: string
  image: string
  editionLabel: string
  unitPrice: EthAmount
  lineTotal: EthAmount
  available: number
}

export interface Cart {
  owner: string
  items: CartLine[]
  coupon: { code: string; percentOff: number } | null
  version: number
  count: number
  /** Totais estimados (taxa de rede padrão: Ethereum). A cotação final vem de POST /quotes. */
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
}

/* ------------------------------ Cotação/pedido ----------------------------- */

export interface QuoteBody {
  items: CartItemInput[]
  coupon?: string | null
  network: Network
}

export interface QuoteLine extends CartLine {
  status: 'ok' | 'price_changed' | 'insufficient_stock' | 'sold_out'
}

export interface Quote {
  id: string
  /** Impressão digital do conteúdo; muda quando preço, estoque, cupom ou taxa mudam. */
  fingerprint: string
  lines: QuoteLine[]
  coupon: { code: string; percentOff: number } | null
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  network: Network
  issues: string[]
  purchasable: boolean
  createdAt: string
  expiresAt: string
}

export interface CollectorInfo {
  displayName: string
  username: string
  email: string
  profileName: string
  referralCode?: string
  ensName?: string
  note?: string
}

export interface CreateOrderBody {
  quoteId: string
  fingerprint: string
  items: CartItemInput[]
  coupon?: string | null
  network: Network
  connectionId: string
  collector: CollectorInfo
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface ReceiptLine {
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: string
  quantity: number
  unitPrice: EthAmount
  lineTotal: EthAmount
}

/** Recibo imutável: snapshot dos valores no momento da criação do pedido. */
export interface Receipt {
  lines: ReceiptLine[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon: { code: string; percentOff: number } | null
  network: Network
  walletProvider: WalletProvider
  walletAddress: string
  collector: CollectorInfo
}

export interface Order {
  id: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  transactionId: string
  declineReason?: string
  receipt: Receipt
  version: number
}

/* ------------------------------ Conexão carteira --------------------------- */

export interface WalletConnectBody {
  provider: WalletProvider
  network: Network
  address?: string
}

export interface WalletConnection {
  id: string
  provider: WalletProvider
  network: Network
  address: string
  connectedAt: string
}

/* --------------------------------- Eventos -------------------------------- */

export interface RealtimeEvent<TType extends string, TData> {
  /** Identidade estável do evento (deduplicação). */
  eventId: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  /** Versão do recurso após o evento (ordenação). */
  version: number
  occurredAt: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft.updated',
  { price: EthAmount; available: number; editions: Edition[]; oldPrice?: EthAmount }
>
export type OrderUpdatedEvent = RealtimeEvent<
  'order.updated',
  { status: OrderStatus; transactionId: string; declineReason?: string; updatedAt: string }
>

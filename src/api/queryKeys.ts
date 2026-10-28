import type { CatalogQuery } from './contracts'

/**
 * Chaves do TanStack Query. Dados públicos são compartilhados; dados privados
 * ficam sob ['private', scope, ...] — scope = "user:<id>" ou "guest:<id>" —
 * para isolar o cache por usuário e permitir limpeza total no logout/troca.
 */
export const qk = {
  highlights: ['highlights'] as const,
  catalogAll: ['catalog'] as const,
  catalog: (q: CatalogQuery) => ['catalog', q] as const,
  nft: (id: string) => ['nft', id] as const,
  reviews: (id: string) => ['nft', id, 'reviews'] as const,
  related: (id: string) => ['nft', id, 'related'] as const,
  privateAll: ['private'] as const,
  privateScope: (scope: string) => ['private', scope] as const,
  cart: (scope: string) => ['private', scope, 'cart'] as const,
  favorites: (scope: string) => ['private', scope, 'favorites'] as const,
  wallets: (scope: string) => ['private', scope, 'wallets'] as const,
  profile: (scope: string) => ['private', scope, 'profile'] as const,
  orders: (scope: string) => ['private', scope, 'orders'] as const,
  order: (scope: string, id: string) => ['private', scope, 'order', id] as const,
}

import { createRootRouteWithContext, createRoute, createRouter, redirect, lazyRouteComponent } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { CatalogQuery, CatalogSort, CatalogTab, Category, Network } from '@/api/contracts'
import { CATEGORIES, NETWORKS } from '@/api/contracts'
import { isEthAmount } from '@/lib/money'
import { sessionStore } from '@/lib/session'
import { RootLayout } from './RootLayout'
import { HomePage } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'

/* ----------------------------- Busca do catálogo ---------------------------- */

export interface HomeSearch {
  q?: string
  cat?: string
  net?: string
  min?: string
  max?: string
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
}

const SORTS: CatalogSort[] = ['recent', 'price_asc', 'price_desc', 'name']
const TABS: CatalogTab[] = ['all', 'new', 'trending']

export function validateHomeSearch(raw: Record<string, unknown>): HomeSearch {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : typeof v === 'number' ? String(v) : undefined)
  const page = Number(raw.page)
  const cat = str(raw.cat)?.split(',').filter((c) => (CATEGORIES as readonly string[]).includes(c)).join(',')
  const net = str(raw.net)?.split(',').filter((n) => (NETWORKS as string[]).includes(n)).join(',')
  const min = str(raw.min)
  const max = str(raw.max)
  return {
    q: str(raw.q),
    cat: cat || undefined,
    net: net || undefined,
    min: min && isEthAmount(min) ? min : undefined,
    max: max && isEthAmount(max) ? max : undefined,
    sort: SORTS.includes(raw.sort as CatalogSort) ? (raw.sort as CatalogSort) : undefined,
    tab: TABS.includes(raw.tab as CatalogTab) ? (raw.tab as CatalogTab) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export const toCatalogQuery = (s: HomeSearch): CatalogQuery => ({
  q: s.q,
  categories: (s.cat?.split(',').filter(Boolean) ?? []) as Category[],
  networks: (s.net?.split(',').filter(Boolean) ?? []) as Network[],
  minPrice: s.min,
  maxPrice: s.max,
  sort: s.sort ?? 'recent',
  tab: s.tab ?? 'all',
  page: s.page ?? 1,
  pageSize: 9,
})

/* ---------------------------------- Rotas ---------------------------------- */

const PRIVATE = [/^\/checkout/, /^\/pedido\//, /^\/profile/, /^\/wallets/, /^\/favorites/, /^\/activity/]
export const isPrivatePath = (path: string) => PRIVATE.some((r) => r.test(path))

/** Proteção de rota: exige sessão válida e preserva o retorno após o login. */
const requireAuth = ({ location }: { location: { href: string } }) => {
  const s = sessionStore.get()
  if (!s.token || sessionStore.isExpired()) {
    if (s.token) sessionStore.end('expired')
    throw redirect({ to: '/login', search: { redirect: location.href, reason: sessionStore.get().endedReason === 'expired' ? 'expired' : undefined } })
  }
}

interface AuthSearch {
  redirect?: string
  reason?: 'expired'
}
const validateAuthSearch = (raw: Record<string, unknown>): AuthSearch & HomeSearch => ({
  ...validateHomeSearch(raw),
  // Só aceita retorno interno (evita open redirect).
  redirect: typeof raw.redirect === 'string' && raw.redirect.startsWith('/') && !raw.redirect.startsWith('//') ? raw.redirect : undefined,
  reason: raw.reason === 'expired' ? 'expired' : undefined,
})

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', validateSearch: validateHomeSearch, component: HomePage })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(() => import('@/pages/AuthPage'), 'LoginPage'),
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(() => import('@/pages/AuthPage'), 'RegisterPage'),
})

const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$id', component: lazyRouteComponent(() => import('@/pages/Nft'), 'NftPage') })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: lazyRouteComponent(() => import('@/pages/Cart'), 'CartPage') })
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Checkout'), 'CheckoutPage'),
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$id',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Order'), 'OrderPage'),
})
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Profile'), 'ProfilePage'),
})
const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Wallets'), 'WalletsPage'),
})
const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Favorites'), 'FavoritesPage'),
})
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/Activity'), 'ActivityPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  profileRoute,
  walletsRoute,
  favoritesRoute,
  activityRoute,
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

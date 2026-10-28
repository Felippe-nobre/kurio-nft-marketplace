import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, LogOut, Menu, Search, ShoppingCart, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetClose, SheetTrigger } from '@/components/ui/sheet'
import { openSearch } from '@/components/SearchDialog'
import { useSession } from '@/lib/session'
import { useCart } from '@/hooks/useCart'
import { useLogout } from '@/hooks/useAuth'
import { useRealtimeStatus } from '@/lib/realtime'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Início', to: '/', hash: undefined, match: (p: string) => p === '/' || p === '/login' || p === '/cadastro' },
  { label: 'Mercado', to: '/', hash: 'catalogo', match: (p: string) => /^\/(nft|cart|checkout|pedido)/.test(p) },
  { label: 'Criadores', to: '/', hash: 'criadores', match: () => false },
  { label: 'Aprenda', to: '/', hash: 'aprenda', match: () => false },
] as const

/** Rotas com tela mobile própria no Figma (sem o cabeçalho do site). */
export const MOBILE_CHROMELESS = /^\/($|nft\/|cart$|checkout$|login$|cadastro$)/

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isAuthenticated, user } = useSession()
  const cart = useCart()
  const logout = useLogout()
  const navigate = useNavigate()
  const rt = useRealtimeStatus()
  const count = cart.data?.count ?? 0

  // Figma mobile: nestas telas o cabeçalho do site dá lugar à barra inferior
  // (Início) ou à barra com botão de voltar (Detalhes, Carrinho, Pagamento),
  // e Login/Cadastro são telas cheias.
  const hideOnMobile = MOBILE_CHROMELESS.test(pathname)

  return (
    <header className={cn('container-kurio', hideOnMobile && 'max-md:hidden')}>
      <div className="flex h-[68px] items-center gap-4 border-b border-line">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" aria-describedby={undefined}>
            <SheetTitle className="text-sm font-bold tracking-[0.2em]">KURIO</SheetTitle>
            <nav aria-label="Principal (menu)">
              <ul className="space-y-1">
                {NAV.map((n) => (
                  <li key={n.label}>
                    <SheetClose asChild>
                      <Link to={n.to} hash={n.hash} className={cn('block py-2 text-base', n.match(pathname) ? 'text-brand-strong' : 'text-text')} aria-current={n.match(pathname) ? 'page' : undefined}>
                        {n.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
                {isAuthenticated && (
                  <>
                    <li className="border-t border-line pt-2">
                      <SheetClose asChild>
                        <Link to="/profile" className="block py-2">Meu perfil</Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link to="/wallets" className="block py-2">Carteiras</Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link to="/favorites" className="block py-2">Lista de interesse</Link>
                      </SheetClose>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="text-sm font-bold tracking-[0.18em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="mx-auto hidden h-full md:block">
          <ul className="flex h-full items-stretch gap-10">
            {NAV.map((n) => {
              const active = n.match(pathname)
              return (
                <li key={n.label} className="flex">
                  <Link
                    to={n.to}
                    hash={n.hash}
                    aria-current={active ? 'page' : undefined}
                    className={cn('relative flex items-center text-[15px] tracking-wide', active ? 'font-bold text-brand-strong after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-brand' : 'text-text hover:text-brand-strong')}
                  >
                    {n.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button variant="ghost" size="icon" aria-label="Buscar NFTs" onClick={(e) => openSearch(e.currentTarget)}>
            <Search className="!size-6" aria-hidden="true" />
          </Button>
          <Link to="/cart" className="relative flex size-10 items-center justify-center" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} data-testid="cart-link">
            <ShoppingCart className="size-6" aria-hidden="true" />
            <span className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground" aria-hidden="true" data-testid="cart-count">
              {count}
            </span>
          </Link>
          <span className="sr-only" aria-live="polite">
            {rt === 'reconnecting' ? 'Reconectando tempo real' : ''}
          </span>
          <span
            className={cn('hidden size-2 rounded-full sm:block', rt === 'connected' ? 'bg-success' : rt === 'reconnecting' || rt === 'connecting' ? 'bg-brand' : 'bg-subtle')}
            title={rt === 'connected' ? 'Tempo real conectado' : rt === 'reconnecting' ? 'Reconectando…' : 'Tempo real desconectado'}
            data-testid="realtime-status"
            data-status={rt}
          />
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1">
              <Link to="/profile" className="flex items-center gap-2 rounded-[3px] px-2 py-1 hover:bg-surface-2" aria-label={`Minha conta (${user.displayName})`}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-8 rounded-full object-cover" /> : <User className="size-5 text-brand" aria-hidden="true" />}
                <span className="hidden max-w-32 truncate text-sm lg:inline">{user.displayName}</span>
              </Link>
              <Button variant="ghost" size="icon" aria-label="Sair da conta" onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}>
                <LogOut aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" className="h-9 px-2.5 text-base font-medium">
              <Link to="/login" search={{ redirect: pathname === '/login' ? undefined : pathname }}>
                <LogIn aria-hidden="true" className="!size-5" />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>

    </header>
  )
}


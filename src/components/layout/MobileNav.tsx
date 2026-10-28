import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { openSearch } from '@/components/SearchDialog'
import { useCart } from '@/hooks/useCart'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

/**
 * Barra de navegação inferior do Figma mobile (Início): Início, Favoritos,
 * botão central (busca), Carrinho e Conta. Só aparece abaixo de 768 px.
 */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isAuthenticated, user } = useSession()
  const count = useCart().data?.count ?? 0
  const item = 'flex size-12 items-center justify-center rounded-full'
  const tone = (active: boolean) => (active ? 'text-brand' : 'text-muted hover:text-brand-strong')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto h-24 max-w-[480px] rounded-t-[40px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <ul className="grid h-full grid-cols-5 items-center px-3 pb-1">
          <li className="flex justify-center">
            <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={cn(item, tone(pathname === '/'))}>
              <House className="size-5 fill-current" aria-hidden="true" />
            </Link>
          </li>
          <li className="flex justify-center">
            <Link to="/favorites" aria-label="Lista de interesse" className={cn(item, tone(pathname === '/favorites'))}>
              <Heart className="size-5 fill-current" aria-hidden="true" />
            </Link>
          </li>
          <li className="flex justify-center">
            <button
              type="button"
              aria-label="Buscar NFTs"
              onClick={(e) => openSearch(e.currentTarget)}
              className="absolute -top-[30px] left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#a8683b] text-text ring-8 ring-bg"
            >
              <ScanLine className="size-6" aria-hidden="true" />
            </button>
          </li>
          <li className="flex justify-center">
            <Link to="/cart" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className={cn(item, 'relative', tone(pathname === '/cart'))}>
              <ShoppingCart className="size-5 fill-current" aria-hidden="true" />
              {count > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground" aria-hidden="true">
                  {count}
                </span>
              )}
            </Link>
          </li>
          <li className="flex justify-center">
            {isAuthenticated && user ? (
              <Link to="/profile" aria-label={`Minha conta (${user.displayName})`} className={cn(item, tone(false))}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <User className="size-5 fill-current" aria-hidden="true" />}
              </Link>
            ) : (
              <Link to="/login" aria-label="Entrar" className={cn(item, tone(false))}>
                <User className="size-5 fill-current" aria-hidden="true" />
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  )
}

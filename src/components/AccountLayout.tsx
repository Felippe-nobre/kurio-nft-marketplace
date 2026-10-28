import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import { useLogout } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'Dados do perfil', to: '/profile', Icon: User },
  { label: 'Carteiras', to: '/wallets', Icon: MapPin },
  { label: 'Atividade', to: '/activity', Icon: ShoppingCart },
  { label: 'Lista de interesse', to: '/favorites', Icon: Heart },
  { label: 'Ofertas', Icon: LineChart },
  { label: 'Arquivos baixados', Icon: Download },
  { label: 'Suporte', Icon: LifeBuoy },
] as const

/** Layout da área do colecionador (Figma: menu lateral "Meu perfil"). */
export function AccountLayout({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="container-kurio grid grid-cols-[minmax(0,1fr)] gap-6 pt-8 md:grid-cols-[230px_1fr] lg:grid-cols-[310px_1fr] lg:gap-7">
      <nav aria-label="Minha conta" className="h-fit min-w-0 bg-surface py-3">
        <h2 className="px-2.5 pb-2 text-lg font-bold">Meu perfil</h2>
        <ul className="relative flex gap-1 overflow-x-auto md:block">
          {ITEMS.map(({ label, Icon, ...rest }) => {
            const to = 'to' in rest ? rest.to : undefined
            const active = to === pathname
            return (
              <li key={label} className="shrink-0">
                {to ? (
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 border-l-4 px-3 py-2.5 text-[15px] hover:text-brand-strong', active ? 'border-brand text-brand-strong' : 'border-transparent text-muted')}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-3 border-l-4 border-transparent px-3 py-2.5 text-[15px] text-subtle" aria-disabled="true" title="Em breve">
                    <Icon className="size-4" aria-hidden="true" />
                    {label} <span className="sr-only">(em breve)</span>
                  </span>
                )}
              </li>
            )
          })}
          <li className="shrink-0 md:mt-1 md:border-t md:border-line">
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] font-bold text-brand-strong hover:underline"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <section aria-labelledby="account-title" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 id="account-title" className="text-lg font-bold">
            {title}
          </h1>
          {actions}
        </div>
        {children}
      </section>
    </div>
  )
}

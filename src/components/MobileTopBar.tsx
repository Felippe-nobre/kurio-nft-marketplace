import type { ReactNode } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra superior das telas mobile do Figma (Detalhes, Carrinho, Pagamento):
 * botão circular de voltar, título opcional e ação opcional à direita.
 * Só aparece abaixo de 768 px; no desktop o cabeçalho do site continua.
 */
export function MobileTopBar({ title, fallback = '/', action, overlay = false }: { title?: string; fallback?: '/' | '/cart'; action?: ReactNode; overlay?: boolean }) {
  const router = useRouter()
  const navigate = useNavigate()
  const back = () => {
    // Volta no histórico do app; em acesso direto (sem página anterior no app) vai para o destino padrão.
    if (router.history.canGoBack()) router.history.back()
    else void navigate({ to: fallback })
  }
  return (
    <div className={cn('flex items-center gap-4 md:hidden', overlay ? 'absolute inset-x-0 top-0 z-10 justify-between px-7 pt-5' : 'pb-4 pt-5')}>
      <button
        type="button"
        onClick={back}
        aria-label="Voltar"
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#2f1d15] text-brand-strong hover:text-text"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      {title && <p className={cn('flex-1 truncate text-xl font-bold', !action && 'pr-[34px] text-center')}>{title}</p>}
      {action}
    </div>
  )
}

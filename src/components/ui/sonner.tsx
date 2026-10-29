import { useSyncExternalStore } from 'react'
import { Toaster as Sonner } from 'sonner'

const MOBILE = '(max-width: 767px)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const isMobile = () => window.matchMedia(MOBILE).matches

/**
 * Toaster do shadcn/ui (sonner) com a paleta da Kurio. No mobile os avisos
 * ficam no topo: embaixo cobririam as barras de ação fixas do Figma
 * ("Comprar NFT", "Conectar e finalizar", "Confirmar compra").
 */
export function Toaster() {
  const mobile = useSyncExternalStore(subscribe, isMobile, () => false)
  return (
    <Sonner
      position={mobile ? 'top-center' : 'bottom-right'}
      theme="dark"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-surface border border-line text-text font-sans',
          description: 'text-muted',
          error: 'border-danger',
          success: 'border-success',
        },
      }}
    />
  )
}

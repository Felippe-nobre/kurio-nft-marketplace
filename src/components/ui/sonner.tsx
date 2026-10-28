import { Toaster as Sonner } from 'sonner'

/** Toaster do shadcn/ui (sonner) com a paleta da Kurio. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
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

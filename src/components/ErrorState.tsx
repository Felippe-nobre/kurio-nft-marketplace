import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({ title = 'Não foi possível carregar.', message, onRetry, retrying }: { title?: string; message?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border border-danger/50 bg-danger/5 p-5">
      <p className="font-bold text-danger">{title}</p>
      {message && <p className="text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw aria-hidden="true" className={retrying ? 'animate-spin' : undefined} />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

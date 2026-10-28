import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { AccountLayout } from '@/components/AccountLayout'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

const LABEL = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusado' } as const

export function ActivityPage() {
  const { scope } = useSession()
  const orders = useQuery({ queryKey: qk.orders(scope), queryFn: ({ signal }) => api.orders({ signal }), staleTime: 0 })
  useEffect(() => {
    document.title = 'Atividade — Kurio'
  }, [])
  return (
    <AccountLayout title="Atividade">
      {orders.isPending ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : orders.isError ? (
        <div className="mt-6">
          <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} />
        </div>
      ) : orders.data.length === 0 ? (
        <p className="mt-6 text-sm">Nenhuma compra ainda.</p>
      ) : (
        <ul className="mt-6 space-y-3" data-testid="orders-list">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link to="/pedido/$id" params={{ id: o.id }} className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 hover:bg-surface-2">
                <span>
                  <b>{o.id}</b>
                  <span className="block text-xs text-muted">
                    {formatDate(o.createdAt)} · {o.receipt.lines.reduce((a, l) => a + l.quantity, 0)} NFT(s)
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-bold text-brand-strong">{o.receipt.total} ETH</span>
                  <Badge variant={o.status === 'confirmed' ? 'success' : o.status === 'declined' ? 'danger' : 'warning'}>{LABEL[o.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}

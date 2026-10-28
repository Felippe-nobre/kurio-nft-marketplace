import { useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Order } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { useRealtimeStatus } from '@/lib/realtime'
import { clearAttempt, pendingOrder } from '@/lib/idempotency'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ErrorState'
import { formatDate, shortAddress } from '@/lib/utils'

const TERMINAL = new Set(['confirmed', 'declined'])

/** Estado do pedido: REST + eventos order.updated; nunca regride uma versão/estado terminal. */
function useOrder(id: string) {
  const qc = useQueryClient()
  const { scope } = useSession()
  const rt = useRealtimeStatus()
  return useQuery({
    queryKey: qk.order(scope, id),
    queryFn: async ({ signal }) => {
      const fresh = await api.order(id, { signal })
      const cached = qc.getQueryData<Order>(qk.order(scope, id))
      if (cached && (cached.version > fresh.version || (TERMINAL.has(cached.status) && !TERMINAL.has(fresh.status)))) return cached
      return fresh
    },
    staleTime: 0,
    // Fallback: sem tempo real, consulta o estado enquanto o pedido estiver pendente.
    refetchInterval: (q) => (q.state.data?.status === 'pending' && rt !== 'connected' ? 2000 : false),
    retry: (count, e) => !(isApiError(e) && e.status === 404) && count < 2,
  })
}

export function OrderPage() {
  const { id } = useParams({ from: '/pedido/$id' })
  const { user } = useSession()
  const navigate = useNavigate()
  const order = useOrder(id)
  const status = order.data?.status

  useEffect(() => {
    document.title = status === 'confirmed' ? 'Pedido confirmado — Kurio' : status === 'declined' ? 'Pagamento recusado — Kurio' : 'Pedido em processamento — Kurio'
    if (user && status && TERMINAL.has(status)) {
      if (pendingOrder.get(user.id) === id) pendingOrder.clear(user.id)
      clearAttempt(user.id)
    }
  }, [status, user, id])

  return (
    <div className="min-h-[70vh]">
      <Dialog open onOpenChange={(o) => !o && void navigate({ to: status === 'declined' ? '/checkout' : '/' })}>
        <DialogContent className="max-w-[580px] p-0" closeLabel="Fechar e voltar" onInteractOutside={(e) => e.preventDefault()}>
          {order.isPending ? (
            <div className="space-y-4 p-8" aria-busy="true">
              <DialogTitle className="sr-only">Carregando pedido</DialogTitle>
              <Skeleton className="mx-auto size-20" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : order.isError ? (
            <div className="p-8">
              <DialogTitle className="mb-4">Pedido</DialogTitle>
              {isApiError(order.error) && order.error.status === 404 ? (
                <p role="alert">Pedido não encontrado.</p>
              ) : (
                <ErrorState message={order.error.message} onRetry={() => void order.refetch()} retrying={order.isFetching} />
              )}
            </div>
          ) : order.data.status === 'pending' ? (
            <Pending order={order.data} />
          ) : order.data.status === 'declined' ? (
            <Declined order={order.data} />
          ) : (
            <Confirmed order={order.data} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Pending({ order }: { order: Order }) {
  const rt = useRealtimeStatus()
  return (
    <div className="p-8 text-center" data-testid="order-pending">
      <Loader2 className="mx-auto size-12 animate-spin text-brand" aria-hidden="true" />
      <DialogTitle className="mt-4 text-brand-strong">Pedido pendente</DialogTitle>
      <DialogDescription className="mt-2">
        Aguardando a confirmação do pagamento na rede {order.receipt.network}. Você pode atualizar a página com segurança: o pedido não será duplicado.
      </DialogDescription>
      <dl className="mt-6 grid gap-2 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold">Pedido</dt>
          <dd data-testid="order-id">{order.id}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold">Transação simulada</dt>
          <dd className="font-mono">{shortAddress(order.transactionId)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold">Total</dt>
          <dd>{order.receipt.total} ETH</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted" aria-live="polite">
        {rt === 'connected' ? 'Acompanhando em tempo real.' : 'Reconectando ao tempo real… consultando o estado periodicamente.'}
      </p>
    </div>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <div className="p-8 text-center" data-testid="order-declined">
      <XCircle className="mx-auto size-14 text-danger" aria-hidden="true" />
      <DialogTitle className="mt-4">Pagamento recusado</DialogTitle>
      <DialogDescription className="mt-2">{order.declineReason ?? 'A transação não foi autorizada.'} Nenhum valor foi cobrado e seu carrinho foi mantido.</DialogDescription>
      <p className="mt-4 text-xs text-muted">Pedido {order.id}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link to="/checkout">Tentar novamente</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/cart">Ver carrinho</Link>
        </Button>
      </div>
    </div>
  )
}

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 64 80" className="mx-auto h-20 w-16" aria-hidden="true" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M6 38 L32 18 L58 38 V74 H6 Z" />
      <path d="M12 42 V8 H52 V42" fill="var(--color-surface)" />
      <path d="M6 38 L32 58 L58 38" />
      <path d="M6 74 L26 54 M58 74 L38 54" />
      <text x="32" y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-brand)" stroke="none" fontFamily="sans-serif">
        THANK
      </text>
      <text x="32" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-brand)" stroke="none" fontFamily="sans-serif">
        YOU
      </text>
    </svg>
  )
}

function Confirmed({ order }: { order: Order }) {
  const r = order.receipt
  return (
    <div data-testid="order-confirmed">
      <div className="px-6 pt-6 text-center">
        <ThankYouIcon />
        <DialogTitle className="mt-3 text-[15px] font-bold text-brand-strong">Seus NFTs agora estão na sua carteira</DialogTitle>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-y-3 border-y border-line px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-line">
        <div className="sm:pr-3">
          <dt className="font-bold">ID da transação</dt>
          <dd className="font-mono text-muted" title={order.transactionId} data-testid="tx-id">
            {shortAddress(order.transactionId, 6, 4)}
          </dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Data</dt>
          <dd>{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted">Total</dt>
          <dd>{r.total} ETH</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold">Carteira</dt>
          <dd className="text-muted">{r.walletProvider}</dd>
        </div>
      </dl>
      <div className="px-6 py-4 sm:px-11">
        <DialogDescription className="font-bold text-text">Detalhes da transação</DialogDescription>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Itens comprados (recibo)</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="pb-2 text-left font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={`${l.nftId}-${l.editionId}`} data-testid="receipt-line">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img src={l.image} alt="" width={52} height={52} className="size-[52px] shrink-0 object-contain" />
                    <div>
                      <p className="font-bold">{l.name}</p>
                      <p className="text-xs text-muted">ID do token: {l.tokenId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-muted">(x {l.quantity})</td>
                <td className="text-right text-base font-bold text-brand-strong">{l.lineTotal} ETH</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-[15px]">
            {r.coupon && (
              <tr>
                <th scope="row" colSpan={2} className="pt-2 text-right font-normal">
                  Desconto ({r.coupon.code})
                </th>
                <td className="pt-2 text-right">(-) {r.discount} ETH</td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={2} className="pt-2 text-right font-normal">
                Taxa de rede
              </th>
              <td className="pt-2 text-right">{r.networkFee} ETH</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" colSpan={2} className="pb-2 text-right font-bold">
                Total
              </th>
              <td className="pb-2 text-right text-lg font-bold text-brand-strong" data-testid="receipt-total">
                {r.total} ETH
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-center text-sm text-muted">
          Transação confirmada na {r.network} (simulação). A propriedade foi transferida para sua carteira conectada ({shortAddress(r.walletAddress)}) e registrada na rede.
        </p>
        <div className="mt-6 flex justify-center pb-4">
          <Button className="h-11 px-4 text-base" onClick={() => toast.info('Esta é uma transação simulada: ela não existe no Etherscan.')}>
            Ver no Etherscan
          </Button>
        </div>
      </div>
    </div>
  )
}

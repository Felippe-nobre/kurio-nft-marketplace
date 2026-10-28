import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useCart, useSetQuantity } from '@/hooks/useCart'
import { useHighlights, useRelated } from '@/hooks/useCatalog'
import { Breadcrumb } from '@/components/Breadcrumb'
import { QuantityStepper } from '@/components/QuantityStepper'
import { CouponForm, Totals } from '@/components/Summary'
import { NftRail } from '@/components/NftRail'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect } from 'react'

const MAX_PER_LINE = 10

export function CartPage() {
  const cart = useCart()
  const setQty = useSetQuantity()
  const firstId = cart.data?.items[0]?.nftId
  const related = useRelated(firstId ?? '1')
  const highlights = useHighlights()

  useEffect(() => {
    document.title = 'Carrinho — Kurio'
  }, [])

  return (
    <div className="container-kurio pt-8">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Carrinho' }]} />
      <h1 className="sr-only">Carrinho</h1>
      {cart.isPending ? (
        <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_330px] lg:gap-20" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[70px] w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : cart.isError ? (
        <div className="mt-6">
          <ErrorState message={cart.error.message} onRetry={() => void cart.refetch()} retrying={cart.isFetching} />
        </div>
      ) : cart.data.items.length === 0 ? (
        <div className="mt-10 border border-line p-10 text-center" data-testid="cart-empty">
          <p className="text-lg font-bold">Seu carrinho está vazio.</p>
          <p className="mt-2 text-sm text-muted">Explore o mercado e adicione NFTs para continuar.</p>
          <Button asChild className="mt-6">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-1 grid gap-10 lg:grid-cols-[1fr_330px] lg:gap-20">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            <table className="w-full border-separate border-spacing-y-3 text-left">
              <caption className="sr-only">NFTs no carrinho com preço, quantidade e total</caption>
              <thead className="hidden md:table-header-group">
                <tr className="text-[15px]">
                  <th scope="col" className="border-b border-line pb-2 font-bold">
                    NFTs
                  </th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">
                    Preço
                  </th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">
                    Edições
                  </th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">
                    Total
                  </th>
                  <th scope="col" className="border-b border-line pb-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.data.items.map((l) => {
                  const max = Math.min(MAX_PER_LINE, l.available)
                  const over = l.quantity > l.available
                  return (
                    <tr key={`${l.nftId}-${l.editionId}`} className="bg-surface max-md:grid max-md:grid-cols-[70px_1fr_auto] max-md:gap-x-3 max-md:gap-y-2 max-md:p-3" data-testid="cart-line">
                      <td className="max-md:row-span-2 md:w-[45%]">
                        <div className="flex items-center gap-3">
                          <img src={l.image} alt="" width={70} height={70} className="size-[70px] shrink-0 bg-surface-2 object-contain" />
                          <div className="max-md:hidden">
                            <Link to="/nft/$id" params={{ id: l.nftId }} className="font-bold hover:text-brand-strong">
                              {l.name}
                            </Link>
                            <p className="text-sm text-muted">
                              ID do token: {l.tokenId} · Edição {l.editionLabel}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="md:hidden">
                        <Link to="/nft/$id" params={{ id: l.nftId }} className="font-bold">
                          {l.name}
                        </Link>
                        <p className="text-xs text-muted">Edição {l.editionLabel}</p>
                      </td>
                      <td className="font-bold text-brand-strong max-md:col-start-3 max-md:row-start-1 max-md:text-right">
                        <span className="md:hidden sr-only">Preço unitário: </span>
                        {l.unitPrice} ETH
                      </td>
                      <td className="max-md:col-start-2">
                        <QuantityStepper size="sm" label={`${l.name} (${l.editionLabel})`} value={l.quantity} min={1} max={Math.max(l.quantity, max)} onChange={(q) => setQty.mutate({ nftId: l.nftId, editionId: l.editionId, quantity: q })} />
                        {over && (
                          <p className="mt-1 text-xs text-danger" role="alert">
                            {l.available === 0 ? 'Esgotado' : `Apenas ${l.available} disponível(is)`}
                          </p>
                        )}
                      </td>
                      <td className="font-bold text-brand-strong max-md:col-start-3 max-md:text-right" data-testid="line-total">
                        <span className="sr-only">Total da linha: </span>
                        {l.lineTotal} ETH
                      </td>
                      <td className="text-right max-md:col-start-3">
                        <button
                          type="button"
                          className="inline-flex size-9 items-center justify-center text-muted hover:text-danger"
                          aria-label={`Remover ${l.name} (${l.editionLabel}) do carrinho`}
                          onClick={() => setQty.mutate({ nftId: l.nftId, editionId: l.editionId, quantity: 0 })}
                        >
                          <Trash2 className="size-5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <aside aria-labelledby="summary-title" className="h-fit">
            <h2 id="summary-title" className="border-b border-line pb-3 text-lg font-bold">
              Resumo da carteira
            </h2>
            <div className="mt-6">
              <CouponForm applied={cart.data.coupon} />
            </div>
            <div className="mt-6">
              <Totals subtotal={cart.data.subtotal} discount={cart.data.discount} networkFee={cart.data.networkFee} total={cart.data.total} couponLabel={cart.data.coupon?.code} busy={setQty.isPending || cart.isFetching} />
            </div>
            <Button asChild className="mt-6 w-full">
              <Link to="/checkout">Conectar e finalizar</Link>
            </Button>
            <Link to="/" hash="catalogo" className="mt-3 block text-center text-sm text-brand-strong hover:underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}
      <NftRail title="Colecionadores também viram" items={firstId ? related.data : highlights.data ? [highlights.data.featured, ...highlights.data.hero] : undefined} loading={firstId ? related.isPending : highlights.isPending} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Heart, Linkedin, Mail, Star, Twitter, ZoomIn } from 'lucide-react'
import type { Nft } from '@/api/contracts'
import { useNft, useRelated, useReviews } from '@/hooks/useCatalog'
import { useAddToCart } from '@/hooks/useCart'
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import { useSession } from '@/lib/session'
import { Breadcrumb } from '@/components/Breadcrumb'
import { QuantityStepper } from '@/components/QuantityStepper'
import { NftRail } from '@/components/NftRail'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import { isApiError } from '@/api/http'

const MAX_PER_LINE = 10

export function NftPage() {
  const { id } = useParams({ from: '/nft/$id' })
  const { data, isPending, isError, error, refetch, isFetching } = useNft(id)
  const related = useRelated(id)

  useEffect(() => {
    document.title = data ? `${data.name} — Kurio` : 'NFT — Kurio'
  }, [data])

  return (
    <div className="container-kurio pt-8">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, ...(data ? [{ label: data.name }] : [])]} />
      {isPending ? (
        <DetailSkeleton />
      ) : isError ? (
        isApiError(error) && error.status === 404 ? (
          <NftNotFound />
        ) : (
          <div className="mt-8">
            <ErrorState message={error.message} onRetry={() => void refetch()} retrying={isFetching} />
          </div>
        )
      ) : (
        <Detail nft={data} />
      )}
      {!(isError && isApiError(error) && error.status === 404) && <NftRail title="Mais desta coleção" items={related.data} loading={related.isPending} />}
    </div>
  )
}

function NftNotFound() {
  return (
    <section className="mx-auto mt-16 max-w-lg text-center" aria-labelledby="nf-title">
      <h1 id="nf-title" className="text-2xl font-bold">
        NFT não encontrado
      </h1>
      <p role="alert" className="mt-3 text-muted">
        NFT não encontrado. O link pode estar incorreto ou o item foi removido do mercado.
      </p>
      <Button asChild className="mt-6">
        <Link to="/" hash="catalogo">
          Explorar o mercado
        </Link>
      </Button>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="mt-4 grid gap-8 md:grid-cols-[100px_minmax(0,444px)_1fr]" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <div className="hidden flex-col gap-4 md:flex">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

function Detail({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  const add = useAddToCart()
  const { isAuthenticated } = useSession()
  const favs = useFavorites()
  const toggleFav = useToggleFavorite()
  const [editionId, setEditionId] = useState(nft.defaultEditionId)
  const [qty, setQty] = useState(1)
  const [imgIndex, setImgIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const reviews = useReviews(nft.id, tab === 'reviews')

  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]
  const max = Math.min(MAX_PER_LINE, edition.available)
  const soldOut = edition.available === 0
  const isFav = !!favs.data?.some((f) => f.id === nft.id)
  const image = nft.gallery[imgIndex] ?? nft.image

  // Disponibilidade pode mudar em tempo real: mantém a quantidade dentro do limite.
  useEffect(() => {
    if (max > 0 && qty > max) setQty(max)
  }, [max, qty])

  const buy = () =>
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, name: `${nft.name} (${edition.label})` },
      { onSuccess: () => void navigate({ to: '/cart' }) },
    )

  return (
    <>
      <div className="mt-4 grid gap-6 md:grid-cols-[100px_minmax(0,444px)] lg:grid-cols-[100px_minmax(0,444px)_1fr] lg:gap-8">
        <ul className="order-2 flex gap-3 md:order-none md:flex-col md:gap-4" aria-label="Galeria">
          {nft.gallery.map((src, i) => (
            <li key={src} className="w-20 md:w-full">
              <button
                type="button"
                onClick={() => setImgIndex(i)}
                aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                aria-pressed={imgIndex === i}
                className={cn('block aspect-square w-full overflow-hidden rounded-[3px] border', imgIndex === i ? 'border-brand' : 'border-transparent')}
              >
                <img src={src} alt="" width={100} height={100} className="h-full w-full bg-surface object-contain" />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative bg-surface p-5">
          <img src={image} alt={`${nft.name}, arte do NFT`} width={404} height={404} className="aspect-square w-full object-contain" />
          <button type="button" onClick={() => setZoom(true)} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-bg/80 text-text" aria-label="Ampliar imagem">
            <ZoomIn className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="md:col-span-2 lg:col-span-1">
          <h1 className="text-[2rem] font-bold leading-tight">{nft.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <p className="text-2xl font-bold text-brand-strong" data-testid="detail-price">
              <span className="sr-only">Preço da edição {edition.label}: </span>
              {edition.price} ETH
              {edition.id === nft.defaultEditionId && nft.oldPrice && <s className="ml-2 text-base font-normal text-subtle">{nft.oldPrice} ETH</s>}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <span className="flex text-brand-strong" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn('size-3.5', i < Math.round(nft.rating) && 'fill-current')} />
                ))}
              </span>
              <span>
                <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                {nft.reviewsCount} avaliações de colecionadores
              </span>
            </p>
          </div>

          <h2 className="mt-4 text-sm font-bold">Sobre este NFT:</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Um colecionável digital finalizado à mão da coleção {nft.collection}, verificado na {nft.network}, com arte desbloqueável e acesso para colecionadores.
          </p>

          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {nft.editions.map((e) => (
                <label
                  key={e.id}
                  className={cn(
                    'cursor-pointer rounded-full border px-2 py-0.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-strong',
                    e.id === editionId ? 'border-brand text-text' : 'border-line text-muted',
                    e.available === 0 && 'line-through opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="edition"
                    value={e.id}
                    className="sr-only"
                    checked={e.id === editionId}
                    onChange={() => {
                      setEditionId(e.id)
                      setQty(1)
                    }}
                  />
                  {e.label}
                  <span className="sr-only">{e.available === 0 ? ' (esgotada)' : ` (${e.available} disponíveis, ${e.price} ETH)`}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted" aria-live="polite" data-testid="availability">
              {soldOut ? 'Edição esgotada.' : `${edition.available} de ${edition.supply} disponíveis nesta edição.`}
            </p>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <QuantityStepper label={nft.name} value={soldOut ? 0 : qty} min={1} max={Math.max(1, max)} onChange={setQty} disabled={soldOut} />
            <div className="ml-auto flex gap-2">
              <Button className="h-10 w-[130px] text-sm uppercase" onClick={buy} disabled={soldOut || add.isPending}>
                {soldOut ? 'Esgotado' : add.isPending ? 'Adicionando…' : 'Comprar'}
              </Button>
              {isAuthenticated ? (
                <Button variant="outline" className="h-10" aria-pressed={isFav} onClick={() => toggleFav.mutate({ nft, favorite: !isFav })}>
                  <Heart className={cn(isFav && 'fill-current text-brand-strong')} aria-hidden="true" />
                  {isFav ? 'Favoritado' : 'Favoritar'}
                </Button>
              ) : (
                <Button asChild variant="outline" className="h-10">
                  <Link to="/login" search={{ redirect: `/nft/${nft.id}` }}>
                    <Heart aria-hidden="true" />
                    Favoritar
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {add.isError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {add.error.message}
            </p>
          )}

          <dl className="mt-5 space-y-2 text-sm text-muted">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.collection}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center gap-3 text-sm font-bold">
            Compartilhar este NFT:
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(location.href)}`} target="_blank" rel="noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)">
              <Linkedin className="size-4" aria-hidden="true" />
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(location.href)}`} aria-label="Compartilhar por e-mail">
              <Mail className="size-4" aria-hidden="true" />
            </a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(location.href)}`} target="_blank" rel="noreferrer" aria-label="Compartilhar no Twitter (abre em nova aba)">
              <Twitter className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <section className="mt-16" aria-label="Informações do NFT">
        <div role="tablist" aria-label="Informações" className="flex gap-8 border-b border-line">
          {(
            [
              ['details', 'Detalhes do NFT'],
              ['reviews', `Avaliações de colecionadores (${nft.reviewsCount})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              id={`tab-${k}`}
              role="tab"
              type="button"
              aria-selected={tab === k}
              aria-controls={`panel-${k}`}
              tabIndex={tab === k ? 0 : -1}
              onClick={() => setTab(k)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const next = k === 'details' ? 'reviews' : 'details'
                  setTab(next)
                  document.getElementById(`tab-${next}`)?.focus()
                }
              }}
              className={cn('-mb-px border-b-2 pb-1 text-lg', tab === k ? 'border-brand text-brand-strong' : 'border-transparent')}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'details' ? (
          <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="mt-3 space-y-4 text-sm leading-6 text-muted">
            <p>{nft.description}</p>
            <div>
              <h3 className="font-bold text-text">Rede:</h3>
              <p>Cunhado na {nft.network} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-bold text-text">Contrato:</h3>
              <p>Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
            </div>
            <div>
              <h3 className="font-bold text-text">Direitos autorais:</h3>
              <p>{nft.contract} • Contrato inteligente ERC-721 verificado.</p>
            </div>
          </div>
        ) : (
          <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="mt-4" aria-busy={reviews.isPending}>
            {reviews.isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : reviews.isError ? (
              <ErrorState message={reviews.error.message} onRetry={() => void reviews.refetch()} />
            ) : (
              <ul className="space-y-4">
                {reviews.data.map((r) => (
                  <li key={r.id} className="border-b border-line pb-3 text-sm">
                    <p className="font-bold">
                      {r.author} <span className="font-normal text-muted">· {formatDate(r.date)}</span>
                    </p>
                    <p className="text-brand-strong" aria-label={`Nota ${r.rating} de 5`}>
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </p>
                    <p className="text-muted">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-3xl border-b-0 p-4">
          <DialogTitle className="sr-only">{nft.name} ampliado</DialogTitle>
          <img src={image} alt={`${nft.name}, imagem ampliada`} className="w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}

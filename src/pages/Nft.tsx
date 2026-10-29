import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Heart, Linkedin, Mail, ShoppingCart, Star, Twitter, ZoomIn } from 'lucide-react'
import type { Nft } from '@/api/contracts'
import { useNft, useRelated, useReviews } from '@/hooks/useCatalog'
import { useAddToCart } from '@/hooks/useCart'
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import { useSession } from '@/lib/session'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MobileTopBar } from '@/components/MobileTopBar'
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
    <div className="container-kurio pt-8 max-md:pb-44 max-md:pt-0">
      {!data && <MobileTopBar fallback="/" />}
      <Breadcrumb className="max-md:hidden" items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, ...(data ? [{ label: data.name }] : [])]} />
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

  // Botão de carrinho do Figma mobile: adiciona sem sair da página (o hook já avisa).
  const addOnly = () => add.mutate({ nftId: nft.id, editionId: edition.id, quantity: qty, name: `${nft.name} (${edition.label})` })

  // Figma mobile: favorito em círculo no topo, ao lado do botão de voltar.
  const favCls = 'flex size-[34px] items-center justify-center rounded-full border border-line text-brand-strong'
  const mobileFav = isAuthenticated ? (
    <button type="button" className={favCls} aria-pressed={isFav} aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`} onClick={() => toggleFav.mutate({ nft, favorite: !isFav })}>
      <Heart className={cn('size-4', isFav && 'fill-current')} aria-hidden="true" />
    </button>
  ) : (
    <Link to="/login" search={{ redirect: `/nft/${nft.id}` }} className={favCls} aria-label={`Entrar para favoritar ${nft.name}`}>
      <Heart className="size-4" aria-hidden="true" />
    </Link>
  )

  return (
    <>
      <MobileTopBar fallback="/" action={mobileFav} className="pb-[9px] pt-[23px]" />
      <div className="mt-4 grid gap-6 max-md:mt-0 max-md:gap-0 md:grid-cols-[100px_minmax(0,444px)] lg:grid-cols-[100px_minmax(0,444px)_1fr] lg:gap-8">
        <ul className="order-2 flex gap-3 max-md:hidden md:order-none md:flex-col md:gap-4" aria-label="Galeria">
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

        <div className="relative bg-surface p-5 max-md:bg-transparent max-md:p-0">
          <img src={image} alt={`${nft.name}, arte do NFT`} width={404} height={404} className="aspect-square w-full object-contain max-md:rounded-2xl max-md:object-cover" />
          <button type="button" onClick={() => setZoom(true)} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-bg/80 text-text max-md:hidden" aria-label="Ampliar imagem">
            <ZoomIn className="size-5" aria-hidden="true" />
          </button>
          {/* Mobile: toque na arte amplia; as miniaturas viram pontos sobre a imagem. */}
          <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 rounded-2xl md:hidden" aria-label="Ampliar imagem" />
          {nft.gallery.length > 1 && (
            <div className="absolute inset-x-0 bottom-12 z-10 flex justify-center gap-2 md:hidden" role="group" aria-label="Galeria">
              {nft.gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setImgIndex(i)}
                  aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                  aria-pressed={imgIndex === i}
                  className={cn('size-2.5 rounded-full border border-bg/40', imgIndex === i ? 'bg-brand' : 'bg-text/60')}
                />
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2 lg:col-span-1 max-md:relative max-md:z-10 max-md:-mx-6 max-md:-mt-[35px] max-md:rounded-t-[28px] max-md:bg-surface max-md:px-6 max-md:pb-6 max-md:pt-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[2rem] font-bold leading-tight max-md:text-xl">{nft.name}</h1>
            <p className="flex shrink-0 items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-[13px] md:hidden">
              <Star className="size-3.5 fill-current text-brand-strong" aria-hidden="true" />
              <span className="sr-only">Nota </span>
              <span className="font-bold">{nft.rating.toFixed(1)}</span>
              <span className="text-muted">
                <span className="sr-only">de 5, </span>({nft.reviewsCount}
                <span className="sr-only"> avaliações</span>)
              </span>
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 max-md:hidden">
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

          <h2 className="mt-4 text-sm font-bold max-md:sr-only">Sobre este NFT:</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            <span className="md:hidden">
              Um colecionável digital {edition.label} finalizado à mão da coleção {nft.collection}, verificado na {nft.network}.
            </span>
            <span className="max-md:hidden">
              Um colecionável digital finalizado à mão da coleção {nft.collection}, verificado na {nft.network}, com arte desbloqueável e acesso para colecionadores.
            </span>
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
            <p className="mt-2 text-xs text-muted max-md:sr-only" aria-live="polite" data-testid="availability">
              {soldOut ? 'Edição esgotada.' : `${edition.available} de ${edition.supply} disponíveis nesta edição.`}
            </p>
          </fieldset>

          {/* Figma mobile: barra fixa inferior com Qtd., preço, "Comprar NFT" e botão de carrinho. */}
          <div className="mt-4 flex flex-wrap items-center gap-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:mt-0 max-md:gap-4 max-md:rounded-t-[28px] max-md:bg-surface max-md:px-6 max-md:pb-[34px] max-md:pt-5 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3 max-md:w-full">
              <span className="text-sm md:hidden" aria-hidden="true">
                Qtd.
              </span>
              <QuantityStepper label={nft.name} value={soldOut ? 0 : qty} min={1} max={Math.max(1, max)} onChange={setQty} disabled={soldOut} />
              <p className="ml-auto text-xl font-bold text-brand-strong md:hidden">
                <span className="sr-only">Preço da edição {edition.label}: </span>
                {edition.price} ETH
              </p>
            </div>
            <div className="ml-auto flex gap-2 max-md:ml-0 max-md:gap-3">
              <Button
                className="h-10 w-[130px] text-sm uppercase max-md:h-[60px] max-md:w-[196px] max-md:rounded-full max-md:bg-gradient-to-r max-md:from-brand max-md:to-[#a8683b] max-md:text-[15px] max-md:normal-case"
                onClick={buy}
                disabled={soldOut || add.isPending}
              >
                {soldOut ? (
                  'Esgotado'
                ) : add.isPending ? (
                  'Adicionando…'
                ) : (
                  <>
                    <span className="md:hidden">Comprar NFT</span>
                    <span className="max-md:hidden">Comprar</span>
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={addOnly}
                disabled={soldOut || add.isPending}
                aria-label={`Adicionar ${nft.name} ao carrinho`}
                className="flex size-[60px] items-center justify-center rounded-full bg-[#2f1d15] text-brand-strong disabled:opacity-50 md:hidden"
              >
                <ShoppingCart className="size-5 fill-current" aria-hidden="true" />
              </button>
              {isAuthenticated ? (
                <Button variant="outline" className="h-10 max-md:hidden" aria-pressed={isFav} onClick={() => toggleFav.mutate({ nft, favorite: !isFav })}>
                  <Heart className={cn(isFav && 'fill-current text-brand-strong')} aria-hidden="true" />
                  {isFav ? 'Favoritado' : 'Favoritar'}
                </Button>
              ) : (
                <Button asChild variant="outline" className="h-10 max-md:hidden">
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

          <dl className="mt-5 space-y-2 text-sm text-muted max-md:mt-3 max-md:space-y-3">
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

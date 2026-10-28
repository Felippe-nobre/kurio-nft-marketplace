import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/hooks/useCart'
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import { useSession } from '@/lib/session'
import { cn, fetchPriority } from '@/lib/utils'

/** Figma mobile: só o favorito, em círculo no canto superior direito da arte. */
function MobileFavorite({ nft, isFav, isAuthenticated, onToggle }: { nft: NftSummary; isFav: boolean; isAuthenticated: boolean; onToggle: () => void }) {
  const cls = 'absolute right-2.5 top-3 flex size-7 items-center justify-center rounded-full bg-bg/60 text-brand-strong md:hidden'
  if (!isAuthenticated)
    return (
      <Link to="/login" search={{ redirect: '/' }} className={cls} aria-label={`Entrar para favoritar ${nft.name}`}>
        <Heart className="size-4" aria-hidden="true" />
      </Link>
    )
  return (
    <button type="button" className={cls} aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`} aria-pressed={isFav} onClick={onToggle}>
      <Heart className={cn('size-4', isFav && 'fill-current')} aria-hidden="true" />
    </button>
  )
}

/** Card do catálogo (Figma: imagem em moldura escura, nome e preço em ETH). */
export function NftCard({ nft, priority = false, compact = false }: { nft: NftSummary; priority?: boolean; compact?: boolean }) {
  const add = useAddToCart()
  const toggle = useToggleFavorite()
  const favs = useFavorites()
  const { isAuthenticated } = useSession()
  const isFav = !!favs.data?.some((f) => f.id === nft.id)
  const soldOut = nft.available === 0

  return (
    <article className="group relative flex flex-col" aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      {/* Figma mobile: moldura arredondada (16px) com a arte quadrada arredondada (12px) e 20px abaixo. */}
      <div className="relative aspect-[258/300] min-h-0 bg-surface p-1 max-md:aspect-auto max-md:rounded-2xl max-md:pb-5 max-md:pt-3">
        <Link to="/nft/$id" params={{ id: nft.id }} className="block h-full max-md:h-auto" tabIndex={-1} aria-hidden="true">
          <img
            src={nft.image}
            alt=""
            width={250}
            height={250}
            loading={priority ? 'eager' : 'lazy'}
            {...fetchPriority(priority)}
            decoding="async"
            className="h-full w-full object-contain max-md:aspect-square max-md:h-auto max-md:rounded-xl max-md:object-cover"
          />
        </Link>
        {nft.rare && <span className="absolute left-0 top-4 bg-brand px-3 py-0.5 text-sm font-bold text-primary-foreground max-md:px-2 max-md:py-1.5 max-md:text-xs max-md:font-normal">RARO</span>}
        {soldOut && <span className="absolute right-2 top-4 rounded-full bg-bg/90 px-3 py-0.5 text-xs font-bold text-danger">Esgotado</span>}
        {!compact && <MobileFavorite nft={nft} isFav={isFav} isAuthenticated={isAuthenticated} onToggle={() => toggle.mutate({ nft, favorite: !isFav })} />}
        {!compact && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-100 transition-opacity max-md:hidden md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-[4px] bg-surface/90 text-text hover:text-brand-strong disabled:opacity-40"
              aria-label={`Adicionar ${nft.name} ao carrinho`}
              disabled={soldOut || add.isPending}
              onClick={() => add.mutate({ nftId: nft.id, editionId: nft.defaultEditionId, quantity: 1, name: nft.name })}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
            </button>
            {isAuthenticated && (
              <button
                type="button"
                className={cn('flex size-8 items-center justify-center rounded-[4px] bg-surface/90 hover:text-brand-strong', isFav ? 'text-brand-strong' : 'text-text')}
                aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
                aria-pressed={isFav}
                onClick={() => toggle.mutate({ nft, favorite: !isFav })}
              >
                <Heart className={cn('size-4', isFav && 'fill-current')} aria-hidden="true" />
              </button>
            )}
            <Link to="/nft/$id" params={{ id: nft.id }} className="flex size-8 items-center justify-center rounded-[4px] bg-surface/90 text-text hover:text-brand-strong" aria-label={`Ver detalhes de ${nft.name}`}>
              <Search className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <h3 id={`nft-${nft.id}-name`} className="mt-5 text-[15px] max-md:mt-2.5 max-md:px-2 max-md:text-sm">
        <Link to="/nft/$id" params={{ id: nft.id }} className="hover:text-brand-strong">
          {nft.name}
        </Link>
      </h3>
      <p className="mt-1 text-lg font-bold text-brand-strong max-md:mt-0 max-md:px-2 max-md:text-sm" data-testid="nft-price">
        <span className="sr-only">Preço: </span>
        {nft.price} ETH{' '}
        {nft.oldPrice && (
          <s className="ml-1 font-normal text-subtle">
            <span className="sr-only">preço anterior </span>
            {nft.oldPrice} ETH
          </s>
        )}
      </p>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[258/300] w-full rounded-none max-md:aspect-[175/199] max-md:rounded-2xl" />
      <Skeleton className="mt-5 h-5 w-3/4" />
      <Skeleton className="mt-2 h-6 w-1/3" />
    </div>
  )
}

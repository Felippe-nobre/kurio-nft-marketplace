import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/hooks/useCart'
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import { useSession } from '@/lib/session'
import { cn, fetchPriority } from '@/lib/utils'

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
      <div className="relative aspect-[258/300] min-h-0 bg-surface p-1">
        <Link to="/nft/$id" params={{ id: nft.id }} className="block h-full" tabIndex={-1} aria-hidden="true">
          <img
            src={nft.image}
            alt=""
            width={250}
            height={250}
            loading={priority ? 'eager' : 'lazy'}
            {...fetchPriority(priority)}
            decoding="async"
            className="h-full w-full object-contain"
          />
        </Link>
        {nft.rare && <span className="absolute left-0 top-4 bg-brand px-3 py-0.5 text-sm font-bold text-primary-foreground">RARO</span>}
        {soldOut && <span className="absolute right-2 top-4 rounded-full bg-bg/90 px-3 py-0.5 text-xs font-bold text-danger">Esgotado</span>}
        {!compact && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
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
      <h3 id={`nft-${nft.id}-name`} className="mt-5 text-[15px]">
        <Link to="/nft/$id" params={{ id: nft.id }} className="hover:text-brand-strong">
          {nft.name}
        </Link>
      </h3>
      <p className="mt-1 text-lg font-bold text-brand-strong" data-testid="nft-price">
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
      <Skeleton className="aspect-[258/300] w-full rounded-none" />
      <Skeleton className="mt-5 h-5 w-3/4" />
      <Skeleton className="mt-2 h-6 w-1/3" />
    </div>
  )
}

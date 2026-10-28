import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useFavorites } from '@/hooks/useFavorites'
import { AccountLayout } from '@/components/AccountLayout'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { ErrorState } from '@/components/ErrorState'

export function FavoritesPage() {
  const favs = useFavorites()
  useEffect(() => {
    document.title = 'Lista de interesse — Kurio'
  }, [])
  return (
    <AccountLayout title="Lista de interesse">
      {favs.isPending ? (
        <ul className="mt-6 grid grid-cols-2 gap-6 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favs.isError ? (
        <div className="mt-6">
          <ErrorState message={favs.error.message} onRetry={() => void favs.refetch()} retrying={favs.isFetching} />
        </div>
      ) : favs.data.length === 0 ? (
        <p className="mt-6 text-sm">
          Você ainda não favoritou nenhum NFT.{' '}
          <Link to="/" hash="catalogo" className="text-brand-strong underline">
            Explorar o mercado
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 xl:grid-cols-3" data-testid="favorites-grid">
          {favs.data.map((n) => (
            <li key={n.id}>
              <NftCard nft={n} />
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}

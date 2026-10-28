import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NftSummary } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { announce } from '@/lib/announcer'
import { toast } from 'sonner'

export function useFavorites() {
  const { scope, isAuthenticated } = useSession()
  return useQuery({ queryKey: qk.favorites(scope), queryFn: ({ signal }) => api.favorites({ signal }), enabled: isAuthenticated, staleTime: 10_000 })
}

/** Favoritar com atualização otimista e rollback se a mutation falhar. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const key = qk.favorites(scope)
  return useMutation({
    mutationFn: ({ nft, favorite }: { nft: NftSummary; favorite: boolean }) => (favorite ? api.addFavorite(nft.id) : api.removeFavorite(nft.id)),
    onMutate: async ({ nft, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<NftSummary[]>(key)
      qc.setQueryData<NftSummary[]>(key, (old = []) => (favorite ? [...old.filter((n) => n.id !== nft.id), nft] : old.filter((n) => n.id !== nft.id)))
      return { previous }
    },
    onError: (_e, { nft }, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      const msg = `Não foi possível atualizar os favoritos de ${nft.name}. A alteração foi desfeita.`
      toast.error(msg)
      announce(msg, 'assertive')
    },
    onSuccess: (_d, { nft, favorite }) => announce(favorite ? `${nft.name} adicionado aos favoritos.` : `${nft.name} removido dos favoritos.`),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

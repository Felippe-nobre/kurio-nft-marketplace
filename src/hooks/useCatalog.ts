import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CatalogQuery, Nft } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'

export function useHighlights() {
  return useQuery({ queryKey: qk.highlights, queryFn: ({ signal }) => api.highlights({ signal }) })
}

/**
 * Catálogo: a chave inclui todos os parâmetros; o TanStack Query cancela a
 * requisição anterior (AbortSignal repassado ao Axios) e descarta respostas
 * de chaves obsoletas, então respostas fora de ordem nunca sobrescrevem a atual.
 */
export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: qk.catalog(query),
    queryFn: ({ signal }) => api.catalog(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

/** Detalhe com proteção de versão: uma resposta REST antiga não sobrescreve um evento mais novo. */
export function useNft(id: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.nft(id),
    queryFn: async ({ signal }) => {
      const fresh = await api.nft(id, { signal })
      const cached = qc.getQueryData<Nft>(qk.nft(id))
      return cached && cached.version > fresh.version ? cached : fresh
    },
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

export function useRelated(id: string) {
  return useQuery({ queryKey: qk.related(id), queryFn: ({ signal }) => api.related(id, { signal }) })
}

export function useReviews(id: string, enabled: boolean) {
  return useQuery({ queryKey: qk.reviews(id), queryFn: ({ signal }) => api.reviews(id, { signal }), enabled })
}

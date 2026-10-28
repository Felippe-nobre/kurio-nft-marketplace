import { QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/http'

/**
 * Política de cache/retry (documentada em ARCHITECTURE.md):
 * - staleTime 30 s para dados públicos; privados sobrescrevem com 0–10 s.
 * - retry: até 2 tentativas apenas para erros transitórios (rede, timeout, 5xx), com backoff.
 * - 4xx nunca é repetido automaticamente.
 * - refetchOnWindowFocus/reconnect ativos para reconciliar após ausência.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (count, error) => isApiError(error) && error.isTransient && error.code !== 'CANCELED' && count < 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  })
}

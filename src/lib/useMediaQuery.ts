import { useCallback, useSyncExternalStore } from 'react'

/**
 * Estado de uma media query, lido de forma síncrona já na 1ª renderização (o app não
 * tem SSR), então não há troca de layout depois de montar. Usado para não montar
 * variantes que o CSS esconderia de qualquer forma (ex.: painel de filtros do desktop
 * no mobile), o que evita trabalho de renderização e layouts forçados no carregamento.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Breakpoints do Tailwind usados no layout. */
export const MQ = { md: '(min-width: 768px)', lg: '(min-width: 1024px)' } as const

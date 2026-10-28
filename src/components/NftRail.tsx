import { useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from './NftCard'
import { cn } from '@/lib/utils'

/** Carrossel horizontal (scroll-snap) com indicadores, usado em "Mais desta coleção". */
export function NftRail({ title, items, loading }: { title: string; items?: NftSummary[]; loading?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = 3
  const go = (i: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: ((el.scrollWidth - el.clientWidth) * i) / (pages - 1), behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    setPage(Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (pages - 1)))
  }
  return (
    <section aria-labelledby={`rail-${title}`} className="mt-20">
      <h2 id={`rail-${title}`} className="border-b border-line pb-2 text-lg font-bold text-brand-strong">
        {title}
      </h2>
      <ul ref={ref} onScroll={onScroll} className="relative mt-6 grid snap-x snap-mandatory auto-cols-[min(70vw,220px)] grid-flow-col gap-5 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="snap-start">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="snap-start">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
      <div className="mt-2 flex justify-center gap-2" role="group" aria-label={`Navegar em ${title}`}>
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Ir para a parte ${i + 1} de ${pages}`}
            aria-current={page === i}
            className={cn('size-3 rounded-full border border-brand', page === i && 'bg-brand')}
          />
        ))}
      </div>
    </section>
  )
}

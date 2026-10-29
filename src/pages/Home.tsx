import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, ChevronLeft, ChevronRight, Search, Settings2, SlidersHorizontal, X } from 'lucide-react'
import type { CatalogPage, CatalogSort, CatalogTab, Category, Network } from '@/api/contracts'
import { CATEGORIES, NETWORKS } from '@/api/contracts'
import { useCatalog, useHighlights } from '@/hooks/useCatalog'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toCatalogQuery, type HomeSearch } from '@/app/routes'
import { cn, fetchPriority } from '@/lib/utils'
import { formatEthBr } from '@/lib/money'

/* ----------------------- Conversão de preço sem float ---------------------- */
const toCents = (eth: string) => {
  const [i, f = ''] = eth.split('.')
  return Number(i) * 100 + Number(f.padEnd(2, '0').slice(0, 2))
}
const fromCents = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`

const SORT_LABEL: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  name: 'Nome (A–Z)',
}
/** Figma mobile: grade de 2 colunas escalonada (coluna direita 32px abaixo). */
const MOBILE_GRID = 'max-md:-mt-1 max-md:gap-y-5 max-md:pb-8 max-md:[&>li:nth-child(even)]:translate-y-8'

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

export function HomePage() {
  // O painel de filtros é aberto pelo botão "Filtros" do catálogo (tablet) ou
  // pelo botão ao lado da busca no topo (Figma mobile).
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersTrigger = useRef<HTMLElement | null>(null)
  const openFilters = (el: HTMLElement) => {
    filtersTrigger.current = el
    setFiltersOpen(true)
  }
  return (
    <>
      <MobileSearchBar onOpenFilters={openFilters} />
      <MobileHero />
      <Hero />
      <Catalog filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen} onOpenFilters={openFilters} filtersTrigger={filtersTrigger} />
      <Promos />
      <Journal />
    </>
  )
}

/* ---------------------------------- Hero ---------------------------------- */

function Hero() {
  const { data } = useHighlights()
  const [slide, setSlide] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[slide]
  // A 1ª arte é estática (pré-carregada) para não atrasar o LCP enquanto a API responde.
  const image = current?.image ?? '/img/art/emerald-ape.webp'

  return (
    <section aria-labelledby="hero-title" className="container-kurio grid items-center gap-10 py-10 max-md:hidden md:grid-cols-[1fr_minmax(0,450px)] md:py-8">
      <div className="md:pl-10">
        <p className="text-sm tracking-[0.12em]">Bem-vindo à Kurio</p>
        <h1 id="hero-title" className="mt-5 text-[clamp(2rem,6vw,2.75rem)] font-bold uppercase leading-[1.55] tracking-[0.04em]">
          Seja dono do futuro <br className="hidden sm:block" />
          da arte digital
        </h1>
        <p className="mt-3 max-w-[34rem] text-sm leading-6 tracking-wide text-muted">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
        </p>
        <Button asChild className="mt-11 h-10 w-[140px] text-base uppercase">
          <Link to="/" hash="catalogo">
            Explorar
          </Link>
        </Button>
        <div className="mt-10 flex justify-end gap-2 md:mr-[-6.5rem]" role="group" aria-label="Destaques">
          {(slides.length ? slides : [0, 1, 2]).map((s, i) => (
            <button
              key={i}
              type="button"
              disabled={!slides.length}
              aria-label={typeof s === 'object' ? `Destaque ${i + 1}: ${s.name}` : `Destaque ${i + 1}`}
              aria-current={slide === i}
              onClick={() => setSlide(i)}
              className={cn('size-2 rounded-full bg-brand transition-opacity', slide === i ? 'opacity-100' : 'opacity-50 hover:opacity-80')}
            />
          ))}
        </div>
      </div>
      <figure className="relative mx-auto w-full max-w-[450px]">
        {current ? (
          <Link to="/nft/$id" params={{ id: current.id }} aria-label={`Ver ${current.name}`}>
            <img src={image} alt={current.name} width={450} height={450} className="aspect-square w-full object-contain" {...fetchPriority(true)} />
          </Link>
        ) : (
          <img src={image} alt="Emerald Ape #042, NFT em destaque" width={450} height={450} className="aspect-square w-full object-contain" {...fetchPriority(true)} />
        )}
        {current && <figcaption className="sr-only">{`${current.name}, ${current.price} ETH`}</figcaption>}
      </figure>
    </section>
  )
}


/* ------------------------- Topo mobile (Figma mobile) ------------------------ */

/** Termo de busca com debounce, sincronizado com `?q=` (substitui a entrada do histórico enquanto digita). */
function useSearchTerm() {
  const { search, update } = useHomeSearch()
  const [term, setTerm] = useState(search.q ?? '')
  useEffect(() => setTerm(search.q ?? ''), [search.q])
  useEffect(() => {
    if ((search.q ?? '') === term.trim()) return
    const t = setTimeout(() => void update({ q: term.trim() || undefined }, { replace: true }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])
  return [term, setTerm] as const
}

const activeFilterCount = (s: HomeSearch) =>
  (s.cat?.split(',').filter(Boolean).length ?? 0) + (s.net?.split(',').filter(Boolean).length ?? 0) + (s.min || s.max ? 1 : 0) + (s.q ? 1 : 0)

function MobileSearchBar({ onOpenFilters }: { onOpenFilters: (el: HTMLElement) => void }) {
  const { search } = useHomeSearch()
  const [term, setTerm] = useSearchTerm()
  const n = activeFilterCount(search)
  return (
    <div className="container-kurio flex gap-2 pt-10 md:hidden">
      <div className="relative min-w-0 flex-1" role="search">
        <label htmlFor="mobile-search" className="sr-only">
          Buscar NFTs
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="mobile-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-[10px] bg-surface pl-11 pr-3 text-sm text-text placeholder:font-bold placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand-strong"
        />
      </div>
      <button
        type="button"
        aria-label={`Filtros${n ? ` (${n})` : ''}`}
        onClick={(e) => onOpenFilters(e.currentTarget)}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-[#a8683b] text-bg"
      >
        <Settings2 className="size-5" aria-hidden="true" />
        {n > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-text text-[10px] font-bold text-bg" aria-hidden="true">{n}</span>}
      </button>
    </div>
  )
}

/** Hero compacto do Figma mobile: card arredondado com texto à esquerda e arte à direita. */
function MobileHero() {
  const { data } = useHighlights()
  const [slide, setSlide] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[slide]
  const image = current?.image ?? '/img/art/emerald-ape.webp'
  const thumb = slides[(slide + 1) % Math.max(slides.length, 1)]?.image ?? '/img/art/sage-nomad.webp'
  return (
    <section aria-labelledby="hero-title-mobile" className="container-kurio mt-4 md:hidden">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6a4529] via-[#523520] to-[#3a2516] px-4 pb-6 pt-2.5">
        <span className="pointer-events-none absolute -left-16 top-8 size-60 rounded-full bg-[#7a5232]/40" aria-hidden="true" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_138px] gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold">Bem-vindo à Kurio</p>
            <h1 id="hero-title-mobile" className="mt-1 text-lg font-bold uppercase leading-[29px]">
              Seja dono da cultura digital
            </h1>
            <p className="mt-1 text-xs leading-[18px] text-muted">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link to="/" hash="catalogo" className="inline-flex items-center gap-2 text-xs font-bold uppercase leading-4 text-brand-strong">
              Explorar <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <figure className="relative">
            {current ? (
              <Link to="/nft/$id" params={{ id: current.id }} aria-label={`Ver ${current.name}`}>
                <img src={image} alt={current.name} width={138} height={138} className="aspect-square w-full rounded-xl object-cover" {...fetchPriority(true)} />
              </Link>
            ) : (
              <img src={image} alt="Emerald Ape #042, NFT em destaque" width={138} height={138} className="aspect-square w-full rounded-xl object-cover" {...fetchPriority(true)} />
            )}
            <img src={thumb} alt="" width={58} height={58} className="absolute -bottom-2 left-3 size-[58px] rounded-[10px] object-cover ring-2 ring-[#523520]" />
          </figure>
        </div>
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2.5" role="group" aria-label="Destaques">
          {(slides.length ? slides : [0, 1, 2]).map((s, i) => (
            <button
              key={i}
              type="button"
              disabled={!slides.length}
              aria-label={typeof s === 'object' ? `Destaque ${i + 1}: ${s.name}` : `Destaque ${i + 1}`}
              aria-current={slide === i}
              onClick={() => setSlide(i)}
              className={cn('size-1.5 rounded-full bg-brand transition-opacity', slide === i ? 'opacity-100' : 'opacity-60')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Catálogo -------------------------------- */

function useHomeSearch() {
  const search = useSearch({ strict: false }) as HomeSearch
  const navigate = useNavigate()
  const update = (patch: Partial<HomeSearch>, opts: { replace?: boolean; keepPage?: boolean } = {}) =>
    navigate({
      to: '/',
      search: (prev: HomeSearch) => ({ ...prev, ...(opts.keepPage ? {} : { page: undefined }), ...patch }),
      replace: opts.replace,
      resetScroll: false,
    })
  return { search, update }
}

function toggleIn(list: string | undefined, value: string) {
  const set = new Set(list?.split(',').filter(Boolean))
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].join(',') : undefined
}

function Catalog({
  filtersOpen,
  onFiltersOpenChange,
  onOpenFilters,
  filtersTrigger,
}: {
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
  onOpenFilters: (el: HTMLElement) => void
  filtersTrigger: MutableRefObject<HTMLElement | null>
}) {
  const { search, update } = useHomeSearch()
  const query = useMemo(() => toCatalogQuery(search), [search])
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useCatalog(query)
  const [term, setTerm] = useSearchTerm()

  const activeChips = [
    ...(query.categories ?? []).map((c) => ({ label: c, clear: () => update({ cat: toggleIn(search.cat, c) }) })),
    ...(query.networks ?? []).map((n) => ({ label: n, clear: () => update({ net: toggleIn(search.net, n) }) })),
    ...(search.min || search.max ? [{ label: `${formatEthBr(search.min ?? '0')} – ${search.max ? formatEthBr(search.max) : '∞'} ETH`, clear: () => update({ min: undefined, max: undefined }) }] : []),
    ...(search.q ? [{ label: `“${search.q}”`, clear: () => update({ q: undefined }) }] : []),
  ]

  return (
    <section id="catalogo" aria-labelledby="catalogo-title" className="container-kurio mt-4 scroll-mt-4 md:mt-24">
      <h2 id="catalogo-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-12">
        <div className="hidden lg:block">
          <Filters data={data} />
          <Featured />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div role="tablist" aria-label="Seções do catálogo" className="flex flex-wrap gap-5 max-md:flex-nowrap max-md:gap-2.5">
              {TABS.map((t) => {
                const active = (search.tab ?? 'all') === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-controls="catalogo-grid"
                    onClick={() => update({ tab: t.id === 'all' ? undefined : t.id })}
                    className={cn('whitespace-nowrap border-b-2 pb-0.5 text-[15px] font-bold max-md:text-sm', active ? 'border-brand text-brand-strong' : 'border-transparent hover:text-brand-strong max-md:font-normal')}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <label className="ml-auto flex items-center gap-1 text-[15px] max-md:hidden">
              <span>Ordenar por:</span>
              <select
                value={search.sort ?? 'recent'}
                onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSort) })}
                className="bg-bg py-1 text-[15px] focus-visible:outline-2"
              >
                {Object.entries(SORT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 max-md:hidden">
            <div className="relative min-w-0 flex-1 sm:max-w-sm" role="search">
              <label htmlFor="catalog-search" className="sr-only">
                Buscar NFTs
              </label>
              <input
                id="catalog-search"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar por nome, criador ou coleção…"
                className="field-input"
              />
            </div>
            <Button variant="outline" size="sm" className="h-10 lg:hidden" onClick={(e) => onOpenFilters(e.currentTarget)}>
              <SlidersHorizontal aria-hidden="true" />
              Filtros{activeChips.length ? ` (${activeChips.length})` : ''}
            </Button>
            <Sheet open={filtersOpen} onOpenChange={onFiltersOpenChange}>
              <SheetContent
                side="left"
                onCloseAutoFocus={(e) => {
                  e.preventDefault()
                  filtersTrigger.current?.focus()
                }}
              >
                <SheetTitle className="text-lg font-bold">Filtros</SheetTitle>
                <SheetDescription className="text-sm text-muted">Combine coleções, faixa de preço e rede.</SheetDescription>
                {/* No Figma mobile a ordenação não fica na tela: vem para o painel de filtros. */}
                <label className="flex items-center gap-2 text-[15px] md:hidden">
                  <span>Ordenar por:</span>
                  <select
                    value={search.sort ?? 'recent'}
                    onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSort) })}
                    className="field-input h-10 flex-1 py-1"
                  >
                    {Object.entries(SORT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <Filters data={data} embedded />
              </SheetContent>
            </Sheet>
          </div>

          {activeChips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Filtros ativos">
              {activeChips.map((c) => (
                <li key={c.label}>
                  <button type="button" onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs hover:border-brand" aria-label={`Remover filtro ${c.label}`}>
                    {c.label} <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="px-2 py-1 text-xs text-brand-strong underline" onClick={() => update({ q: undefined, cat: undefined, net: undefined, min: undefined, max: undefined })}>
                  Limpar tudo
                </button>
              </li>
            </ul>
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {data && !isPlaceholderData ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : ''}
          </p>

          <div id="catalogo-grid" role="tabpanel" aria-busy={isFetching} className="relative mt-6">
            {isFetching && !isPending && (
              <div className="absolute -top-4 left-0 right-0 h-0.5 overflow-hidden" aria-hidden="true">
                <div className="skeleton h-full w-full" />
              </div>
            )}
            {isError && !data ? (
              <ErrorState message={error.message} onRetry={() => void refetch()} retrying={isFetching} />
            ) : isPending ? (
              <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 xl:grid-cols-3', MOBILE_GRID)} aria-label="Carregando NFTs" data-testid="catalog-skeleton">
                {Array.from({ length: 9 }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : data.items.length === 0 ? (
              <div className="border border-line p-8 text-center" data-testid="catalog-empty">
                <p className="font-bold">Nenhum NFT encontrado.</p>
                <p className="mt-2 text-sm text-muted">Tente outro termo ou remova alguns filtros.</p>
              </div>
            ) : (
              <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity sm:gap-x-8 xl:grid-cols-3', MOBILE_GRID, isPlaceholderData && 'opacity-60')} data-testid="catalog-grid">
                {data.items.map((n, i) => (
                  <li key={n.id}>
                    <NftCard nft={n} priority={i < 3} />
                  </li>
                ))}
              </ul>
            )}
            {isError && data && <ErrorState title="Falha ao atualizar o catálogo." message={error.message} onRetry={() => void refetch()} retrying={isFetching} />}
          </div>

          {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ page: p > 1 ? p : undefined }, { keepPage: true })} />}
        </div>
      </div>
      <div className="mt-12 lg:hidden">
        <Featured />
      </div>
    </section>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const go = (p: number) => {
    onPage(p)
    document.getElementById('catalogo')?.scrollIntoView({ block: 'start' })
  }
  const btn = 'flex size-9 items-center justify-center rounded-[3px] border border-line text-lg disabled:opacity-40'
  return (
    <nav aria-label="Paginação do catálogo" className="mt-14 flex justify-end">
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={btn} onClick={() => go(page - 1)} aria-label="Página anterior">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
          </li>
        )}
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <li key={p}>
            <button type="button" className={cn(btn, p === page && 'border-brand bg-brand font-bold text-primary-foreground')} aria-current={p === page ? 'page' : undefined} aria-label={`Página ${p}`} onClick={() => go(p)}>
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={btn} onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

function Filters({ data, embedded }: { data?: CatalogPage; embedded?: boolean }) {
  const { search, update } = useHomeSearch()
  const range = data?.facets.priceRange
  const lo = range ? toCents(range.min) : 0
  const hi = range ? toCents(range.max) : 100
  const [value, setValue] = useState<[number, number] | null>(null)
  const current: [number, number] = value ?? [search.min ? toCents(search.min) : lo, search.max ? toCents(search.max) : hi]
  const cats = new Set(search.cat?.split(','))
  const nets = new Set(search.net?.split(','))

  const item = (active: boolean) => cn('flex w-full items-center justify-between rounded-[3px] px-3 py-2 text-[15px] hover:bg-surface-2', active ? 'text-brand-strong font-bold' : 'text-muted')

  return (
    <aside aria-label="Filtros do catálogo" className={cn('space-y-6', !embedded && 'bg-surface px-5 py-5')}>
      <fieldset>
        <legend className="mb-2 text-lg font-bold">Coleções</legend>
        <ul>
          {CATEGORIES.map((c: Category) => (
            <li key={c}>
              <button type="button" className={item(cats.has(c))} aria-pressed={cats.has(c)} onClick={() => update({ cat: toggleIn(search.cat, c) })}>
                <span>{c}</span>
                <span className="tabular-nums" aria-label={`${data?.facets.categories[c] ?? 0} itens`}>
                  ({data ? data.facets.categories[c] ?? 0 : '–'})
                </span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-lg font-bold">Faixa de preço</legend>
        <div className="px-3">
          <Slider
            min={lo}
            max={hi}
            step={1}
            minStepsBetweenThumbs={1}
            value={current}
            onValueChange={(v) => setValue([v[0], v[1]])}
            thumbLabels={['Preço mínimo', 'Preço máximo']}
            disabled={!range}
          />
          <p className="mt-3 text-sm" aria-live="polite">
            Preço: {formatEthBr(fromCents(current[0]))} - {formatEthBr(fromCents(current[1]))} ETH
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={!range}
              onClick={() => {
                update({ min: current[0] > lo ? fromCents(current[0]) : undefined, max: current[1] < hi ? fromCents(current[1]) : undefined })
                setValue(null)
              }}
            >
              Aplicar
            </Button>
            {(search.min || search.max) && (
              <Button size="sm" variant="ghost" onClick={() => (setValue(null), update({ min: undefined, max: undefined }))}>
                Limpar
              </Button>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-lg font-bold">Rede</legend>
        <ul>
          {NETWORKS.map((n: Network) => (
            <li key={n}>
              <button type="button" className={item(nets.has(n))} aria-pressed={nets.has(n)} onClick={() => update({ net: toggleIn(search.net, n) })}>
                <span>{n}</span>
                <span className="tabular-nums">({data ? data.facets.networks[n] ?? 0 : '–'})</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </aside>
  )
}

function Featured() {
  const { data, isPending } = useHighlights()
  return (
    <section aria-labelledby="featured-title" className="mt-6 bg-gradient-to-b from-surface-2/60 to-surface pt-6">
      <h2 id="featured-title" className="px-5 text-2xl font-bold text-brand-strong">
        NFT EM DESTAQUE
      </h2>
      <p className="mt-2 text-center text-xl font-bold">OFERTA LIMITADA</p>
      {isPending || !data ? (
        <Skeleton className="mt-3 aspect-[310/400] w-full rounded-none" />
      ) : (
        <Link to="/nft/$id" params={{ id: data.featured.id }} className="mt-3 block" aria-label={`${data.featured.name}, ${data.featured.price} ETH`}>
          <img src={data.featured.image} alt={data.featured.name} width={310} height={400} loading="lazy" className="aspect-[310/400] w-full object-cover" />
        </Link>
      )}
    </section>
  )
}

/* ------------------------------ Promoções/diário ---------------------------- */

function Promos() {
  const cards = [
    { title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', img: '/img/art/emerald-ape.webp', alt: 'Emerald Ape', tab: 'new' as const },
    { title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', img: '/img/art/neon-vessel.webp', alt: 'Neon Vessel', tab: 'trending' as const },
  ]
  return (
    <section aria-label="Coleções em destaque" className="container-kurio mt-24 grid gap-7 md:grid-cols-2">
      {cards.map((c) => (
        <article key={c.title} className="grid grid-cols-[minmax(0,287px)_1fr] items-center bg-surface">
          <img src={c.img} alt={c.alt} width={287} height={250} loading="lazy" className="aspect-[287/250] h-full w-full object-cover" />
          <div className="flex flex-col items-end gap-3 p-4 text-right sm:p-6">
            <h3 className="text-base font-bold leading-6 sm:text-lg">{c.title}</h3>
            <p className="text-xs leading-6 text-muted sm:text-sm">{c.text}</p>
            <Button asChild className="w-[140px]">
              <Link to="/" search={{ tab: c.tab }} hash="catalogo">
                Explorar <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', img: '/img/art/neon-vessel.webp' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', img: '/img/art/emerald-ape.webp' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', img: '/img/art/sage-nomad.webp' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', img: '/img/art/golden-beat.webp' },
]

function Journal() {
  const [open, setOpen] = useState<(typeof POSTS)[number] | null>(null)
  return (
    <section id="aprenda" aria-labelledby="journal-title" className="container-kurio mt-24 scroll-mt-4">
      <h2 id="journal-title" className="text-center text-2xl font-bold sm:text-3xl">
        Diário da Cunhagem
      </h2>
      <p className="mt-4 text-center text-sm text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-[10px] bg-surface">
              <img src={p.img} alt="" width={268} height={200} loading="lazy" className="aspect-[268/200] w-full object-cover" />
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-muted">
                  {p.date} <span aria-hidden="true">|</span> Leitura de {p.read} min
                </p>
                <h3 className="mt-3 font-bold leading-snug">{p.title}</h3>
                <p className="mt-3 text-xs leading-relaxed text-muted">{p.text}</p>
                <button type="button" className="mt-2 self-start text-xs font-bold text-brand-strong hover:underline" onClick={() => setOpen(p)} aria-label={`Ler mais: ${p.title}`}>
                  Ler mais →
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogTitle className="pr-8">{open?.title}</DialogTitle>
          <DialogDescription className="mt-3">{open?.text}</DialogDescription>
          <p className="mt-4 text-sm leading-relaxed">
            Conteúdo editorial de demonstração do Diário da Cunhagem. O artigo completo será publicado junto com o lançamento da coleção.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  )
}

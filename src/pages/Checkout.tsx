import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, Unplug } from 'lucide-react'
import type { CollectorInfo, CreateOrderBody, Network, Order, Quote, WalletConnection, WalletProvider } from '@/api/contracts'
import { NETWORKS, WALLET_PROVIDERS } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError, type ApiError } from '@/api/http'
import { qk } from '@/api/queryKeys'
import { useCart } from '@/hooks/useCart'
import { useSession } from '@/lib/session'
import { onNftUpdated, onReconnected } from '@/lib/realtime'
import { announce } from '@/lib/announcer'
import { attemptFor, contentHash, markAttemptOrder, pendingOrder } from '@/lib/idempotency'
import { Breadcrumb } from '@/components/Breadcrumb'
import { CouponForm, Totals } from '@/components/Summary'
import { Field, FormError } from '@/components/Field'
import { WalletStrip } from '@/components/layout/Footer'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, shortAddress } from '@/lib/utils'

const EVM_RE = /^0x[0-9a-fA-F]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type FormState = CollectorInfo & { network: Network | ''; address: string; secondary: string; provider: WalletProvider | '' }

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
  if (!/^[a-z0-9._]{3,30}$/i.test(f.username.trim())) e.username = 'Use de 3 a 30 letras, números, ponto ou sublinhado.'
  if (!f.network) e.network = 'Selecione uma rede.'
  if (f.profileName.trim().length < 2) e.profileName = 'Informe o nome do perfil.'
  if (!f.address.trim()) e.address = 'Informe o endereço da carteira.'
  else if (f.network && !(f.network === 'Solana' ? SOL_RE : EVM_RE).test(f.address.trim()))
    e.address = f.network === 'Solana' ? 'Endereço Solana inválido.' : 'Use 0x seguido de 40 caracteres hexadecimais.'
  if (!f.provider) e.provider = 'Selecione o tipo de carteira.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Informe um e-mail válido.'
  if (f.ensName && !/^[a-z0-9-]{3,32}$/i.test(f.ensName)) e.ensName = 'Use de 3 a 32 letras, números ou hífen.'
  return e
}

export function CheckoutPage() {
  const { user, scope } = useSession()
  const cart = useCart()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const wallets = useQuery({ queryKey: qk.wallets(scope), queryFn: ({ signal }) => api.wallets({ signal }) })
  const primary = wallets.data?.find((w) => w.role === 'primary')

  const [form, setForm] = useState<FormState>(() => ({
    displayName: user?.displayName ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    profileName: user?.displayName ?? '',
    referralCode: '',
    ensName: user?.ensName ?? '',
    note: '',
    network: '',
    address: '',
    secondary: '',
    provider: '',
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [useOther, setUseOther] = useState(false)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [reviewed, setReviewed] = useState<string | null>(null)
  const [staleReason, setStaleReason] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Pré-preenche com a carteira principal (uma vez).
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !wallets.data) return
    prefilled.current = true
    if (primary) setForm((f) => ({ ...f, network: primary.network, address: primary.address, provider: primary.provider, secondary: primary.ensName ?? '' }))
    else setForm((f) => ({ ...f, network: 'Ethereum' }))
  }, [wallets.data, primary])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
    // Trocar rede/carteira/endereço invalida a conexão atual.
    if ((k === 'network' || k === 'provider' || k === 'address') && connection) void disconnect.mutateAsync()
  }

  /* -------------------------------- Cotação -------------------------------- */
  const items = useMemo(() => cart.data?.items.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })) ?? [], [cart.data])
  const network = (form.network || 'Ethereum') as Network
  const coupon = cart.data?.coupon?.code ?? null
  const itemsHash = contentHash(items)
  const quoteKey = useMemo(() => ['private', scope, 'quote', network, coupon, itemsHash] as const, [scope, network, coupon, itemsHash])
  const quote = useQuery({
    queryKey: quoteKey,
    queryFn: () => api.quote({ items, coupon, network }),
    enabled: items.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Primeira cotação de cada combinação é a "revisada"; mudanças posteriores exigem nova confirmação.
  const lastKey = useRef<string>('')
  useEffect(() => {
    const k = JSON.stringify(quoteKey)
    if (quote.data && lastKey.current !== k) {
      lastKey.current = k
      setReviewed(quote.data.fingerprint)
      setStaleReason(null)
    }
  }, [quote.data, quoteKey])

  // Tempo real: se um item da cotação mudou, a cotação fica desatualizada.
  useEffect(() => {
    const offNft = onNftUpdated((e) => {
      const q = qc.getQueryData<Quote>(quoteKey)
      // Só fica desatualizada se o evento diverge da cotação em cache (preço ou
      // estoque da edição). Se o servidor já devolveu a cotação nova — p.ex. junto
      // com o erro QUOTE_CHANGED — basta aceitar a nova cotação.
      const diverges = q?.lines.some((l) => {
        if (l.nftId !== e.resource.id) return false
        const ed = e.data.editions.find((x) => x.id === l.editionId)
        return !ed || ed.price !== l.unitPrice || ed.available !== l.available
      })
      if (diverges) {
        setStaleReason('O preço ou a disponibilidade de um item mudou enquanto você revisava.')
        announce('Atenção: os valores do seu pedido mudaram. Revise a nova cotação antes de confirmar.', 'assertive')
      }
    })
    const offRe = onReconnected(() => setStaleReason((r) => r ?? 'A conexão em tempo real caiu. Atualize a cotação para garantir os valores.'))
    return () => {
      offNft()
      offRe()
    }
  }, [qc, quoteKey])

  const needsReconfirm = !!quote.data && reviewed !== null && quote.data.fingerprint !== reviewed

  const refreshQuote = async () => {
    setOrderError(null)
    const r = await quote.refetch()
    setStaleReason(null)
    if (r.data && r.data.fingerprint !== reviewed) announce('Nova cotação carregada. Revise os valores e confirme.', 'assertive')
  }

  /* --------------------------- Conexão da carteira -------------------------- */
  const connect = useMutation({
    mutationFn: () => api.connectWallet({ provider: form.provider as WalletProvider, network, address: form.address.trim() || undefined }),
    onSuccess: (c) => {
      setConnection(c)
      announce(`${c.provider} conectada na rede ${c.network}.`)
    },
    onError: (e) => announce(isApiError(e) ? e.message : 'Falha ao conectar a carteira.', 'assertive'),
  })
  const disconnect = useMutation({
    mutationFn: async () => {
      if (connection) await api.disconnectWallet(connection.id)
    },
    onSettled: () => {
      setConnection(null)
      announce('Carteira desconectada.')
    },
  })

  /* --------------------------------- Pedido -------------------------------- */
  const createOrder = useMutation<Order, ApiError, { body: CreateOrderBody; key: string }>({
    mutationFn: ({ body, key }) => api.createOrder(body, key),
    // Seguro repetir: a chave de idempotência garante o mesmo pedido.
    retry: (count, e) => e.isTransient && count < 2,
    retryDelay: 500,
    onSuccess: (order) => {
      markAttemptOrder(user!.id, order.id)
      pendingOrder.set(user!.id, order.id)
      qc.setQueryData(qk.order(scope, order.id), order)
      void navigate({ to: '/pedido/$id', params: { id: order.id } })
    },
    onError: (e) => {
      const q = (e.details as { quote?: Quote } | undefined)?.quote
      if (q) {
        // A cotação devolvida junto com o erro é a mais recente do servidor (o
        // evento nft.updated correspondente costuma chegar antes desta resposta).
        qc.setQueryData(quoteKey, q)
        setStaleReason(null)
      }
      if (e.code === 'QUOTE_CHANGED') setOrderError('Os valores mudaram desde a sua revisão. Confira a nova cotação e confirme novamente.')
      else if (e.code === 'OUT_OF_STOCK') setOrderError('Alguns itens não estão mais disponíveis. Ajuste o carrinho para continuar.')
      else if (e.code === 'QUOTE_EXPIRED') {
        setOrderError('A cotação expirou. Atualizamos os valores para você revisar.')
        void quote.refetch()
      } else if (e.isTransient)
        setOrderError('Não recebemos a confirmação do servidor. Seu carrinho foi mantido. Tente novamente: a mesma solicitação será reaproveitada, sem cobrança duplicada.')
      else setOrderError(e.message)
      announce(e.message, 'assertive')
      requestAnimationFrame(() => errorRef.current?.focus())
    },
  })

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setOrderError(null)
    const e = validate(form)
    setErrors(e)
    if (Object.keys(e).length) {
      announce('Revise os campos destacados no formulário.', 'assertive')
      const first = Object.keys(e)[0]
      document.getElementById(`co-${first}`)?.focus()
      return
    }
    if (!connection) return setOrderError('Conecte sua carteira antes de confirmar a compra.')
    if (!quote.data) return
    if (staleReason || needsReconfirm) return setOrderError('Revise e aceite a nova cotação antes de confirmar.')
    const body: CreateOrderBody = {
      quoteId: quote.data.id,
      fingerprint: quote.data.fingerprint,
      items,
      coupon,
      network,
      connectionId: connection.id,
      collector: {
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        profileName: form.profileName.trim(),
        referralCode: form.referralCode?.trim() || undefined,
        ensName: form.ensName?.trim() || undefined,
        note: form.note?.trim() || undefined,
      },
    }
    const attempt = attemptFor(user!.id, contentHash(body))
    createOrder.mutate({ body, key: attempt.key })
  }

  const existingPending = user ? pendingOrder.get(user.id) : null

  if (cart.isPending) return <CheckoutSkeleton />
  if (cart.isError)
    return (
      <div className="container-kurio pt-8">
        <ErrorState message={cart.error.message} onRetry={() => void cart.refetch()} />
      </div>
    )
  if (!cart.data.items.length)
    return (
      <div className="container-kurio pt-8">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Pagamento' }]} />
        <div className="mt-10 border border-line p-10 text-center">
          <h1 className="text-lg font-bold">Seu carrinho está vazio.</h1>
          {existingPending && (
            <p className="mt-3 text-sm">
              Você tem um pedido em andamento.{' '}
              <Link to="/pedido/$id" params={{ id: existingPending }} className="text-brand-strong underline">
                Acompanhar pedido
              </Link>
            </p>
          )}
          <Button asChild className="mt-6">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      </div>
    )

  const q = quote.data
  const canConfirm = !!q && q.purchasable && !!connection && !staleReason && !needsReconfirm && !createOrder.isPending && !quote.isFetching

  return (
    <div className="container-kurio pt-8">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Pagamento' }]} />
      <h1 className="sr-only">Pagamento</h1>
      {existingPending && (
        <p className="mt-4 border border-brand/50 bg-brand/10 p-3 text-sm" role="status">
          Você tem um pedido em andamento.{' '}
          <Link to="/pedido/$id" params={{ id: existingPending }} className="font-bold text-brand-strong underline">
            Acompanhar pedido
          </Link>
        </p>
      )}
      <form onSubmit={submit} noValidate className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_405px] lg:gap-8">
        <section aria-labelledby="collector-title">
          <h2 id="collector-title" className="text-lg font-bold">
            Perfil do colecionador
          </h2>
          <div className="mt-3 grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <Field id="co-displayName" label="Nome de exibição" required error={errors.displayName}>
              <Input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} autoComplete="name" />
            </Field>
            <Field id="co-username" label="Nome de usuário" required error={errors.username}>
              <Input value={form.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" />
            </Field>
            <Field id="co-network" label="Rede" required error={errors.network}>
              <Select value={form.network} onChange={(e) => set('network', e.target.value as Network)}>
                <option value="">Selecione uma rede</option>
                {NETWORKS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field id="co-profileName" label="Nome do perfil" required error={errors.profileName}>
              <Input value={form.profileName} onChange={(e) => set('profileName', e.target.value)} />
            </Field>
            <Field id="co-address" label="Endereço da carteira" required error={errors.address}>
              {useOther || !wallets.data?.length ? (
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={form.network === 'Solana' ? 'Endereço Solana (base58)' : 'Endereço 0x da carteira'} spellCheck={false} />
              ) : (
                <Select
                  value={form.address}
                  onChange={(e) => {
                    const w = wallets.data!.find((x) => x.address === e.target.value)
                    if (w) setForm((f) => ({ ...f, address: w.address, network: w.network, provider: w.provider }))
                    if (connection) void disconnect.mutateAsync()
                  }}
                >
                  {wallets.data.map((w) => (
                    <option key={w.id} value={w.address}>
                      {w.label} ({w.role === 'primary' ? 'principal' : 'secundária'}) · {shortAddress(w.address)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="co-secondary" label={<span className="sr-only">ENS ou carteira secundária (opcional)</span>} className="sm:self-end">
              <Input value={form.secondary} onChange={(e) => set('secondary', e.target.value)} placeholder="ENS ou carteira secundária (opcional)" />
            </Field>
            <Field id="co-provider" label="Tipo de carteira" required error={errors.provider}>
              <Select value={form.provider} onChange={(e) => set('provider', e.target.value as WalletProvider)}>
                <option value="">Selecione uma carteira</option>
                {WALLET_PROVIDERS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field id="co-referral" label="Código de indicação (opcional)">
              <Input value={form.referralCode} onChange={(e) => set('referralCode', e.target.value)} />
            </Field>
            <Field id="co-email" label="E-mail" required error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
            </Field>
            <div>
              <label htmlFor="co-ensName" className="mb-1.5 block text-sm">
                Nome ENS
              </label>
              <div className="flex gap-2">
                <span className="field-input w-auto shrink-0 text-muted" aria-hidden="true">
                  .eth
                </span>
                <Input id="co-ensName" value={form.ensName} onChange={(e) => set('ensName', e.target.value)} aria-describedby={errors.ensName ? 'co-ensName-error' : undefined} aria-invalid={!!errors.ensName || undefined} />
              </div>
              {errors.ensName && (
                <p id="co-ensName-error" className="mt-1 text-xs text-danger">
                  ⚠ {errors.ensName}
                </p>
              )}
            </div>
          </div>
          {!!wallets.data?.length && (
            <label className="mt-6 flex w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-brand)]"
                checked={useOther}
                onChange={(e) => {
                  setUseOther(e.target.checked)
                  if (!e.target.checked && primary) setForm((f) => ({ ...f, address: primary.address, network: primary.network, provider: primary.provider }))
                }}
              />
              Usar outra carteira?
            </label>
          )}
          <Field id="co-note" label="Observação do colecionador (opcional)" className="mt-5 max-w-sm">
            <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} />
          </Field>
        </section>

        <aside aria-labelledby="order-title" className="h-fit">
          <h2 id="order-title" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <div className="mt-2 flex justify-between border-b border-line pb-2 text-[15px] font-bold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>

          {quote.isPending ? (
            <div className="mt-3 space-y-2" aria-busy="true" data-testid="quote-skeleton">
              {Array.from({ length: Math.min(items.length, 3) }, (_, i) => (
                <Skeleton key={i} className="h-[62px] w-full" />
              ))}
              <Skeleton className="h-40 w-full" />
            </div>
          ) : quote.isError ? (
            <div className="mt-3">
              <ErrorState title="Não foi possível calcular a cotação." message={quote.error.message} onRetry={() => void quote.refetch()} retrying={quote.isFetching} />
            </div>
          ) : q ? (
            <>
              <ul className="mt-2 space-y-2" aria-busy={quote.isFetching}>
                {q.lines.map((l) => (
                  <li key={`${l.nftId}-${l.editionId}`} className="flex items-center gap-2 bg-surface p-1 pr-2" data-testid="quote-line">
                    <img src={l.image} alt="" width={52} height={52} className="size-[52px] shrink-0 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{l.name}</p>
                      <p className="text-xs text-muted">ID do token: {l.tokenId} · {l.editionLabel}</p>
                      {l.status !== 'ok' && (
                        <p className="text-xs text-danger">
                          <AlertTriangle className="mr-1 inline size-3" aria-hidden="true" />
                          {l.status === 'sold_out' ? 'Esgotado' : `Apenas ${l.available} disponível(is)`}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-muted">(x {l.quantity})</span>
                    <span className="w-24 text-right text-lg font-bold text-brand-strong">{l.lineTotal} ETH</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <CouponForm applied={cart.data.coupon} compact />
              </div>
              <div className="mt-3">
                <Totals subtotal={q.subtotal} discount={q.discount} networkFee={q.networkFee} total={q.total} couponLabel={q.coupon?.code} busy={quote.isFetching} feeNote={`Taxa estimada (${q.network})`} />
              </div>

              {(staleReason || needsReconfirm) && (
                <div role="alert" className="mt-4 space-y-3 border border-brand bg-brand/10 p-3 text-sm" data-testid="quote-stale">
                  <p className="flex gap-2 font-bold">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    {staleReason ? 'Cotação desatualizada' : 'Os valores mudaram'}
                  </p>
                  <p>{staleReason ?? 'Confira o novo total acima. É preciso confirmar a nova cotação antes de concluir a compra.'}</p>
                  {staleReason ? (
                    <Button type="button" size="sm" onClick={() => void refreshQuote()} disabled={quote.isFetching}>
                      {quote.isFetching ? 'Atualizando…' : 'Atualizar cotação'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setReviewed(q.fingerprint)
                        setOrderError(null)
                        announce(`Nova cotação aceita. Total ${q.total} ETH.`)
                      }}
                    >
                      Aceitar nova cotação ({q.total} ETH)
                    </Button>
                  )}
                </div>
              )}
              {q.issues.length > 0 && (
                <ul role="alert" className="mt-3 list-disc space-y-1 pl-5 text-sm text-danger">
                  {q.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                  <li className="list-none pl-0">
                    <Link to="/cart" className="underline">
                      Ajustar carrinho
                    </Link>
                  </li>
                </ul>
              )}
            </>
          ) : null}

          <fieldset className="mt-5">
            <legend className="w-full text-center text-lg font-bold">Carteira e rede</legend>
            <WalletStrip className="mt-3" />
            <div className="mt-3 space-y-3" role="radiogroup" aria-label="Tipo de carteira">
              {WALLET_PROVIDERS.map((p) => (
                <label key={p} className={cn('flex h-[46px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 text-[15px]', form.provider === p ? 'border-brand' : 'border-line')}>
                  <input type="radio" name="provider" value={p} checked={form.provider === p} onChange={() => set('provider', p)} className="size-4 accent-[var(--color-brand)]" />
                  {p}
                </label>
              ))}
            </div>
            <div className="mt-3" aria-live="polite">
              {connection ? (
                <div className="flex items-center justify-between gap-2 border border-success/60 bg-success/10 p-3 text-sm" data-testid="wallet-connected">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    {connection.provider} conectada · {shortAddress(connection.address)} ({connection.network})
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    <Unplug aria-hidden="true" /> Desconectar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!form.provider || connect.isPending}
                  onClick={() => {
                    const e = validate(form)
                    if (e.address || e.network || e.provider) {
                      setErrors((x) => ({ ...x, address: e.address, network: e.network, provider: e.provider }))
                      return
                    }
                    connect.mutate()
                  }}
                >
                  {connect.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PlugZap aria-hidden="true" />}
                  {connect.isPending ? 'Aguardando aprovação na carteira…' : form.provider ? `Conectar ${form.provider}` : 'Selecione uma carteira'}
                </Button>
              )}
              {connect.isError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {connect.error.message} Você pode tentar novamente ou escolher outra carteira.
                </p>
              )}
            </div>
          </fieldset>

          <div ref={errorRef} tabIndex={-1} className="mt-4 focus:outline-none">
            <FormError message={orderError} />
          </div>
          <Button type="submit" className="mt-4 h-[46px] w-full text-[15px]" disabled={!canConfirm} aria-disabled={!canConfirm} data-testid="confirm-purchase">
            {createOrder.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Processando pagamento…
              </>
            ) : (
              'Confirmar compra'
            )}
          </Button>
          {!connection && <p className="mt-2 text-center text-xs text-muted">Conecte a carteira para habilitar a confirmação.</p>}
        </aside>
      </form>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-kurio grid gap-10 pt-16 lg:grid-cols-[1fr_405px]" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-[520px] w-full" />
    </div>
  )
}

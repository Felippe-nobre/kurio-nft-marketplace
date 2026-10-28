import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Trash2 } from 'lucide-react'
import type { Network, Wallet, WalletBody, WalletProvider } from '@/api/contracts'
import { NETWORKS, WALLET_PROVIDERS } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { announce } from '@/lib/announcer'
import { AccountLayout } from '@/components/AccountLayout'
import { Field, FormError } from '@/components/Field'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const EVM_RE = /^0x[0-9a-fA-F]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function WalletsPage() {
  const { scope } = useSession()
  const qc = useQueryClient()
  const wallets = useQuery({ queryKey: qk.wallets(scope), queryFn: ({ signal }) => api.wallets({ signal }), staleTime: 0 })
  const [adding, setAdding] = useState<null | 'primary' | 'secondary'>(null)

  useEffect(() => {
    document.title = 'Carteiras — Kurio'
  }, [])

  const setList = (list: Wallet[]) => qc.setQueryData(qk.wallets(scope), list)
  const makePrimary = useMutation({
    mutationFn: (w: Wallet) => api.updateWallet(w.id, { role: 'primary' }),
    onSuccess: (list, w) => {
      setList(list)
      announce(`${w.label} agora é a carteira principal.`)
    },
    onError: (e) => announce(isApiError(e) ? e.message : 'Não foi possível alterar a carteira principal.', 'assertive'),
  })
  const remove = useMutation({
    mutationFn: (w: Wallet) => api.removeWallet(w.id),
    onSuccess: (list, w) => {
      setList(list)
      announce(`Carteira ${w.label} removida.`)
    },
    onError: (e) => announce(isApiError(e) ? e.message : 'Não foi possível remover a carteira.', 'assertive'),
  })
  const mutationError = makePrimary.error ?? remove.error

  const primary = wallets.data?.find((w) => w.role === 'primary')
  const secondary = wallets.data?.filter((w) => w.role === 'secondary') ?? []

  return (
    <AccountLayout
      title="Carteira principal"
      actions={
        <Button variant="link" className="h-auto text-lg font-normal" onClick={() => setAdding('primary')} aria-expanded={adding === 'primary'}>
          Adicionar
        </Button>
      }
    >
      <p className="mt-1 text-sm text-muted">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
      {wallets.isPending ? (
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Carregando carteiras">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : wallets.isError ? (
        <div className="mt-6">
          <ErrorState message={wallets.error.message} onRetry={() => void wallets.refetch()} retrying={wallets.isFetching} />
        </div>
      ) : (
        <>
          {mutationError && (
            <div className="mt-4">
              <FormError message={isApiError(mutationError) ? mutationError.message : 'Falha na operação.'} />
            </div>
          )}
          {primary ? (
            <WalletCard wallet={primary} onRemove={() => remove.mutate(primary)} busy={remove.isPending} />
          ) : (
            <p className="mt-6 text-sm">Você ainda não cadastrou uma carteira principal.</p>
          )}
          {adding === 'primary' && <WalletForm role="primary" onDone={() => setAdding(null)} />}

          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Carteira secundária</h2>
            <Button variant="link" className="h-auto text-lg font-normal" onClick={() => setAdding('secondary')} aria-expanded={adding === 'secondary'}>
              Adicionar
            </Button>
          </div>
          {secondary.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Você ainda não adicionou uma carteira secundária.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {secondary.map((w) => (
                <li key={w.id}>
                  <WalletCard wallet={w} onPrimary={() => makePrimary.mutate(w)} onRemove={() => remove.mutate(w)} busy={makePrimary.isPending || remove.isPending} />
                </li>
              ))}
            </ul>
          )}
          {adding === 'secondary' && <WalletForm role="secondary" onDone={() => setAdding(null)} />}
        </>
      )}
    </AccountLayout>
  )
}

function WalletCard({ wallet, onPrimary, onRemove, busy }: { wallet: Wallet; onPrimary?: () => void; onRemove: () => void; busy: boolean }) {
  return (
    <article className="mt-4 flex flex-wrap items-center gap-4 bg-surface p-4" aria-label={`Carteira ${wallet.label}`} data-testid="wallet-card">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {wallet.label}
          <Badge variant={wallet.role === 'primary' ? 'warning' : 'outline'}>{wallet.role === 'primary' ? 'Principal' : 'Secundária'}</Badge>
        </p>
        <p className="mt-1 break-all font-mono text-sm text-muted">{wallet.address}</p>
        <p className="mt-1 text-xs text-muted">
          {wallet.provider} · {wallet.network}
          {wallet.ensName ? ` · ${wallet.ensName}` : ''}
        </p>
      </div>
      <div className="flex gap-2">
        {onPrimary && (
          <Button size="sm" variant="outline" onClick={onPrimary} disabled={busy}>
            <Star aria-hidden="true" /> Tornar principal
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy} aria-label={`Remover carteira ${wallet.label}`}>
          <Trash2 aria-hidden="true" /> Remover
        </Button>
      </div>
    </article>
  )
}

function WalletForm({ role, onDone }: { role: 'primary' | 'secondary'; onDone: () => void }) {
  const { scope } = useSession()
  const qc = useQueryClient()
  const [v, setV] = useState<{ label: string; provider: WalletProvider | ''; network: Network | ''; address: string; ensName: string }>({ label: '', provider: '', network: '', address: '', ensName: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({})
  const add = useMutation({
    mutationFn: (b: WalletBody) => api.addWallet(b),
    onSuccess: (w) => {
      void qc.invalidateQueries({ queryKey: qk.wallets(scope) })
      announce(`Carteira ${w.label} salva.`)
      onDone()
    },
    onError: (e) => {
      if (isApiError(e) && e.fields) setErrors(e.fields)
    },
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (v.label.trim().length < 2) next.label = 'Informe um apelido com ao menos 2 caracteres.'
    if (!v.network) next.network = 'Selecione uma rede.'
    if (!v.provider) next.provider = 'Selecione o tipo de carteira.'
    if (!v.address.trim()) next.address = 'Informe o endereço.'
    else if (v.network && !(v.network === 'Solana' ? SOL_RE : EVM_RE).test(v.address.trim()))
      next.address = v.network === 'Solana' ? 'Endereço Solana inválido (base58, 32–44 caracteres).' : 'Use 0x seguido de 40 caracteres hexadecimais.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) return document.getElementById(`wf-${role}-${first}`)?.focus()
    add.mutate({ label: v.label.trim(), provider: v.provider as WalletProvider, network: v.network as Network, address: v.address.trim(), ensName: v.ensName.trim() || undefined, role })
  }
  const p = `wf-${role}`
  return (
    <form onSubmit={submit} noValidate className="mt-6 border border-line p-4 sm:p-5" aria-label={role === 'primary' ? 'Nova carteira principal' : 'Nova carteira secundária'}>
      <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
        <Field id={`${p}-label`} label="Apelido da carteira" required error={errors.label}>
          <Input value={v.label} onChange={set('label')} />
        </Field>
        <Field id={`${p}-network`} label="Rede" required error={errors.network}>
          <Select value={v.network} onChange={set('network')}>
            <option value="">Selecione uma rede</option>
            {NETWORKS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field id={`${p}-address`} label="Endereço da carteira" required error={errors.address}>
          <Input value={v.address} onChange={set('address')} placeholder="Endereço 0x da carteira" spellCheck={false} />
        </Field>
        <Field id={`${p}-ensName`} label="ENS (opcional)">
          <Input value={v.ensName} onChange={set('ensName')} placeholder="nome.eth" />
        </Field>
        <Field id={`${p}-provider`} label="Tipo de carteira" required error={errors.provider}>
          <Select value={v.provider} onChange={set('provider')}>
            <option value="">Selecione uma carteira</option>
            {WALLET_PROVIDERS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-5 space-y-3">
        <FormError message={add.isError && !(isApiError(add.error) && add.error.fields) ? add.error.message : null} />
        <div className="flex gap-3">
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? 'Salvando…' : 'Salvar carteira'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  )
}

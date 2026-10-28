import { useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useCoupon } from '@/hooks/useCart'
import { isApiError } from '@/api/http'
import { cn } from '@/lib/utils'

export function Totals({
  subtotal,
  discount,
  networkFee,
  total,
  couponLabel,
  busy,
  feeNote = 'Taxa estimada',
}: {
  subtotal: string
  discount: string
  networkFee: string
  total: string
  couponLabel?: string
  busy?: boolean
  feeNote?: string
}) {
  return (
    <dl className={cn('space-y-2 text-[15px] transition-opacity', busy && 'opacity-60')} aria-busy={busy} data-testid="totals">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg" data-testid="subtotal">
          {subtotal} ETH
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Desconto do lançamento{couponLabel ? ` (${couponLabel})` : ''}</dt>
        <dd data-testid="discount">(-) {discount}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Taxa de rede</dt>
        <dd className="text-lg" data-testid="fee">
          {networkFee} ETH
        </dd>
      </div>
      <p className="text-right text-[11px] text-brand-strong">{feeNote}</p>
      <div className="flex justify-between gap-4 border-t border-line pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-brand-strong" data-testid="total">
          {total} ETH
        </dd>
      </div>
    </dl>
  )
}

/** Campo de cupom ligado ao carrinho no servidor (PUT/DELETE /api/cart/coupon). */
export function CouponForm({ applied, compact, children }: { applied: { code: string; percentOff: number } | null; compact?: boolean; children?: ReactNode }) {
  const { apply, remove } = useCoupon()
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(!compact)
  const error = apply.isError ? (isApiError(apply.error) ? apply.error.message : 'Não foi possível aplicar o cupom.') : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    apply.mutate(code.trim(), { onSuccess: () => setCode('') })
  }

  if (applied)
    return (
      <div className="flex items-center justify-between gap-2 border border-line px-3 py-2 text-sm" role="status" data-testid="coupon-applied">
        <span>
          Cupom <b>{applied.code}</b> aplicado ({applied.percentOff}% de desconto)
        </span>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="flex items-center gap-1 text-brand-strong hover:underline" aria-label={`Remover cupom ${applied.code}`}>
          <X className="size-4" aria-hidden="true" /> Remover
        </button>
      </div>
    )

  if (!open)
    return (
      <button type="button" className="mx-auto block text-sm hover:text-brand-strong" onClick={() => setOpen(true)} aria-expanded={false}>
        Tem um código promocional? Aplique aqui
      </button>
    )

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="coupon" className="mb-2 block text-sm font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          className="field-input rounded-r-none"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          autoComplete="off"
        />
        <button type="submit" className="shrink-0 bg-brand px-4 text-sm font-bold text-primary-foreground disabled:opacity-60" disabled={apply.isPending}>
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      {children}
    </form>
  )
}

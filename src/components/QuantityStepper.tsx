import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Seletor de quantidade inteira com limites; anuncia o valor via aria-live. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'md',
  disabled,
}: {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const btn = cn('flex items-center justify-center rounded-full bg-brand text-primary-foreground disabled:opacity-40', size === 'md' ? 'h-9 w-6 rounded-[12px]' : 'size-5 rounded-[6px]')
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className={size === 'md' ? 'size-4' : 'size-3'} aria-hidden="true" />
      </button>
      <output className={cn('min-w-6 text-center tabular-nums', size === 'md' ? 'text-lg' : 'text-base')} aria-live="polite" aria-label={`Quantidade: ${value}`}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className={size === 'md' ? 'size-4' : 'size-3'} aria-hidden="true" />
      </button>
    </div>
  )
}

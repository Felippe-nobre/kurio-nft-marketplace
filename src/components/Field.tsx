import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Campo de formulário acessível: associa label, dica e erro ao controle
 * (aria-describedby, aria-invalid, aria-required).
 */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
  id: idProp,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactElement
  id?: string
}) {
  const auto = useId()
  const id = idProp ?? auto
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })
        : children}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 flex items-center gap-1 text-xs text-danger">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 border border-danger/60 bg-danger/10 p-3 text-sm text-danger">
      <span aria-hidden="true">⚠</span>
      {message}
    </p>
  )
}

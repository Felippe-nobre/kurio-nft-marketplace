import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} {...props} className={cn('pr-11', props.className)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center text-muted hover:text-text"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

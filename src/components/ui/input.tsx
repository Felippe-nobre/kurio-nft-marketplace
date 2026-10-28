import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn('field-input', className)} ref={ref} {...props} />
))
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea className={cn('field-input min-h-28 resize-y', className)} ref={ref} {...props} />
))
Textarea.displayName = 'Textarea'

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(({ className, ...props }, ref) => (
  <select className={cn('field-input appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23cfb28c%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9', className)} ref={ref} {...props} />
))
Select.displayName = 'Select'

export { Input, Textarea, Select }

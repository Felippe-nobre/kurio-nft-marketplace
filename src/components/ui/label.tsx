import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }>(
  ({ className, required, children, ...props }, ref) => (
    <LabelPrimitive.Root ref={ref} className={cn('mb-1.5 block text-sm text-text', className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-brand-strong" aria-hidden="true">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  ),
)
Label.displayName = LabelPrimitive.Root.displayName

export { Label }

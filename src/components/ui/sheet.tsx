import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Drawer lateral (shadcn/ui Sheet) com foco preso e retorno de foco via Radix. */
const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' }
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-[min(22rem,88vw)] flex-col gap-4 overflow-y-auto bg-surface p-6 shadow-2xl focus-visible:outline-none',
        side === 'right' ? 'right-0 border-l border-line' : 'left-0 border-r border-line',
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-brand" aria-label="Fechar">
        <X className="size-5" aria-hidden="true" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

const SheetTitle = SheetPrimitive.Title
const SheetDescription = SheetPrimitive.Description

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }

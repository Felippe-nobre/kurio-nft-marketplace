import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold', {
  variants: {
    variant: {
      default: 'bg-brand text-primary-foreground',
      outline: 'border border-line text-muted rounded-full',
      success: 'bg-success/15 text-success rounded-full',
      danger: 'bg-danger/15 text-danger rounded-full',
      warning: 'bg-brand/15 text-brand-strong rounded-full',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }

import { cn } from '@/lib/utils'

/** Skeleton com shimmer (desligado em prefers-reduced-motion). Dimensões vêm do chamador para evitar CLS. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton', className)} {...props} />
}

export { Skeleton }

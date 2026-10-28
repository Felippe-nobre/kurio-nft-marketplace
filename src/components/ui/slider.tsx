import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }>(
  ({ className, thumbLabels = [], ...props }, ref) => (
    <SliderPrimitive.Root ref={ref} className={cn('relative flex h-6 w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-surface-2">
        <SliderPrimitive.Range className="absolute h-full bg-brand" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={thumbLabels[i]}
          className="block size-4 rounded-full border-[3px] border-brand bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
        />
      ))}
    </SliderPrimitive.Root>
  ),
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

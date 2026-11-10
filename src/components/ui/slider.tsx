import { Slider as SliderPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  /** Accessible name for the thumb (Radix renders the thumb as the focusable slider). */
  thumbLabel: string
}

function Slider({ className, thumbLabel, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-45',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-[linear-gradient(90deg,var(--neon-cyan),var(--neon-violet))]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        className={cn(
          'block size-6 rounded-full border-2 border-neon-cyan bg-foreground shadow-glow-cyan',
          'transition-transform duration-150 outline-none hover:scale-110 focus-visible:scale-110 focus-visible:ring-4 focus-visible:ring-neon-cyan/30',
        )}
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }

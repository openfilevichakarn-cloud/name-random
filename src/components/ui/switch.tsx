import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-input bg-muted p-0.5',
        'transition-colors duration-200 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:border-neon-cyan/60 data-[state=checked]:bg-neon-cyan/25',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5.5 rounded-full bg-muted-foreground transition-transform duration-200',
          'data-[state=checked]:translate-x-5 data-[state=checked]:bg-neon-cyan data-[state=checked]:shadow-glow-cyan',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

import { Check, Minus } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group inline-flex size-5.5 shrink-0 items-center justify-center rounded-md border border-input bg-ink/60',
        'transition-colors duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:text-ink',
        'data-[state=indeterminate]:border-neon-cyan data-[state=indeterminate]:bg-neon-cyan/30 data-[state=indeterminate]:text-neon-cyan',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="hidden size-4 stroke-[3] group-data-[state=checked]:block" aria-hidden />
        <Minus className="hidden size-4 stroke-[3] group-data-[state=indeterminate]:block" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

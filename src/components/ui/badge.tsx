import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-primary/40 bg-primary/15 text-[#c4b5fd]',
        cyan: 'border-neon-cyan/40 bg-neon-cyan/12 text-neon-cyan',
        pink: 'border-neon-pink/40 bg-neon-pink/12 text-[#f9a8d4]',
        lime: 'border-neon-lime/40 bg-neon-lime/12 text-neon-lime',
        gold: 'border-neon-gold/45 bg-neon-gold/12 text-neon-gold',
        muted: 'border-border bg-muted text-muted-foreground',
        destructive: 'border-destructive/40 bg-destructive/12 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

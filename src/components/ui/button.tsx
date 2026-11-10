import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold',
    'select-none transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
    "[&_svg:not([class*='size-'])]:size-[1.15em] [&_svg]:pointer-events-none [&_svg]:shrink-0",
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  ],
  {
    variants: {
      variant: {
        /** Solid primary action. */
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_-2px_0_rgb(0_0_0/0.22)] [text-shadow:0_1px_1px_rgb(0_0_0/0.3)] hover:brightness-110 hover:shadow-glow-violet',
        /** Hero call-to-action — the one button that must stand out on a page. */
        neon: 'bg-[linear-gradient(120deg,var(--neon-violet),var(--neon-pink))] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_10px_40px_-8px_rgb(236_72_153/0.65)] [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] hover:brightness-110 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_14px_50px_-6px_rgb(236_72_153/0.85)]',
        secondary:
          'border border-border bg-secondary/80 text-secondary-foreground hover:border-neon-cyan/50 hover:bg-accent',
        outline:
          'border border-input bg-transparent text-foreground hover:border-neon-cyan/60 hover:bg-neon-cyan/10 hover:text-neon-cyan',
        ghost: 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
        destructive:
          'border border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive hover:text-white',
        success:
          'bg-neon-lime text-[#12210a] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] hover:brightness-110',
        link: 'h-auto rounded-md p-0 text-neon-cyan underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 rounded-lg px-3 text-sm',
        default: 'h-11 px-5 text-[0.95rem]',
        lg: 'h-13 rounded-2xl px-7 text-lg',
        xl: 'h-16 rounded-3xl px-10 text-2xl font-bold tracking-wide',
        icon: 'size-11',
        'icon-sm': 'size-9 rounded-lg',
        'icon-lg': 'size-13 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element with button styling (e.g. a router link). */
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }

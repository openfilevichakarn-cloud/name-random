import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

interface GlassCardProps extends ComponentProps<'div'> {
  /** Adds the neon gradient outline — use for the one card that should lead the eye. */
  highlighted?: boolean
  /** Lift and glow on hover (for cards that are links/buttons). */
  interactive?: boolean
}

/** The standard rounded glass surface used across the app. */
export function GlassCard({ className, highlighted = false, interactive = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-3xl p-5 sm:p-6',
        highlighted && 'neon-border',
        interactive &&
          'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-neon-cyan/40 hover:shadow-glow-cyan',
        className,
      )}
      {...props}
    />
  )
}

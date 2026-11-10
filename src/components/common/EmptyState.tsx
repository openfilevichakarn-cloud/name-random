import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  /** Primary/secondary actions rendered under the text. */
  children?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)}>
      <div className="relative mb-5 flex size-20 items-center justify-center rounded-3xl border border-neon-violet/40 bg-neon-violet/10">
        <span className="absolute inset-0 animate-glow-pulse rounded-3xl bg-neon-violet/20 blur-xl" aria-hidden />
        <Icon className="relative size-9 text-neon-cyan" aria-hidden />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-muted-foreground">{description}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </div>
  )
}

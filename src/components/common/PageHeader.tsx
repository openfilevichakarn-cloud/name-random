import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Small uppercase English caption above the title. */
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  /** Buttons aligned to the right (stacked below the title on small screens). */
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        <p className="hud-label text-neon-cyan">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  )
}

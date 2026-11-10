import type { ReactNode } from 'react'

import { GlassCard } from '@/components/common/GlassCard'
import { cn } from '@/lib/utils'

interface SettingGroupProps {
  title: string
  description?: string
  /** Optional control aligned with the title (e.g. a reset button). */
  action?: ReactNode
  children: ReactNode
}

/** A titled card that groups related setting rows. */
export function SettingGroup({ title, description, action, children }: SettingGroupProps) {
  return (
    <GlassCard className="p-0 sm:p-0">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="divide-y divide-border/70">{children}</div>
    </GlassCard>
  )
}

interface SettingRowProps {
  label: string
  description?: ReactNode
  /** id of the control, so the label is clickable and announced. */
  htmlFor?: string
  /** Put the control under the text instead of beside it (for wide controls). */
  stacked?: boolean
  children: ReactNode
}

export function SettingRow({ label, description, htmlFor, stacked = false, children }: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-5 py-4 sm:px-6',
        stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6',
      )}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-medium">
            {label}
          </label>
        ) : (
          <p className="font-medium">{label}</p>
        )}
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className={cn('shrink-0', stacked ? 'w-full' : 'w-full sm:w-auto sm:min-w-56')}>{children}</div>
    </div>
  )
}

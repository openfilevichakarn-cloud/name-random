import type { LucideIcon } from 'lucide-react'

import { GlassCard } from '@/components/common/GlassCard'
import { cn } from '@/lib/utils'

interface StatTileProps {
  /** Sentence-case label, no trailing colon. */
  label: string
  value: number
  icon: LucideIcon
  /** Tailwind text colour class for the icon. The value itself always uses the text colour. */
  tone: string
  /** Signed change against a named period, e.g. `{ value: 3, period: 'เมื่อวาน' }`. */
  delta?: { value: number; period: string }
}

const numberFormat = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })

/** A headline number. The number is the chart: no axis, no bar. */
export function StatTile({ label, value, icon: Icon, tone, delta }: StatTileProps) {
  const sign = delta && delta.value > 0 ? '+' : ''
  return (
    <GlassCard className="flex flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn('size-5 shrink-0', tone)} aria-hidden />
      </div>
      {/* Proportional figures: tabular digits look loose at display sizes. */}
      <p className="text-4xl leading-none font-extrabold">{numberFormat.format(value)}</p>
      {delta ? (
        <p className="text-xs text-muted-foreground">
          <span className={cn('font-semibold', delta.value > 0 ? 'text-neon-lime' : 'text-foreground/80')}>
            {sign}
            {delta.value}
          </span>{' '}
          เทียบกับ{delta.period}
        </p>
      ) : (
        <p className="text-xs text-transparent select-none" aria-hidden>
          –
        </p>
      )}
    </GlassCard>
  )
}

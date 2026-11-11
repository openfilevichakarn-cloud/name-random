import { Dices, GraduationCap, UserPlus, type LucideIcon } from 'lucide-react'

import type { Activity, ActivityKind } from '@/features/history/lib/stats'
import { formatRelative } from '@/lib/date'
import { cn } from '@/lib/utils'

const KIND_META: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  classroom: { icon: GraduationCap, tone: 'text-neon-cyan' },
  students: { icon: UserPlus, tone: 'text-neon-lime' },
  draw: { icon: Dices, tone: 'text-neon-pink' },
}

interface ActivityFeedProps {
  activities: readonly Activity[]
}

/** What happened recently, as a simple timeline. */
export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
  }
  return (
    <ol className="grid gap-3">
      {activities.map((activity) => {
        const meta = KIND_META[activity.kind]
        return (
          <li key={activity.id} className="flex gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-ink/60">
              <meta.icon className={cn('size-4', meta.tone)} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activity.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[activity.detail, formatRelative(activity.at)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

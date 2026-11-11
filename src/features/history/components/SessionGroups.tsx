import { Badge } from '@/components/ui/badge'
import type { ID, RandomResult, RandomSession } from '@/data/types'
import { RESULT_MODE_META } from '@/features/randomizer/lib/modes'
import { formatDateTime, formatTime } from '@/lib/date'

import { drawKey } from '../lib/stats'
import type { SessionGroup } from '../lib/report'

interface SessionGroupsProps {
  groups: readonly SessionGroup[]
  sessions: ReadonlyMap<ID, RandomSession>
}

interface Draw {
  key: string
  results: RandomResult[]
}

/** Split a round's results into its draws, oldest draw first, picks in reveal order. */
function toDraws(results: readonly RandomResult[]): Draw[] {
  const draws = new Map<string, Draw>()
  for (const result of results) {
    const key = drawKey(result)
    const draw = draws.get(key)
    if (draw) draw.results.push(result)
    else draws.set(key, { key, results: [result] })
  }
  return [...draws.values()]
    .map((draw) => ({ ...draw, results: draw.results.sort((a, b) => a.pickIndex - b.pickIndex) }))
    .sort((a, b) => (a.results[0]?.drawIndex ?? 0) - (b.results[0]?.drawIndex ?? 0))
}

/** History grouped by round ("รอบ"): one card per session with its draws in order. */
export function SessionGroups({ groups, sessions }: SessionGroupsProps) {
  return (
    <ul className="grid gap-3 p-4 sm:p-6">
      {groups.map((group) => {
        const session = sessions.get(group.sessionId)
        const draws = toDraws(group.results)
        return (
          <li key={group.sessionId} className="rounded-2xl border border-border bg-ink/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-bold">{session?.classroomName || 'รอบการสุ่ม'}</h3>
                <p className="tabular text-sm text-muted-foreground">
                  เริ่ม {formatDateTime(session?.startedAt ?? group.latestAt)}
                  {session?.endedAt ? ` · จบ ${formatTime(session.endedAt)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="cyan">{group.draws} ครั้ง</Badge>
                <Badge variant="muted">{group.results.length} รายชื่อ</Badge>
                <Badge variant={session?.endedAt ? 'muted' : 'lime'}>{session?.endedAt ? 'จบรอบแล้ว' : 'รอบปัจจุบัน'}</Badge>
              </div>
            </div>
            <ol className="mt-3 grid gap-1.5">
              {draws.map((draw, index) => {
                const first = draw.results[0]
                if (!first) return null
                const meta = RESULT_MODE_META[first.mode]
                return (
                  <li key={draw.key} className="flex items-baseline gap-2.5 text-sm">
                    <span className="tabular w-6 shrink-0 text-right text-muted-foreground">{index + 1}.</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-neon-cyan">
                      <meta.icon className="size-3.5 self-center" aria-hidden />
                      {meta.label}
                    </span>
                    <span className="min-w-0 break-words">
                      {first.mode === 'team'
                        ? `${draw.results.length} คน แบ่งเป็น ${new Set(draw.results.map((result) => result.teamIndex)).size} ทีม`
                        : draw.results.map((result) => result.displayName).join(', ')}
                    </span>
                    <span className="tabular ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatTime(first.createdAt)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </li>
        )
      })}
    </ul>
  )
}

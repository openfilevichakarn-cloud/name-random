import { Star } from 'lucide-react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import type { NameFormat } from '@/data/settings'
import { getDisplayName, getFullName } from '@/features/students/lib/names'
import { formatRelative } from '@/lib/date'

import type { RankingEntry } from '../lib/ranking'

interface LeaderboardProps {
  leaders: readonly RankingEntry[]
  nameFormat: NameFormat
}

/**
 * Every student with stars, as a ranked bar list. One measure, one hue: the bar is the star
 * total relative to the leader; the numbers stay in text colour.
 */
export function Leaderboard({ leaders, nameFormat }: LeaderboardProps) {
  const best = Math.max(1, ...leaders.map((entry) => entry.stars))
  return (
    <ol className="flex flex-col gap-1" aria-label="อันดับดาวทั้งหมด" data-testid="leaderboard">
      {leaders.map((entry) => {
        const name = getDisplayName(entry.student, nameFormat)
        return (
          <li
            key={entry.student.id}
            className="grid grid-cols-[2.25rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/5 sm:px-3"
          >
            <span className="tabular text-center text-lg font-bold text-muted-foreground">
              <span className="sr-only">อันดับ </span>
              {entry.rank}
            </span>
            <StudentAvatar avatar={entry.student.avatar} seed={entry.student.id} className="size-10" />
            <div className="min-w-0">
              <p className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-semibold">{name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">เลขที่ {entry.student.number}</span>
              </p>
              {name !== getFullName(entry.student) ? (
                <p className="truncate text-xs text-muted-foreground">{getFullName(entry.student)}</p>
              ) : null}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8" aria-hidden>
                <div
                  className="h-full rounded-full bg-neon-gold"
                  style={{ width: `${Math.max(4, (entry.stars / best) * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-lg font-extrabold">
                <Star className="size-4 fill-neon-gold text-neon-gold" aria-hidden />
                <span className="tabular">{entry.stars}</span>
                <span className="sr-only">ดาว</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ถูกเลือก {entry.picks} ครั้ง
                {entry.lastPickedAt ? (
                  <span className="hidden sm:inline"> · {formatRelative(entry.lastPickedAt)}</span>
                ) : null}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

import type { ModeCount } from '@/features/history/lib/stats'
import { RESULT_MODE_META } from '@/features/randomizer/lib/modes'

interface ModeUsageProps {
  counts: readonly ModeCount[]
}

/**
 * Which modes are used most: ranked horizontal bars, largest first.
 * Modes are nominal categories, so every bar wears the same colour and the label carries identity.
 */
export function ModeUsage({ counts }: ModeUsageProps) {
  const max = counts.reduce((highest, item) => Math.max(highest, item.draws), 0)

  if (counts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วง 30 วันที่ผ่านมา</p>
  }

  return (
    <ul className="grid gap-3">
      {counts.map((item) => {
        const meta = RESULT_MODE_META[item.mode]
        return (
          <li key={item.mode} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <meta.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{meta.english}</span>
            </span>
            {/* Square at the baseline (left), rounded at the data end. */}
            <span className="h-2 border-l border-border" aria-hidden>
              <span
                className="block h-full min-w-1 rounded-r-full bg-neon-violet"
                style={{ width: `${max > 0 ? (item.draws / max) * 100 : 0}%` }}
              />
            </span>
            <span className="tabular text-right font-semibold">{item.draws}</span>
          </li>
        )
      })}
    </ul>
  )
}

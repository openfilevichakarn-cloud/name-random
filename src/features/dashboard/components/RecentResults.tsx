import { StudentAvatar } from '@/components/common/StudentAvatar'
import type { RandomResult } from '@/data/types'
import { RESULT_MODE_META } from '@/features/randomizer/lib/modes'
import { formatRelative } from '@/lib/date'

interface RecentResultsProps {
  results: readonly RandomResult[]
}

/** The latest draw results, newest first. */
export function RecentResults({ results }: RecentResultsProps) {
  if (results.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีผลการสุ่ม</p>
  }
  return (
    <ul className="grid gap-1">
      {results.map((result) => {
        const meta = RESULT_MODE_META[result.mode]
        return (
          <li key={result.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            {result.avatar ? (
              <StudentAvatar avatar={result.avatar} seed={result.studentId ?? result.id} className="size-10" />
            ) : (
              <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-[28%] bg-neon-violet/20 font-bold text-neon-cyan">
                {result.studentNumber ?? '#'}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{result.displayName}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <meta.icon className="size-3.5 shrink-0" aria-hidden />
                {meta.english}
                {result.meta?.teamName ? ` · ${result.meta.teamName}` : ''}
              </p>
            </div>
            <time dateTime={result.createdAt} className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(result.createdAt)}
            </time>
          </li>
        )
      })}
    </ul>
  )
}

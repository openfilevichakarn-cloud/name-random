import { Check, Flame, Gift, Target, X } from 'lucide-react'

import type { ResultMeta } from '@/data/types'

/** Mission, reward, quiz answer and Lucky Streak of one history row, as a compact line. */
export function ResultExtras({ meta }: { meta: ResultMeta | null }) {
  if (!meta || (!meta.challenge && !meta.reward && !meta.quiz && !meta.streak)) return null
  return (
    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" data-testid="result-extras">
      {meta.streak ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[#f9a8d4]">
          <Flame className="size-3.5" aria-hidden />
          Lucky Streak ×{meta.streak}
        </span>
      ) : null}
      {meta.quiz ? (
        <span
          className={`inline-flex shrink-0 items-center gap-1 ${meta.quiz === 'correct' ? 'text-neon-lime' : 'text-muted-foreground'}`}
        >
          {meta.quiz === 'correct' ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {meta.quiz === 'correct' ? 'ตอบถูก' : 'ตอบผิด'}
        </span>
      ) : null}
      {meta.challenge ? (
        <span className="inline-flex min-w-0 items-center gap-1 text-[#c4b5fd]" title={meta.challenge}>
          <Target className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">ภารกิจ: </span>
          <span className="truncate">{meta.challenge}</span>
        </span>
      ) : null}
      {meta.reward ? (
        <span className="inline-flex min-w-0 items-center gap-1 text-neon-lime" title={meta.reward}>
          <Gift className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">รางวัล: </span>
          <span className="truncate">{meta.reward}</span>
        </span>
      ) : null}
    </p>
  )
}

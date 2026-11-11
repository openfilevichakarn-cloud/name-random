import { Gift } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { WinnerExtras } from '../../engine/extras'
import type { Candidate } from '../../engine/types'
import { StarControl } from './StarControl'
import { StreakBadge } from './StreakBadge'

interface WinnerBadgesProps {
  winner: Candidate
  extras: WinnerExtras
  /** Multiple draws move on by themselves: flag the reward here, it is shown in full in the summary. */
  flagReward: boolean
  /** Stars under the name (single winner without a panel). */
  inlineStars: boolean
  reduced: boolean
  onStars: (points: number) => void
}

/** What sits right under the winner's name: Lucky Streak, a reward flag, the star control. */
export function WinnerBadges({ winner, extras, flagReward, inlineStars, reduced, onStars }: WinnerBadgesProps) {
  return (
    <>
      {extras.streak !== null ? <StreakBadge count={extras.streak} reduced={reduced} /> : null}
      {flagReward && extras.reward !== null ? (
        <Badge variant="lime" className="gap-1.5 px-3 py-1 text-sm">
          <Gift className="size-4" aria-hidden />
          ได้รางวัลเซอร์ไพรส์!
        </Badge>
      ) : null}
      {inlineStars ? (
        <div className="basis-full">
          <StarControl value={extras.points} name={winner.label} onChange={onStars} reduced={reduced} />
        </div>
      ) : null}
    </>
  )
}

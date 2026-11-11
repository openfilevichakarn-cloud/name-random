import { useHistoryStore } from '@/stores/historyStore'

import type { BattleMember } from './battle'

/** Highest value the `points` column accepts. */
const MAX_POINTS = 9999

export interface StarAwardResult {
  awarded: number
  failed: number
}

/**
 * Give every member one star on their row of the team split in the history, so Team Battle wins
 * count in the Class Ranking. Rows are updated in parallel; failures are counted, not thrown.
 */
export async function awardBattleStars(members: readonly BattleMember[]): Promise<StarAwardResult> {
  const history = useHistoryStore.getState()
  const known = new Map(history.recent.map((row) => [row.id, row.points]))
  const outcomes = await Promise.allSettled(
    members.flatMap((member) =>
      member.resultId
        ? [
            history.updateResult(member.resultId, {
              points: Math.min(MAX_POINTS, (known.get(member.resultId) ?? 0) + 1),
            }),
          ]
        : [],
    ),
  )
  const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length
  return { awarded: outcomes.length - failed, failed }
}

import type { Candidate } from '../../engine/types'

/** Most racers on the track at once; the winner is still drawn from the whole pool. */
export const MAX_RACERS = 6
/** Checkpoints a race is planned in (the animation moves linearly between them). */
export const CHECKPOINTS = 8

type Random = () => number

/**
 * Who lines up for this race: the winner (decided by the engine) plus others from the pool,
 * in a random lane order. Who else races is cosmetic.
 */
export function pickRacers(pool: readonly Candidate[], winner: Candidate, lanes = MAX_RACERS, random: Random = Math.random): Candidate[] {
  const others = pool.filter((candidate) => candidate.id !== winner.id)
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[others[i], others[j]] = [others[j] as Candidate, others[i] as Candidate]
  }
  const racers = [winner, ...others.slice(0, Math.max(0, lanes - 1))]
  for (let i = racers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[racers[i], racers[j]] = [racers[j] as Candidate, racers[i] as Candidate]
  }
  return racers
}

/**
 * Progress (0–1) of every racer at each checkpoint, 0 at the start. The winner reaches 1 at the
 * last checkpoint; everyone else ends between 0.78 and 0.95, so the animation can only finish one
 * way. Uneven steps make the lead change during the race.
 */
export function planRace(racers: readonly Candidate[], winnerId: string, random: Random = Math.random): number[][] {
  return racers.map((racer) => {
    const winner = racer.id === winnerId
    const final = winner ? 1 : 0.78 + random() * 0.17
    // Uneven effort per segment; the winner often saves a burst for the end.
    const weights = Array.from({ length: CHECKPOINTS }, (_, step) => {
      const burst = winner && step >= CHECKPOINTS - 2 ? 1.25 + random() * 0.6 : 1
      return (0.45 + random() * 1.1) * burst
    })
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const points = [0]
    let covered = 0
    for (const weight of weights) {
      covered += weight
      points.push((covered / total) * final)
    }
    points[CHECKPOINTS] = final
    return points
  })
}

/** Index of the racer furthest ahead at a checkpoint. */
export function leaderAt(plan: readonly (readonly number[])[], checkpoint: number): number {
  let best = 0
  plan.forEach((points, index) => {
    if ((points[checkpoint] ?? 0) > (plan[best]?.[checkpoint] ?? 0)) best = index
  })
  return best
}

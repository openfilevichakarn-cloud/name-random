import type { Candidate } from '../../engine/types'

/** Most racers on the track at once (a whole class); the winner is still drawn from the whole pool. */
export const MAX_RACERS = 50
/** Up to this many racers each get a lane of their own; a bigger field shares the water and overlaps. */
export const LANE_LIMIT = 8
/** Checkpoints a race is planned in (the animation moves linearly between them). */
export const CHECKPOINTS = 8

type Random = () => number

/**
 * Who lines up for this race: the winner (decided by the engine) plus others from the pool,
 * in a random lane order. Who else races is cosmetic.
 */
export function pickRacers(
  pool: readonly Candidate[],
  winner: Candidate,
  lanes = MAX_RACERS,
  random: Random = Math.random,
): Candidate[] {
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
  return standingsAt(plan, checkpoint)[0] ?? 0
}

/** Racer indices from first to last place at a checkpoint. */
export function standingsAt(plan: readonly (readonly number[])[], checkpoint: number): number[] {
  return plan
    .map((points, index) => ({ index, progress: points[checkpoint] ?? 0 }))
    .sort((a, b) => b.progress - a.progress || a.index - b.index)
    .map((entry) => entry.index)
}

/**
 * Vertical position (0–1, centre of the racer) of each racer on the track. Small fields get even lanes;
 * a big field is spread over the whole track with a little jitter, so racers overlap like a crowd.
 */
export function rowPositions(count: number, random: Random = Math.random): number[] {
  return Array.from({ length: count }, (_, index) => {
    const base = (index + 0.5) / count
    if (count <= LANE_LIMIT) return base
    const jitter = (random() - 0.5) * (0.8 / count)
    return Math.min(0.96, Math.max(0.04, base + jitter))
  })
}

/** Racer height as a share of the track height: big in small fields, overlapping in a crowd. */
export function racerHeight(count: number): number {
  if (count <= LANE_LIMIT) return Math.min(0.24, 0.78 / Math.max(1, count))
  return Math.max(0.085, Math.min(0.16, 1.6 / count))
}

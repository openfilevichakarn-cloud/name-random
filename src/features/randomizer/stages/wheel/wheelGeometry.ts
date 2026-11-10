/**
 * Wheel geometry. Angles are in degrees, measured clockwise from the pointer, which sits at
 * 3 o'clock so the winning label reads horizontally. Segment i covers [i·size, (i+1)·size).
 */

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/** Index of the segment under the pointer when the wheel has been rotated clockwise by `rotation`. */
export function segmentAtPointer(rotation: number, count: number): number {
  if (count <= 0) return -1
  const local = normalizeAngle(-rotation)
  return Math.min(count - 1, Math.floor(local / (360 / count)))
}

interface SpinTargetInput {
  /** Current cumulative rotation of the wheel. */
  current: number
  count: number
  winnerIndex: number
  /** Whole turns to add before landing. */
  turns: number
  /** Where inside the winning segment to stop, 0–1 (kept away from the edges by the caller). */
  fraction: number
}

/** The cumulative rotation at which the pointer rests on the winner after `turns` extra turns. */
export function getSpinTarget({ current, count, winnerIndex, turns, fraction }: SpinTargetInput): number {
  const size = 360 / count
  const local = (winnerIndex + fraction) * size
  const targetMod = normalizeAngle(-local)
  const delta = normalizeAngle(targetMod - normalizeAngle(current))
  return current + delta + 360 * turns
}

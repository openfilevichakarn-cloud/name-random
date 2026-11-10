import type { ResultMode } from '@/data/types'

import type { Candidate } from '../engine/types'

/**
 * Draw pipeline phases (see docs/ARCHITECTURE.md §6.1).
 *
 * idle → ready → running → suspense → reveal → (next winner: running …) → summary | idle
 * Mystery Card inserts `dealing → picking` before `running`.
 */
export type StagePhase = 'idle' | 'ready' | 'dealing' | 'picking' | 'running' | 'suspense' | 'reveal' | 'summary'

/** One animation run that must end showing `winner`. */
export interface StageRun {
  /** Unique per run; a new key starts a new animation. */
  key: string
  winner: Candidate
  /** 0-based position of this winner in the draw, and how many winners the draw has. */
  index: number
  total: number
  /** Shortened animation, used from the second winner of a multiple draw onwards. */
  quick: boolean
}

/** Props shared by the stage components of the five game modes. */
export interface StageProps {
  /** The pool on stage: everyone who can still be drawn. */
  candidates: readonly Candidate[]
  phase: StagePhase
  run: StageRun | null
  /** Duration multiplier (animation level × reveal pace). */
  timeScale: number
  /** Decorative looping motion is allowed. */
  ambient: boolean
  /** The animation for `runKey` has come to rest on its winner. */
  onSettled: (runKey: string) => void
  /** The stage itself was pressed (wheel hub, gacha crank) — same as pressing the draw button. */
  onActivate: () => void
}

export type StageMode = ResultMode

/** Neon palette used to colour wheel segments, capsules, cards and teams. */
export const STAGE_COLORS = ['#8B5CF6', '#22D3EE', '#EC4899', '#A3E635', '#FBBF24'] as const

/** Colour for item `index` of `count`, never equal to both neighbours around a closed ring. */
export function stageColor(index: number, count = Number.POSITIVE_INFINITY): string {
  const palette = STAGE_COLORS
  const last = count - 1
  // When the ring closes on the first colour, give the last item a different one.
  if (count > 1 && index === last && last % palette.length === 0) return palette[2]
  return palette[index % palette.length] as string
}

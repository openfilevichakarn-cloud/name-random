import type { DrawType, RepeatPolicy } from '@/data/types'

/** Something that can be drawn: a student, or a plain number. */
export interface Candidate {
  /** Stable id — the student id, or `n:<number>` for number draws. */
  id: string
  /** Big label shown on the stage. */
  label: string
  /** Secondary line (full name, or the student behind a number). Empty when there is nothing to add. */
  detail: string
  number: number | null
  /** Encoded avatar, or null when the candidate has none (bare numbers). */
  avatar: string | null
  studentId: string | null
}

/** Who is currently out of the pool, and why. */
export interface PoolState {
  /** Drawn in the current round, oldest first. Only consulted under the no-repeat policy. */
  drawnIds: readonly string[]
  /** Taken out by the teacher (manual exclude / exclude selected). */
  excludedIds: readonly string[]
}

export type DrawRequest =
  | { type: 'single' }
  | { type: 'multiple'; count: number }
  /** `count` = number of teams, `size` = target members per team. */
  | { type: 'team'; split: 'count' | 'size'; value: number }

export type DrawErrorCode = 'empty-pool' | 'round-complete' | 'not-enough' | 'invalid-request'

export interface DrawError {
  code: DrawErrorCode
  /** Thai message that can be shown to the teacher as is. */
  message: string
}

export interface Team {
  /** 0-based. */
  index: number
  name: string
  members: Candidate[]
}

/**
 * The complete outcome of a draw, computed before any animation starts.
 * Stage components only ever display a plan; they never decide a result.
 */
export interface DrawPlan {
  id: string
  type: DrawType
  policy: RepeatPolicy
  /** The pool the draw was made from — what the animation shows. */
  eligible: Candidate[]
  /** Winners in reveal order (single / multiple). Empty for team and card draws. */
  winners: Candidate[]
  /** Team draws only. */
  teams: Team[]
  /**
   * Mystery Card only: the face-down cards, already bound to candidates.
   * The winner is whichever card the student turns over.
   */
  cards: Candidate[]
  /** How many winners this draw produces (cards: how many cards may be turned over). */
  picks: number
  /** True when fewer winners than requested were available. */
  clamped: boolean
  /** No-repeat: candidates left in the round after this draw. Null when repeats are allowed. */
  remainingAfter: number | null
  /** No-repeat: this draw uses up the pool. */
  roundComplete: boolean
}

export type DrawOutcome = { ok: true; plan: DrawPlan } | { ok: false; error: DrawError }

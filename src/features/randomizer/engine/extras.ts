import type { FeatureSettings } from '@/data/settings'
import type { QuizOutcome, RandomResult, ResultMeta } from '@/data/types'

import type { Rng } from './rng'
import { shuffle } from './shuffle'
import type { Candidate } from './types'

/** Most stars a teacher can give one winner on the winner screen. */
export const MAX_STARS_PER_PICK = 5

/**
 * The game layer attached to one winner. `streak`, `challenge` and `reward` are decided when the
 * winner becomes official — before the reveal shows them — the teacher then adds stars and the quiz result.
 */
export interface WinnerExtras {
  /** Lucky Streak: picks of this student today, this one included. Only set from the second pick on. */
  streak: number | null
  challenge: string | null
  reward: string | null
  /** Stars given on the winner screen (Class Ranking). */
  points: number
  quiz: QuizOutcome | null
}

export const NO_EXTRAS: WinnerExtras = Object.freeze({
  streak: null,
  challenge: null,
  reward: null,
  points: 0,
  quiz: null,
})

/**
 * A shuffled deck: every item is dealt once before any item comes back, so a class does not get the
 * same mission twice in a row. When the deck is refilled, the item dealt last is never dealt first.
 * Editing the list starts a new deck.
 */
export interface Deck<T> {
  /** The next item, or null for an empty list. */
  draw(items: readonly T[]): T | null
}

export function createDeck<T>(rng: Rng): Deck<T> {
  let source: readonly T[] = []
  let pile: T[] = []
  let last: T | undefined

  return {
    draw(items) {
      if (items.length === 0) return null
      if (items.length !== source.length || items.some((item, index) => item !== source[index])) {
        source = [...items]
        pile = []
      }
      if (pile.length === 0) {
        pile = shuffle(source, rng)
        const top = pile.length - 1
        if (top > 0 && pile[top] === last) {
          const other = rng.nextInt(top)
          const swap = pile[other] as T
          pile[other] = pile[top] as T
          pile[top] = swap
        }
      }
      const item = pile.pop() as T
      last = item
      return item
    },
  }
}

const CHANCE_STEPS = 10_000

/** True with probability `chance` (0–1). */
export function rollChance(chance: number, rng: Rng): boolean {
  if (!(chance > 0)) return false
  if (chance >= 1) return true
  return rng.nextInt(CHANCE_STEPS) < Math.round(chance * CHANCE_STEPS)
}

/** How often a student was picked since `sinceIso` according to the history. Team splits do not count. */
export function countPicksSince(history: readonly RandomResult[], studentId: string, sinceIso: string): number {
  let count = 0
  for (const row of history) {
    if (row.studentId === studentId && row.drawType !== 'team' && row.createdAt >= sinceIso) count += 1
  }
  return count
}

export interface ExtrasInput {
  candidate: Candidate
  features: FeatureSettings
  /** Earlier picks of this candidate today (the history plus writes still in flight). */
  earlierPicksToday: number
  challenges: Deck<string>
  rewards: Deck<string>
  rng: Rng
}

/** Decide the extras of a winner who has just been drawn. */
export function decideExtras({
  candidate,
  features,
  earlierPicksToday,
  challenges,
  rewards,
  rng,
}: ExtrasInput): WinnerExtras {
  const picks = earlierPicksToday + 1
  return {
    streak: features.streak && candidate.studentId !== null && picks >= 2 ? picks : null,
    challenge: features.challenge ? challenges.draw(features.challenges) : null,
    reward:
      features.reward && features.rewards.length > 0 && rollChance(features.rewardChance, rng)
        ? rewards.draw(features.rewards)
        : null,
    points: 0,
    quiz: null,
  }
}

/** Stars only make sense for a roster student: the ranking adds them up per student. */
export function canAwardStars(winner: Candidate, features: FeatureSettings): boolean {
  return features.stars && winner.studentId !== null
}

/**
 * Whether the single-winner screen gets a panel beside the winner (reward, mission, quiz).
 * Stars alone fit under the name and need no panel.
 */
export function hasWinnerPanel(extras: WinnerExtras, features: FeatureSettings): boolean {
  return extras.reward !== null || extras.challenge !== null || features.quiz
}

/** The extras as stored on the history row. Null when there is nothing to store. */
export function toResultMeta(extras: WinnerExtras): ResultMeta | null {
  const meta: ResultMeta = {}
  if (extras.streak !== null) meta.streak = extras.streak
  if (extras.challenge !== null) meta.challenge = extras.challenge
  if (extras.reward !== null) meta.reward = extras.reward
  if (extras.quiz !== null) meta.quiz = extras.quiz
  return Object.keys(meta).length > 0 ? meta : null
}

/** Clamp a star count to what one pick can hold. */
export function clampStars(points: number): number {
  return Math.min(MAX_STARS_PER_PICK, Math.max(0, Math.round(points)))
}

/**
 * Record a quiz answer. With stars on, a correct answer is worth one star: marking an answer correct
 * adds it, changing a correct answer to anything else takes it back.
 */
export function applyQuizOutcome(
  extras: WinnerExtras,
  outcome: QuizOutcome | null,
  starsEnabled: boolean,
): WinnerExtras {
  if (extras.quiz === outcome) return extras
  let points = extras.points
  if (starsEnabled) {
    if (outcome === 'correct') points += 1
    else if (extras.quiz === 'correct') points -= 1
  }
  return { ...extras, quiz: outcome, points: clampStars(points) }
}

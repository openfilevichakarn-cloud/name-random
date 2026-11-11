import { describe, expect, it } from 'vitest'

import { createDefaultSettings, type FeatureSettings } from '@/data/settings'
import type { RandomResult } from '@/data/types'

import {
  applyQuizOutcome,
  clampStars,
  countPicksSince,
  createDeck,
  decideExtras,
  MAX_STARS_PER_PICK,
  NO_EXTRAS,
  rollChance,
  toResultMeta,
} from './extras'
import { createSeededRng, type Rng } from './rng'
import type { Candidate } from './types'

const student: Candidate = { id: 's1', label: 'ต้นกล้า', detail: '', number: 1, avatar: 'bot:1', studentId: 's1' }
const bareNumber: Candidate = { id: 'n:7', label: '7', detail: '', number: 7, avatar: null, studentId: null }

function features(patch: Partial<FeatureSettings> = {}): FeatureSettings {
  return { ...createDefaultSettings().features, ...patch }
}

/** An RNG that always returns the same value (clamped to the bound). */
function fixedRng(value: number): Rng {
  return { nextInt: (max) => Math.min(value, max - 1) }
}

function result(patch: Partial<RandomResult>): RandomResult {
  return {
    id: crypto.randomUUID(),
    schoolId: null,
    userId: null,
    sessionId: 'session',
    classroomId: 'room',
    studentId: 's1',
    displayName: 'ต้นกล้า',
    studentNumber: 1,
    avatar: null,
    mode: 'wheel',
    drawType: 'single',
    drawIndex: 1,
    pickIndex: 1,
    teamIndex: null,
    points: 0,
    meta: null,
    createdAt: '2026-11-11T03:00:00.000Z',
    ...patch,
  }
}

describe('createDeck', () => {
  it('deals every item once before repeating', () => {
    const deck = createDeck<string>(createSeededRng(7))
    const items = ['a', 'b', 'c', 'd', 'e']
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const dealt = items.map(() => deck.draw(items))
      expect([...dealt].sort()).toEqual(items)
    }
  })

  it('never deals the same item twice in a row across refills', () => {
    const deck = createDeck<string>(createSeededRng(3))
    const items = ['a', 'b', 'c']
    let previous: string | null = null
    for (let i = 0; i < 300; i += 1) {
      const item = deck.draw(items)
      expect(item).not.toBe(previous)
      previous = item
    }
  })

  it('starts a new deck when the list changes, and handles empty and single-item lists', () => {
    const deck = createDeck<string>(createSeededRng(11))
    expect(deck.draw([])).toBeNull()
    expect(deck.draw(['only'])).toBe('only')
    expect(deck.draw(['only'])).toBe('only')
    deck.draw(['a', 'b', 'c'])
    expect(['x', 'y']).toContain(deck.draw(['x', 'y']))
  })

  it('reaches every item first with roughly equal frequency', () => {
    const items = ['a', 'b', 'c', 'd']
    const counts = new Map<string, number>()
    const rng = createSeededRng(99)
    for (let i = 0; i < 4000; i += 1) {
      const first = createDeck<string>(rng).draw(items) as string
      counts.set(first, (counts.get(first) ?? 0) + 1)
    }
    for (const item of items) expect(counts.get(item)).toBeGreaterThan(850)
  })
})

describe('rollChance', () => {
  it('handles the edges without consuming randomness', () => {
    const rng: Rng = {
      nextInt: () => {
        throw new Error('should not be called')
      },
    }
    expect(rollChance(0, rng)).toBe(false)
    expect(rollChance(-1, rng)).toBe(false)
    expect(rollChance(Number.NaN, rng)).toBe(false)
    expect(rollChance(1, rng)).toBe(true)
  })

  it('hits with the requested probability', () => {
    const rng = createSeededRng(5)
    let hits = 0
    for (let i = 0; i < 20_000; i += 1) if (rollChance(0.2, rng)) hits += 1
    expect(hits / 20_000).toBeGreaterThan(0.185)
    expect(hits / 20_000).toBeLessThan(0.215)
  })
})

describe('countPicksSince', () => {
  it('counts single and multiple picks of the student since the given time', () => {
    const since = '2026-11-11T00:00:00.000Z'
    const history = [
      result({ drawType: 'single' }),
      result({ drawType: 'multiple', pickIndex: 2 }),
      result({ drawType: 'team', teamIndex: 0 }),
      result({ createdAt: '2026-11-10T09:00:00.000Z' }),
      result({ studentId: 's2' }),
    ]
    expect(countPicksSince(history, 's1', since)).toBe(2)
    expect(countPicksSince(history, 's2', since)).toBe(1)
    expect(countPicksSince(history, 'nobody', since)).toBe(0)
  })
})

describe('decideExtras', () => {
  const decks = () => ({
    challenges: createDeck<string>(createSeededRng(1)),
    rewards: createDeck<string>(createSeededRng(2)),
  })

  it('starts the Lucky Streak at the second pick of the day, for students only', () => {
    const base = { features: features({ streak: true }), rng: fixedRng(0), ...decks() }
    expect(decideExtras({ ...base, candidate: student, earlierPicksToday: 0 }).streak).toBeNull()
    expect(decideExtras({ ...base, candidate: student, earlierPicksToday: 2 }).streak).toBe(3)
    expect(decideExtras({ ...base, candidate: bareNumber, earlierPicksToday: 2 }).streak).toBeNull()
    expect(
      decideExtras({ ...base, features: features({ streak: false }), candidate: student, earlierPicksToday: 2 }).streak,
    ).toBeNull()
  })

  it('draws a challenge only when the feature is on and the list has items', () => {
    const base = { candidate: student, earlierPicksToday: 0, rng: fixedRng(0), ...decks() }
    expect(decideExtras({ ...base, features: features({ challenge: true, challenges: ['ร้องเพลง'] }) }).challenge).toBe(
      'ร้องเพลง',
    )
    expect(decideExtras({ ...base, features: features({ challenge: true, challenges: [] }) }).challenge).toBeNull()
    expect(decideExtras({ ...base, features: features({ challenge: false }) }).challenge).toBeNull()
  })

  it('gives a reward according to the chance', () => {
    const base = { candidate: student, earlierPicksToday: 0, ...decks() }
    const on = features({ reward: true, rewards: ['สติกเกอร์'], rewardChance: 0.5 })
    // nextInt(10000) → 0 is below 5000: a hit. 9999 is not.
    expect(decideExtras({ ...base, features: on, rng: fixedRng(0) }).reward).toBe('สติกเกอร์')
    expect(decideExtras({ ...base, features: on, rng: fixedRng(9999) }).reward).toBeNull()
    expect(decideExtras({ ...base, features: { ...on, rewards: [] }, rng: fixedRng(0) }).reward).toBeNull()
    expect(decideExtras({ ...base, features: { ...on, reward: false }, rng: fixedRng(0) }).reward).toBeNull()
  })

  it('always starts without stars or a quiz result', () => {
    const extras = decideExtras({
      candidate: student,
      earlierPicksToday: 0,
      features: features(),
      rng: fixedRng(0),
      ...decks(),
    })
    expect(extras.points).toBe(0)
    expect(extras.quiz).toBeNull()
  })
})

describe('toResultMeta', () => {
  it('stores only what is set', () => {
    expect(toResultMeta(NO_EXTRAS)).toBeNull()
    expect(toResultMeta({ ...NO_EXTRAS, streak: 2, reward: 'สติกเกอร์', quiz: 'wrong', points: 3 })).toEqual({
      streak: 2,
      reward: 'สติกเกอร์',
      quiz: 'wrong',
    })
  })
})

describe('stars and quiz', () => {
  it('clamps stars', () => {
    expect(clampStars(-2)).toBe(0)
    expect(clampStars(2.6)).toBe(3)
    expect(clampStars(99)).toBe(MAX_STARS_PER_PICK)
  })

  it('awards one star for a correct answer and takes it back when the answer changes', () => {
    const correct = applyQuizOutcome(NO_EXTRAS, 'correct', true)
    expect(correct).toMatchObject({ quiz: 'correct', points: 1 })
    expect(applyQuizOutcome(correct, 'wrong', true)).toMatchObject({ quiz: 'wrong', points: 0 })
    expect(applyQuizOutcome(correct, null, true)).toMatchObject({ quiz: null, points: 0 })
    expect(applyQuizOutcome(correct, 'correct', true)).toBe(correct)
  })

  it('records the answer without stars when stars are off', () => {
    expect(applyQuizOutcome({ ...NO_EXTRAS, points: 2 }, 'correct', false)).toMatchObject({
      quiz: 'correct',
      points: 2,
    })
  })
})

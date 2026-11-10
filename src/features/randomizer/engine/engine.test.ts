import { describe, expect, it } from 'vitest'

import type { Student } from '@/data/types'

import { buildNumberCandidates, buildStudentCandidates } from './candidates'
import { getActive, getEligible, makeTeams, planDraw, resolveTeamCount } from './engine'
import { createCryptoRng, createSeededRng, cryptoRng, type Rng } from './rng'
import { pickOne, sample, shuffle } from './shuffle'
import type { Candidate, DrawPlan, PoolState } from './types'

function candidates(count: number): Candidate[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `s${index + 1}`,
    label: `คนที่ ${index + 1}`,
    detail: '',
    number: index + 1,
    avatar: null,
    studentId: `s${index + 1}`,
  }))
}

const emptyPool: PoolState = { drawnIds: [], excludedIds: [] }

function expectPlan(outcome: ReturnType<typeof planDraw>): DrawPlan {
  if (!outcome.ok) throw new Error(`expected a plan, got error ${outcome.error.code}`)
  return outcome.plan
}

/** Pearson chi-square statistic for observed counts against a uniform expectation. */
function chiSquare(counts: number[], total: number): number {
  const expected = total / counts.length
  return counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
}

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

describe('createCryptoRng', () => {
  it('rejects values in the biased tail instead of folding them with modulo', () => {
    // For n = 3 the accepted range is [0, 4294967295 - 1): 2^32 % 3 === 1, so only 0xFFFFFFFF is rejected.
    const feed = [0xffff_ffff, 0xffff_ffff, 7]
    let calls = 0
    const rng = createCryptoRng((buffer) => {
      buffer[0] = feed[calls] ?? 0
      calls += 1
    })
    expect(rng.nextInt(3)).toBe(7 % 3)
    expect(calls).toBe(3)
  })

  it('accepts the largest unbiased value', () => {
    const rng = createCryptoRng((buffer) => {
      buffer[0] = 0xffff_fffe
    })
    expect(rng.nextInt(3)).toBe(0xffff_fffe % 3)
  })

  it('never consumes entropy for a single outcome', () => {
    let calls = 0
    const rng = createCryptoRng(() => {
      calls += 1
    })
    expect(rng.nextInt(1)).toBe(0)
    expect(calls).toBe(0)
  })

  it('rejects invalid bounds', () => {
    for (const bound of [0, -1, 1.5, Number.NaN, 2 ** 32 + 1]) {
      expect(() => cryptoRng.nextInt(bound)).toThrow(RangeError)
    }
  })

  it('stays inside the range and is uniform (real crypto source)', () => {
    const buckets = 10
    const total = 60_000
    const counts = Array.from({ length: buckets }, () => 0)
    for (let i = 0; i < total; i += 1) {
      const value = cryptoRng.nextInt(buckets)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(buckets)
      counts[value] = (counts[value] ?? 0) + 1
    }
    // 9 degrees of freedom: p = 0.0001 critical value is 33.7. A correct RNG fails this ~1 in 10,000 runs.
    expect(chiSquare(counts, total)).toBeLessThan(33.7)
  })

  it('is deterministic when seeded', () => {
    const a = createSeededRng(42)
    const b = createSeededRng(42)
    const c = createSeededRng(43)
    const take = (rng: Rng) => Array.from({ length: 20 }, () => rng.nextInt(1000))
    const first = take(a)
    expect(take(b)).toEqual(first)
    expect(take(c)).not.toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Shuffle
// ---------------------------------------------------------------------------

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const copy = [...input]
    const result = shuffle(input, createSeededRng(1))
    expect(input).toEqual(copy)
    expect(result).not.toBe(input)
    expect([...result].sort((a, b) => a - b)).toEqual(copy)
  })

  it('handles empty and single-item lists', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['a'])).toEqual(['a'])
  })

  it('produces every permutation equally often', () => {
    const rng = createSeededRng(2026)
    const total = 24_000
    const counts = new Map<string, number>()
    for (let i = 0; i < total; i += 1) {
      const key = shuffle([1, 2, 3, 4], rng).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(24)
    // 23 degrees of freedom: p = 0.0001 critical value is 58.6.
    expect(chiSquare([...counts.values()], total)).toBeLessThan(58.6)
  })
})

describe('sample', () => {
  it('returns distinct items from the list', () => {
    const items = candidates(30)
    const picked = sample(items, 10, createSeededRng(5))
    expect(picked).toHaveLength(10)
    expect(new Set(picked.map((item) => item.id)).size).toBe(10)
    for (const item of picked) expect(items).toContain(item)
  })

  it('clamps the count to what is available', () => {
    expect(sample([1, 2, 3], 10, createSeededRng(1))).toHaveLength(3)
    expect(sample([1, 2, 3], 0)).toEqual([])
    expect(sample([1, 2, 3], -4)).toEqual([])
    expect(sample([], 3)).toEqual([])
  })

  it('gives every item the same chance of being chosen', () => {
    const rng = createSeededRng(77)
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const total = 30_000
    const counts = items.map(() => 0)
    for (let i = 0; i < total; i += 1) {
      for (const value of sample(items, 3, rng)) counts[value] = (counts[value] ?? 0) + 1
    }
    expect(chiSquare(counts, total * 3)).toBeLessThan(33.7)
  })
})

describe('pickOne', () => {
  it('throws on an empty list and returns a member otherwise', () => {
    expect(() => pickOne([])).toThrow(RangeError)
    expect(['a', 'b']).toContain(pickOne(['a', 'b']))
  })
})

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

describe('getActive / getEligible', () => {
  const pool = candidates(5)

  it('removes manually excluded candidates under every policy', () => {
    const state: PoolState = { drawnIds: [], excludedIds: ['s2', 's4'] }
    expect(getActive(pool, state).map((c) => c.id)).toEqual(['s1', 's3', 's5'])
    expect(getEligible(pool, state, 'allow-repeat').map((c) => c.id)).toEqual(['s1', 's3', 's5'])
    expect(getEligible(pool, state, 'no-repeat').map((c) => c.id)).toEqual(['s1', 's3', 's5'])
  })

  it('removes drawn candidates only when repeats are off', () => {
    const state: PoolState = { drawnIds: ['s1', 's5'], excludedIds: ['s2'] }
    expect(getEligible(pool, state, 'no-repeat').map((c) => c.id)).toEqual(['s3', 's4'])
    expect(getEligible(pool, state, 'allow-repeat').map((c) => c.id)).toEqual(['s1', 's3', 's4', 's5'])
  })

  it('ignores ids that are no longer in the pool', () => {
    const state: PoolState = { drawnIds: ['gone'], excludedIds: ['also-gone'] }
    expect(getEligible(pool, state, 'no-repeat')).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// planDraw — single
// ---------------------------------------------------------------------------

describe('planDraw: normal random (single)', () => {
  it('picks exactly one eligible candidate and reports the pool it came from', () => {
    const pool = candidates(12)
    const plan = expectPlan(
      planDraw({ candidates: pool, pool: emptyPool, policy: 'no-repeat', request: { type: 'single' }, rng: createSeededRng(3) }),
    )
    expect(plan.type).toBe('single')
    expect(plan.winners).toHaveLength(1)
    expect(plan.eligible).toHaveLength(12)
    expect(plan.eligible).toContain(plan.winners[0])
    expect(plan.picks).toBe(1)
    expect(plan.remainingAfter).toBe(11)
    expect(plan.roundComplete).toBe(false)
  })

  it('gives every candidate the same chance', () => {
    const rng = createSeededRng(11)
    const pool = candidates(8)
    const total = 24_000
    for (const policy of ['no-repeat', 'allow-repeat'] as const) {
      const counts = new Map<string, number>()
      for (let i = 0; i < total; i += 1) {
        const plan = expectPlan(planDraw({ candidates: pool, pool: emptyPool, policy, request: { type: 'single' }, rng }))
        const id = plan.winners[0]?.id ?? ''
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      expect(counts.size).toBe(8)
      // 7 degrees of freedom: p = 0.0001 critical value is 29.9.
      expect(chiSquare([...counts.values()], total)).toBeLessThan(29.9)
    }
  })

  it('fails with empty-pool when nobody takes part', () => {
    const none = planDraw({ candidates: [], pool: emptyPool, policy: 'no-repeat', request: { type: 'single' } })
    expect(none).toMatchObject({ ok: false, error: { code: 'empty-pool' } })

    const allExcluded = planDraw({
      candidates: candidates(2),
      pool: { drawnIds: [], excludedIds: ['s1', 's2'] },
      policy: 'allow-repeat',
      request: { type: 'single' },
    })
    expect(allExcluded).toMatchObject({ ok: false, error: { code: 'empty-pool' } })
  })
})

describe('planDraw: no repeat', () => {
  it('draws every candidate exactly once, then reports the round as complete', () => {
    const rng = createSeededRng(99)
    const pool = candidates(25)
    const drawn: string[] = []

    for (let turn = 0; turn < pool.length; turn += 1) {
      const plan = expectPlan(
        planDraw({ candidates: pool, pool: { drawnIds: drawn, excludedIds: [] }, policy: 'no-repeat', request: { type: 'single' }, rng }),
      )
      const winner = plan.winners[0]
      if (!winner) throw new Error('no winner')
      expect(drawn).not.toContain(winner.id)
      drawn.push(winner.id)
      expect(plan.remainingAfter).toBe(pool.length - drawn.length)
      expect(plan.roundComplete).toBe(drawn.length === pool.length)
    }

    expect(new Set(drawn).size).toBe(pool.length)
    const after = planDraw({ candidates: pool, pool: { drawnIds: drawn, excludedIds: [] }, policy: 'no-repeat', request: { type: 'single' }, rng })
    expect(after).toMatchObject({ ok: false, error: { code: 'round-complete' } })
  })

  it('never draws an excluded candidate and still completes the round', () => {
    const rng = createSeededRng(8)
    const pool = candidates(6)
    const excludedIds = ['s2', 's5']
    const drawn: string[] = []
    for (let turn = 0; turn < 4; turn += 1) {
      const plan = expectPlan(
        planDraw({ candidates: pool, pool: { drawnIds: drawn, excludedIds }, policy: 'no-repeat', request: { type: 'single' }, rng }),
      )
      drawn.push(plan.winners[0]?.id ?? '')
    }
    expect([...drawn].sort()).toEqual(['s1', 's3', 's4', 's6'])
  })

  it('starts over once the drawn list is cleared (new round)', () => {
    const pool = candidates(3)
    const plan = expectPlan(
      planDraw({ candidates: pool, pool: emptyPool, policy: 'no-repeat', request: { type: 'single' }, rng: createSeededRng(1) }),
    )
    expect(plan.eligible).toHaveLength(3)
  })
})

describe('planDraw: repeat allowed', () => {
  it('keeps previous winners in the pool', () => {
    const rng = createSeededRng(4)
    const pool = candidates(3)
    const seen: string[] = []
    for (let i = 0; i < 40; i += 1) {
      const plan = expectPlan(
        planDraw({ candidates: pool, pool: { drawnIds: seen, excludedIds: [] }, policy: 'allow-repeat', request: { type: 'single' }, rng }),
      )
      expect(plan.eligible).toHaveLength(3)
      expect(plan.remainingAfter).toBeNull()
      expect(plan.roundComplete).toBe(false)
      seen.push(plan.winners[0]?.id ?? '')
    }
    // 40 draws from 3 candidates must repeat.
    expect(new Set(seen).size).toBeLessThan(seen.length)
  })
})

// ---------------------------------------------------------------------------
// planDraw — multiple
// ---------------------------------------------------------------------------

describe('planDraw: multiple random', () => {
  it('returns distinct winners', () => {
    const plan = expectPlan(
      planDraw({
        candidates: candidates(20),
        pool: emptyPool,
        policy: 'allow-repeat',
        request: { type: 'multiple', count: 5 },
        rng: createSeededRng(6),
      }),
    )
    expect(plan.winners).toHaveLength(5)
    expect(new Set(plan.winners.map((w) => w.id)).size).toBe(5)
    expect(plan.clamped).toBe(false)
  })

  it('clamps to the number of eligible candidates and finishes the round', () => {
    const plan = expectPlan(
      planDraw({
        candidates: candidates(6),
        pool: { drawnIds: ['s1', 's2', 's3', 's4'], excludedIds: [] },
        policy: 'no-repeat',
        request: { type: 'multiple', count: 5 },
        rng: createSeededRng(6),
      }),
    )
    expect(plan.winners.map((w) => w.id).sort()).toEqual(['s5', 's6'])
    expect(plan.clamped).toBe(true)
    expect(plan.picks).toBe(2)
    expect(plan.remainingAfter).toBe(0)
    expect(plan.roundComplete).toBe(true)
  })

  it('rejects a nonsensical count', () => {
    for (const count of [0, -2, 1.5, Number.NaN]) {
      const outcome = planDraw({ candidates: candidates(5), pool: emptyPool, policy: 'no-repeat', request: { type: 'multiple', count } })
      expect(outcome).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    }
  })
})

// ---------------------------------------------------------------------------
// planDraw — team
// ---------------------------------------------------------------------------

describe('planDraw: team random', () => {
  it('puts every active candidate in exactly one team with balanced sizes', () => {
    const pool = candidates(23)
    const plan = expectPlan(
      planDraw({
        candidates: pool,
        // Drawn candidates still join teams; excluded ones do not.
        pool: { drawnIds: ['s1', 's2'], excludedIds: ['s23'] },
        policy: 'no-repeat',
        request: { type: 'team', split: 'count', value: 4 },
        rng: createSeededRng(12),
      }),
    )
    expect(plan.type).toBe('team')
    expect(plan.teams).toHaveLength(4)
    const members = plan.teams.flatMap((team) => team.members.map((m) => m.id))
    expect(members).toHaveLength(22)
    expect(new Set(members).size).toBe(22)
    expect(members).not.toContain('s23')
    const sizes = plan.teams.map((team) => team.members.length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(plan.teams.map((team) => team.name)).toEqual(['ทีม 1', 'ทีม 2', 'ทีม 3', 'ทีม 4'])
    expect(plan.winners).toEqual([])
  })

  it('derives the team count from a target size', () => {
    expect(resolveTeamCount(23, 'size', 5)).toBe(5)
    expect(resolveTeamCount(20, 'size', 5)).toBe(4)
    expect(resolveTeamCount(3, 'size', 10)).toBe(2)
    expect(resolveTeamCount(3, 'count', 8)).toBe(3)
    expect(resolveTeamCount(10, 'count', 1)).toBe(2)
  })

  it('flags a team count that had to be reduced', () => {
    const plan = expectPlan(
      planDraw({ candidates: candidates(3), pool: emptyPool, policy: 'no-repeat', request: { type: 'team', split: 'count', value: 6 } }),
    )
    expect(plan.teams).toHaveLength(3)
    expect(plan.clamped).toBe(true)
  })

  it('needs at least two people', () => {
    const outcome = planDraw({ candidates: candidates(1), pool: emptyPool, policy: 'no-repeat', request: { type: 'team', split: 'count', value: 2 } })
    expect(outcome).toMatchObject({ ok: false, error: { code: 'not-enough' } })
  })

  it('assigns members to teams uniformly', () => {
    const rng = createSeededRng(31)
    const pool = candidates(6)
    const total = 12_000
    const firstTeamCounts = new Map<string, number>()
    for (let i = 0; i < total; i += 1) {
      const teams = makeTeams(pool, 3, rng)
      for (const member of teams[0]?.members ?? []) {
        firstTeamCounts.set(member.id, (firstTeamCounts.get(member.id) ?? 0) + 1)
      }
    }
    // Each of the 6 candidates should land in team 1 a third of the time. 5 dof: p = 0.0001 → 25.7.
    expect(chiSquare([...firstTeamCounts.values()], total * 2)).toBeLessThan(25.7)
  })
})

// ---------------------------------------------------------------------------
// planDraw — mystery cards
// ---------------------------------------------------------------------------

describe('planDraw: mystery cards', () => {
  it('deals distinct eligible candidates face down and decides no winner itself', () => {
    const plan = expectPlan(
      planDraw({
        candidates: candidates(30),
        pool: { drawnIds: ['s1'], excludedIds: ['s2'] },
        policy: 'no-repeat',
        request: { type: 'single' },
        cardSlots: 12,
        rng: createSeededRng(21),
      }),
    )
    expect(plan.cards).toHaveLength(12)
    expect(new Set(plan.cards.map((card) => card.id)).size).toBe(12)
    expect(plan.cards.map((card) => card.id)).not.toContain('s1')
    expect(plan.cards.map((card) => card.id)).not.toContain('s2')
    expect(plan.winners).toEqual([])
    expect(plan.picks).toBe(1)
    expect(plan.remainingAfter).toBe(27)
  })

  it('deals fewer cards when few candidates are left and limits the picks', () => {
    const plan = expectPlan(
      planDraw({
        candidates: candidates(3),
        pool: emptyPool,
        policy: 'no-repeat',
        request: { type: 'multiple', count: 5 },
        cardSlots: 12,
        rng: createSeededRng(21),
      }),
    )
    expect(plan.cards).toHaveLength(3)
    expect(plan.picks).toBe(3)
    expect(plan.clamped).toBe(true)
    expect(plan.roundComplete).toBe(true)
  })

  it('is fair for any card position the student chooses', () => {
    const rng = createSeededRng(55)
    const pool = candidates(10)
    const total = 20_000
    // Always turn over the same card: every candidate must still win equally often.
    const counts = new Map<string, number>()
    for (let i = 0; i < total; i += 1) {
      const plan = expectPlan(
        planDraw({ candidates: pool, pool: emptyPool, policy: 'no-repeat', request: { type: 'single' }, cardSlots: 4, rng }),
      )
      const id = plan.cards[2]?.id ?? ''
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(10)
    expect(chiSquare([...counts.values()], total)).toBeLessThan(33.7)
  })
})

// ---------------------------------------------------------------------------
// Candidate builders
// ---------------------------------------------------------------------------

function student(partial: Partial<Student>): Student {
  return {
    id: 'id',
    schoolId: null,
    classroomId: 'c1',
    studentCode: '',
    number: 1,
    firstName: 'กิตติพงษ์',
    lastName: 'ใจดี',
    nickname: 'กิต',
    avatar: 'emoji:🦊',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('buildStudentCandidates', () => {
  it('orders by roll number and uses the configured name format', () => {
    const roster = [student({ id: 'b', number: 2, nickname: '' }), student({ id: 'a', number: 1 })]
    const byNickname = buildStudentCandidates(roster, 'nickname')
    expect(byNickname.map((c) => c.id)).toEqual(['a', 'b'])
    expect(byNickname[0]).toMatchObject({ label: 'กิต', detail: 'กิตติพงษ์ ใจดี', number: 1, avatar: 'emoji:🦊', studentId: 'a' })
    // No nickname: falls back to the first name.
    expect(byNickname[1]?.label).toBe('กิตติพงษ์')

    const full = buildStudentCandidates(roster, 'full')
    expect(full[0]).toMatchObject({ label: 'กิตติพงษ์ ใจดี', detail: '' })
  })

  it('gives students without an avatar a stable generated one', () => {
    const [candidate] = buildStudentCandidates([student({ id: 'x1', avatar: '' })], 'first')
    expect(candidate?.avatar).toBe('bot:x1')
  })
})

describe('buildNumberCandidates', () => {
  it('builds an inclusive range', () => {
    const range = buildNumberCandidates(3, 7)
    expect(range.map((c) => c.label)).toEqual(['3', '4', '5', '6', '7'])
    expect(range[0]).toMatchObject({ id: 'n:3', number: 3, studentId: null, avatar: null, detail: '' })
  })

  it('accepts a reversed range and caps its size', () => {
    expect(buildNumberCandidates(5, 2).map((c) => c.number)).toEqual([2, 3, 4, 5])
    expect(buildNumberCandidates(1, 100_000)).toHaveLength(500)
  })

  it('links numbers to the students that hold them', () => {
    const range = buildNumberCandidates(1, 3, [student({ id: 'a', number: 2 })], 'nickname')
    expect(range[1]).toMatchObject({ id: 'n:2', label: '2', detail: 'กิต', studentId: 'a', avatar: 'emoji:🦊' })
    expect(range[0]?.studentId).toBeNull()
  })
})

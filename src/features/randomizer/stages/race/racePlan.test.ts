import { describe, expect, it } from 'vitest'

import type { Candidate } from '../../engine/types'
import {
  CHECKPOINTS,
  LANE_LIMIT,
  leaderAt,
  MAX_RACERS,
  pickRacers,
  planRace,
  racerHeight,
  rowPositions,
  standingsAt,
} from './racePlan'

function candidates(count: number): Candidate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    label: `คนที่ ${index}`,
    detail: '',
    number: index,
    avatar: null,
    studentId: `s${index}`,
  }))
}

/** Deterministic pseudo-random numbers for repeatable tests. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

describe('pickRacers', () => {
  it('always puts the winner on the track, with distinct others up to 50 racers', () => {
    const pool = candidates(80)
    for (let seed = 1; seed < 50; seed += 1) {
      const winner = pool[seed % pool.length] as Candidate
      const racers = pickRacers(pool, winner, MAX_RACERS, seeded(seed))
      expect(racers).toHaveLength(MAX_RACERS)
      expect(racers).toContain(winner)
      expect(new Set(racers.map((racer) => racer.id)).size).toBe(MAX_RACERS)
    }
  })

  it('races the whole class when it fits', () => {
    const pool = candidates(42)
    expect(pickRacers(pool, pool[7] as Candidate)).toHaveLength(42)
  })

  it('races everyone when the pool is small', () => {
    const pool = candidates(2)
    expect(
      pickRacers(pool, pool[1] as Candidate)
        .map((racer) => racer.id)
        .sort(),
    ).toEqual(['s0', 's1'])
  })
})

describe('planRace', () => {
  it('lets only the drawn winner cross the line, first', () => {
    const racers = candidates(6)
    for (let seed = 1; seed < 200; seed += 1) {
      const winner = racers[seed % racers.length] as Candidate
      const plan = planRace(racers, winner.id, seeded(seed))
      plan.forEach((points, index) => {
        expect(points).toHaveLength(CHECKPOINTS + 1)
        expect(points[0]).toBe(0)
        // Never moves backwards.
        for (let step = 1; step < points.length; step += 1)
          expect(points[step]).toBeGreaterThanOrEqual(points[step - 1] as number)
        const end = points[CHECKPOINTS] as number
        if (racers[index]?.id === winner.id) expect(end).toBe(1)
        else expect(end).toBeLessThan(0.96)
      })
      expect(racers[leaderAt(plan, CHECKPOINTS)]?.id).toBe(winner.id)
    }
  })

  it('changes the lead during some races, so the result is not obvious from the start', () => {
    const racers = candidates(6)
    let changed = 0
    for (let seed = 1; seed < 100; seed += 1) {
      const plan = planRace(racers, 's0', seeded(seed))
      if (racers[leaderAt(plan, 2)]?.id !== 's0') changed += 1
    }
    expect(changed).toBeGreaterThan(30)
  })
})

describe('track layout', () => {
  it('ranks every racer, winner first at the finish', () => {
    const racers = candidates(50)
    const plan = planRace(racers, 's9', seeded(3))
    const order = standingsAt(plan, CHECKPOINTS)
    expect(order).toHaveLength(50)
    expect(new Set(order).size).toBe(50)
    expect(racers[order[0] as number]?.id).toBe('s9')
  })

  it('gives small fields even lanes and spreads a big field over the track', () => {
    expect(rowPositions(4)).toEqual([0.125, 0.375, 0.625, 0.875])
    const crowd = rowPositions(50, seeded(5))
    expect(crowd).toHaveLength(50)
    for (const y of crowd) {
      expect(y).toBeGreaterThanOrEqual(0.04)
      expect(y).toBeLessThanOrEqual(0.96)
    }
  })

  it('shrinks racers as the field grows, but they stay visible and overlap in a crowd', () => {
    expect(racerHeight(2)).toBeCloseTo(0.24)
    expect(racerHeight(LANE_LIMIT)).toBeLessThan(racerHeight(2))
    expect(racerHeight(50)).toBeGreaterThanOrEqual(0.085)
    // Taller than the gap between neighbours: they overlap.
    expect(racerHeight(50)).toBeGreaterThan(1 / 50)
  })
})

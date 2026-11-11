import { describe, expect, it } from 'vitest'

import { aggregateStudentStats } from './stats'

describe('aggregateStudentStats', () => {
  it('adds stars of every draw, counts picks without team splits and keeps the latest pick', () => {
    const stats = aggregateStudentStats([
      { studentId: 'a', points: 1, drawType: 'single', createdAt: '2026-11-10T01:00:00.000Z' },
      { studentId: 'a', points: 2, drawType: 'multiple', createdAt: '2026-11-11T01:00:00.000Z' },
      { studentId: 'a', points: 1, drawType: 'team', createdAt: '2026-11-12T01:00:00.000Z' },
      { studentId: 'b', points: 1, drawType: 'team', createdAt: '2026-11-12T01:00:00.000Z' },
      { studentId: null, points: 5, drawType: 'single', createdAt: '2026-11-12T01:00:00.000Z' },
    ])
    expect(stats).toEqual([
      { studentId: 'a', stars: 4, picks: 2, lastPickedAt: '2026-11-11T01:00:00.000Z' },
      { studentId: 'b', stars: 1, picks: 0, lastPickedAt: null },
    ])
  })
})

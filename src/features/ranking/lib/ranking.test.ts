import { describe, expect, it } from 'vitest'

import type { Student, StudentStat } from '@/data/types'

import { buildRanking, periodStart, rankingToSheet, RANKING_HEADERS } from './ranking'

function student(id: string, number: number, firstName: string, nickname = ''): Student {
  return {
    id,
    schoolId: null,
    classroomId: 'room',
    studentCode: '',
    number,
    firstName,
    lastName: 'ใจดี',
    nickname,
    avatar: '',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }
}

const ROSTER = [
  student('a', 1, 'กานต์', 'กาน'),
  student('b', 2, 'ข้าว'),
  student('c', 3, 'คิน'),
  student('d', 4, 'ดิน'),
  student('e', 5, 'เอ'),
]

function stat(studentId: string, stars: number, picks: number): StudentStat {
  return { studentId, stars, picks, lastPickedAt: picks > 0 ? '2026-11-11T02:00:00.000Z' : null }
}

describe('periodStart', () => {
  // Wednesday 11 Nov 2026, 15:30 local time.
  const now = new Date(2026, 10, 11, 15, 30)

  it('starts today at midnight', () => {
    expect(periodStart('today', now)).toEqual(new Date(2026, 10, 11))
  })

  it('starts the week on Monday', () => {
    expect(periodStart('week', now)).toEqual(new Date(2026, 10, 9))
    // A Sunday belongs to the week that started six days earlier.
    expect(periodStart('week', new Date(2026, 10, 15, 9))).toEqual(new Date(2026, 10, 9))
    expect(periodStart('week', new Date(2026, 10, 16, 9))).toEqual(new Date(2026, 10, 16))
  })

  it('starts the month on the 1st and has no start for "all"', () => {
    expect(periodStart('month', now)).toEqual(new Date(2026, 10, 1))
    expect(periodStart('all', now)).toBeNull()
  })
})

describe('buildRanking', () => {
  const ranking = buildRanking(
    [stat('c', 3, 2), stat('a', 3, 1), stat('b', 1, 1), stat('d', 0, 1), stat('gone', 9, 9)],
    ROSTER,
  )

  it('ranks students with stars, sharing places on ties (1, 1, 3)', () => {
    expect(ranking.leaders.map((entry) => [entry.student.id, entry.rank, entry.stars])).toEqual([
      ['a', 1, 3],
      ['c', 1, 3],
      ['b', 3, 1],
    ])
  })

  it('lists who has not been picked yet and totals the classroom', () => {
    expect(ranking.notPicked.map((item) => item.id)).toEqual(['e'])
    expect(ranking.totalStars).toBe(7)
    expect(ranking.totalPicks).toBe(5)
  })

  it('ignores totals of students who left the roster', () => {
    expect(ranking.everyone.map((entry) => entry.student.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('handles an empty history', () => {
    const empty = buildRanking([], ROSTER)
    expect(empty.leaders).toEqual([])
    expect(empty.notPicked).toHaveLength(ROSTER.length)
  })
})

describe('rankingToSheet', () => {
  it('puts ranked students first and the rest of the roster after them', () => {
    const rows = rankingToSheet(buildRanking([stat('c', 2, 1), stat('d', 0, 2)], ROSTER), 'nickname')
    expect(rows[0]).toEqual([...RANKING_HEADERS])
    expect(rows.slice(1).map((row) => [row[0], row[1], row[3], row[4], row[5]])).toEqual([
      [1, 3, 'คิน', 2, 1],
      ['', 1, 'กาน', 0, 0],
      ['', 2, 'ข้าว', 0, 0],
      ['', 4, 'ดิน', 0, 2],
      ['', 5, 'เอ', 0, 0],
    ])
  })
})

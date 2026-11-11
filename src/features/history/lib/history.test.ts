import { describe, expect, it } from 'vitest'

import type { Classroom, RandomResult, RandomSession, Student } from '@/data/types'

import { groupBySession, REPORT_HEADERS, resultsToReport, toHistoryQuery } from './report'
import { buildActivityFeed, countByDay, countByMode, countDraws, filterSince } from './stats'

let sequence = 0

function result(partial: Partial<RandomResult>): RandomResult {
  sequence += 1
  return {
    id: `r${sequence}`,
    schoolId: null,
    userId: null,
    sessionId: 's1',
    classroomId: 'c1',
    studentId: null,
    displayName: 'มานี มีตา',
    studentNumber: 1,
    avatar: null,
    mode: 'wheel',
    drawType: 'single',
    drawIndex: 1,
    pickIndex: 1,
    teamIndex: null,
    points: 0,
    meta: null,
    createdAt: new Date(2026, 10, 9, 10, 0).toISOString(),
    ...partial,
  }
}

const now = new Date(2026, 10, 9, 15, 0)
const at = (dayOffset: number, hour = 10) => new Date(2026, 10, 9 + dayOffset, hour, 0).toISOString()

describe('countDraws', () => {
  it('counts a multiple or team draw once', () => {
    const results = [
      result({ drawIndex: 1 }),
      result({ drawIndex: 2, pickIndex: 1, drawType: 'multiple' }),
      result({ drawIndex: 2, pickIndex: 2, drawType: 'multiple' }),
      result({ sessionId: 's2', drawIndex: 1 }),
    ]
    expect(countDraws(results)).toBe(3)
    expect(countDraws([])).toBe(0)
  })
})

describe('filterSince', () => {
  it('keeps results at or after the cut-off', () => {
    const results = [result({ createdAt: at(0) }), result({ createdAt: at(-1) })]
    expect(filterSince(results, new Date(2026, 10, 9))).toHaveLength(1)
  })
})

describe('countByDay', () => {
  it('returns one bucket per day, oldest first, ending today', () => {
    const days = countByDay([], 7, now)
    expect(days).toHaveLength(7)
    expect(days[0]?.key).toBe('2026-11-03')
    expect(days[6]?.key).toBe('2026-11-09')
    expect(days.every((day) => day.draws === 0 && day.picks === 0)).toBe(true)
  })

  it('counts draws and picks per local day and ignores older results', () => {
    const results = [
      result({ createdAt: at(0), drawIndex: 1 }),
      result({ createdAt: at(0, 11), drawIndex: 2, drawType: 'multiple', pickIndex: 1 }),
      result({ createdAt: at(0, 11), drawIndex: 2, drawType: 'multiple', pickIndex: 2 }),
      result({ createdAt: at(-1), drawIndex: 3, mode: 'team', drawType: 'team', teamIndex: 0 }),
      result({ createdAt: at(-1), drawIndex: 3, mode: 'team', drawType: 'team', teamIndex: 1 }),
      result({ createdAt: at(-30), drawIndex: 4 }),
    ]
    const days = countByDay(results, 7, now)
    expect(days[6]).toMatchObject({ draws: 2, picks: 3 })
    // A team split is one draw and no individual picks.
    expect(days[5]).toMatchObject({ draws: 1, picks: 0 })
    expect(days.reduce((sum, day) => sum + day.draws, 0)).toBe(3)
  })
})

describe('countByMode', () => {
  it('ranks modes by distinct draws and omits unused ones', () => {
    const results = [
      result({ mode: 'slot', drawIndex: 1 }),
      result({ mode: 'wheel', drawIndex: 2 }),
      result({ mode: 'wheel', drawIndex: 3 }),
      result({ mode: 'gacha', drawIndex: 4, pickIndex: 1 }),
      result({ mode: 'gacha', drawIndex: 4, pickIndex: 2 }),
    ]
    expect(countByMode(results)).toEqual([
      { mode: 'wheel', draws: 2 },
      { mode: 'gacha', draws: 1 },
      { mode: 'slot', draws: 1 },
    ])
  })
})

describe('buildActivityFeed', () => {
  const classroom: Classroom = {
    id: 'c1',
    schoolId: null,
    ownerId: null,
    name: 'ป.5/1',
    gradeLevel: 'ป.5',
    academicYear: '2569',
    color: 'cyan',
    isDemo: false,
    createdAt: at(-3),
    updatedAt: at(-3),
  }
  const student = (id: string, createdAt: string): Student => ({
    id,
    schoolId: null,
    classroomId: 'c1',
    studentCode: '',
    number: 1,
    firstName: 'ก',
    lastName: '',
    nickname: '',
    avatar: '',
    createdAt,
    updatedAt: createdAt,
  })

  it('merges classrooms, grouped student additions and draws, newest first', () => {
    const feed = buildActivityFeed(
      [classroom],
      [student('a', at(-2)), student('b', at(-2, 11)), student('c', at(-1))],
      [
        result({ createdAt: at(0), drawIndex: 1, displayName: 'ชูใจ' }),
        result({ createdAt: at(0, 12), drawIndex: 2, mode: 'team', drawType: 'team', teamIndex: 0 }),
        result({ createdAt: at(0, 12), drawIndex: 2, mode: 'team', drawType: 'team', teamIndex: 1 }),
      ],
    )
    expect(feed.map((item) => item.title)).toEqual([
      'แบ่ง 2 คนเป็น 2 ทีม',
      'สุ่มได้ ชูใจ',
      'เพิ่มนักเรียน 1 คน',
      'เพิ่มนักเรียน 2 คน',
      'สร้างห้อง ป.5/1',
    ])
    expect(feed[0]?.detail).toBe('ป.5/1')
  })

  it('respects the limit', () => {
    const results = Array.from({ length: 20 }, (_unused, index) => result({ drawIndex: index + 1, createdAt: at(0, index) }))
    expect(buildActivityFeed([], [], results, 5)).toHaveLength(5)
  })
})

describe('toHistoryQuery', () => {
  it('maps period presets to an inclusive start of day', () => {
    const base = { classroomId: null, mode: null, search: '' } as const
    expect(toHistoryQuery({ ...base, period: 'today' }, now).from).toBe(new Date(2026, 10, 9).toISOString())
    expect(toHistoryQuery({ ...base, period: '7d' }, now).from).toBe(new Date(2026, 10, 3).toISOString())
    expect(toHistoryQuery({ ...base, period: '30d' }, now).from).toBe(new Date(2026, 9, 11).toISOString())
    expect(toHistoryQuery({ ...base, period: 'all' }, now).from).toBeNull()
  })

  it('passes filters through and trims the search text', () => {
    const query = toHistoryQuery({ period: 'all', classroomId: 'c9', mode: 'slot', search: '  มานี ' }, now)
    expect(query).toMatchObject({ classroomId: 'c9', mode: 'slot', search: 'มานี' })
  })
})

describe('resultsToReport', () => {
  it('writes a header row and one row per result', () => {
    const session: RandomSession = {
      id: 's1',
      schoolId: null,
      userId: null,
      classroomId: 'c1',
      classroomName: 'ป.5/1',
      source: 'students',
      rules: { repeatPolicy: 'no-repeat' },
      startedAt: at(0),
      endedAt: null,
    }
    const rows = resultsToReport(
      [
        result({ displayName: 'มานี มีตา', studentNumber: 7, points: 2 }),
        result({ meta: { challenge: 'ร้องเพลง', reward: 'สติกเกอร์', quiz: 'correct', streak: 3 } }),
        result({ mode: 'team', drawType: 'team', teamIndex: 1, meta: { teamName: 'ทีม 2' }, sessionId: 'gone' }),
      ],
      new Map([[session.id, session]]),
    )
    expect(rows[0]).toEqual([...REPORT_HEADERS])
    expect(rows[1]?.slice(2)).toEqual(['ป.5/1', 'Lucky Wheel', 'ทีละคน', 'มานี มีตา', 7, '', 1, 2, '', '', '', ''])
    expect(rows[2]?.slice(10)).toEqual(['ร้องเพลง', 'สติกเกอร์', 'ตอบถูก', 3])
    // A missing session leaves the classroom blank instead of failing.
    expect(rows[3]?.slice(2, 5)).toEqual(['', 'Team Random', 'แบ่งทีม'])
    expect(rows[3]?.[7]).toBe('ทีม 2')
  })
})

describe('groupBySession', () => {
  it('groups by round with the newest round first and counts distinct draws', () => {
    const groups = groupBySession([
      result({ sessionId: 'new', createdAt: at(0, 12), drawIndex: 2, pickIndex: 1 }),
      result({ sessionId: 'new', createdAt: at(0, 12), drawIndex: 2, pickIndex: 2 }),
      result({ sessionId: 'new', createdAt: at(0, 11), drawIndex: 1 }),
      result({ sessionId: 'old', createdAt: at(-2), drawIndex: 1 }),
    ])
    expect(groups.map((group) => group.sessionId)).toEqual(['new', 'old'])
    expect(groups[0]).toMatchObject({ draws: 2, latestAt: at(0, 12) })
    expect(groups[0]?.results).toHaveLength(3)
  })
})

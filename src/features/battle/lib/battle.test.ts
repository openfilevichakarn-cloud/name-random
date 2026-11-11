import { describe, expect, it } from 'vitest'

import { createSeededRng } from '@/features/randomizer/engine/rng'
import type { Candidate, Team } from '@/features/randomizer/engine/types'

import {
  changeScore,
  createBattle,
  describeOutcome,
  finishBattle,
  leaders,
  MAX_LOG,
  pickMember,
  pickTeam,
  restartBattle,
  sanitizeBattle,
  SCORE_LIMITS,
  standings,
  undoLast,
  winningMembers,
  type Battle,
} from './battle'

function member(id: string, studentId: string | null = id): Candidate {
  return { id, label: `นักเรียน ${id}`, detail: '', number: null, avatar: 'bot:1', studentId }
}

const TEAMS: Team[] = [
  { index: 0, name: 'ทีม 1', members: [member('a'), member('b')] },
  { index: 1, name: 'ทีม 2', members: [member('c'), member('n:4', null)] },
  { index: 2, name: 'ทีม 3', members: [member('e')] },
]

function battle(): Battle {
  return createBattle({
    teams: TEAMS,
    title: 'ป.5/1',
    classroomId: 'room',
    resultIds: new Map([
      ['a', 'r-a'],
      ['c', 'r-c'],
      ['n:4', 'r-n4'],
    ]),
    now: new Date('2026-11-11T03:00:00.000Z'),
  })
}

describe('createBattle', () => {
  it('copies the teams with zero scores and links members to their history rows', () => {
    const created = battle()
    expect(created.teams.map((team) => team.score)).toEqual([0, 0, 0])
    expect(created.teams[0]?.members[0]).toMatchObject({ id: 'a', resultId: 'r-a', studentId: 'a' })
    expect(created.teams[0]?.members[1]?.resultId).toBeNull()
    expect(created.finishedAt).toBeNull()
    expect(created.startedAt).toBe('2026-11-11T03:00:00.000Z')
  })
})

describe('scores', () => {
  it('adds points, logs them and undoes the last change', () => {
    let current = changeScore(battle(), 0, 1)
    current = changeScore(current, 2, 2)
    current = changeScore(current, 0, -1)
    expect(current.teams.map((team) => team.score)).toEqual([0, 0, 2])
    expect(current.log).toHaveLength(3)
    current = undoLast(current)
    expect(current.teams.map((team) => team.score)).toEqual([1, 0, 2])
    expect(undoLast(undoLast(undoLast(current))).teams.map((team) => team.score)).toEqual([0, 0, 0])
  })

  it('clamps to the score limits and logs only what was applied', () => {
    let current = changeScore(battle(), 1, 5000)
    expect(current.teams[1]?.score).toBe(SCORE_LIMITS.max)
    expect(changeScore(current, 1, 1)).toBe(current)
    current = undoLast(current)
    expect(current.teams[1]?.score).toBe(0)
    expect(changeScore(battle(), 0, -500).teams[0]?.score).toBe(SCORE_LIMITS.min)
  })

  it('ignores unknown teams, zero and non-finite changes', () => {
    const start = battle()
    expect(changeScore(start, 7, 1)).toBe(start)
    expect(changeScore(start, 0, 0)).toBe(start)
    expect(changeScore(start, 0, Number.NaN)).toBe(start)
  })

  it('keeps a bounded log', () => {
    let current = battle()
    for (let i = 0; i < MAX_LOG + 20; i += 1) current = changeScore(current, i % 2, i % 3 === 0 ? -1 : 1)
    expect(current.log).toHaveLength(MAX_LOG)
  })

  it('freezes the scores once finished, and restarts with the same teams', () => {
    const finished = finishBattle(changeScore(battle(), 0, 3), new Date('2026-11-11T04:00:00.000Z'))
    expect(finished.finishedAt).toBe('2026-11-11T04:00:00.000Z')
    expect(changeScore(finished, 1, 1)).toBe(finished)
    expect(undoLast(finished)).toBe(finished)
    const again = restartBattle(finished)
    expect(again.teams.map((team) => team.score)).toEqual([0, 0, 0])
    expect(again.teams.map((team) => team.name)).toEqual(['ทีม 1', 'ทีม 2', 'ทีม 3'])
    expect(again.finishedAt).toBeNull()
    expect(again.id).not.toBe(finished.id)
  })
})

describe('leaders and standings', () => {
  it('has no leader while every team is level', () => {
    expect(leaders(battle())).toEqual([])
    expect(leaders(changeScore(changeScore(changeScore(battle(), 0, 1), 1, 1), 2, 1))).toEqual([])
  })

  it('reports shared leads', () => {
    const current = changeScore(changeScore(battle(), 0, 2), 2, 2)
    expect(leaders(current)).toEqual([0, 2])
  })

  it('ranks with shared places (1, 1, 3)', () => {
    const current = changeScore(changeScore(battle(), 1, 2), 2, 2)
    expect(standings(current).map(({ index, rank }) => [index, rank])).toEqual([
      [1, 1],
      [2, 1],
      [0, 3],
    ])
  })

  it('gives stars only to winning members who are students with a history row', () => {
    expect(winningMembers(changeScore(battle(), 1, 1)).map((item) => item.id)).toEqual(['c'])
    expect(winningMembers(battle())).toEqual([])
  })
})

describe('random picks', () => {
  it('picks a team and a member from the right ranges', () => {
    const rng = createSeededRng(4)
    const current = battle()
    const seen = new Set<number>()
    for (let i = 0; i < 200; i += 1) seen.add(pickTeam(current, rng) as number)
    expect([...seen].sort()).toEqual([0, 1, 2])
    const team = current.teams[0]
    if (!team) throw new Error('missing team')
    expect(['a', 'b']).toContain(pickMember(team, rng)?.id)
    expect(pickMember({ ...team, members: [] }, rng)).toBeNull()
  })
})

describe('sanitizeBattle', () => {
  it('round-trips a valid battle', () => {
    const current = changeScore(battle(), 0, 2)
    expect(sanitizeBattle(JSON.parse(JSON.stringify(current)))).toEqual(current)
  })

  it('rejects junk and repairs bad fields', () => {
    expect(sanitizeBattle(null)).toBeNull()
    expect(sanitizeBattle({ id: 'x', startedAt: 'nope', teams: [] })).toBeNull()
    const repaired = sanitizeBattle({
      id: 'b1',
      title: 5,
      startedAt: '2026-11-11T03:00:00.000Z',
      teams: [
        { name: 'A', score: 1e9, members: [{ id: 'a', label: 'เอ' }, { nope: true }] },
        { name: 'B', score: 'x', members: [] },
        { name: '', members: [] },
      ],
      log: [
        { team: 0, delta: 1 },
        { team: 9, delta: 1 },
        { team: 1, delta: 0 },
      ],
      finishedAt: 'later',
      starsAwarded: 'yes',
    })
    expect(repaired).not.toBeNull()
    expect(repaired?.teams).toHaveLength(2)
    expect(repaired?.teams[0]).toMatchObject({ score: SCORE_LIMITS.max, members: [{ id: 'a', resultId: null }] })
    expect(repaired?.teams[1]?.score).toBe(0)
    expect(repaired?.log).toEqual([{ team: 0, delta: 1 }])
    expect(repaired?.title).toBe('')
    expect(repaired?.finishedAt).toBeNull()
    expect(repaired?.starsAwarded).toBe(false)
  })
})

describe('describeOutcome', () => {
  it('names the winner, shared winners, or a draw', () => {
    expect(describeOutcome(changeScore(battle(), 1, 1))).toBe('ทีม 2 ชนะ')
    expect(describeOutcome(changeScore(changeScore(battle(), 0, 1), 2, 1))).toBe('ทีม 1 และ ทีม 3 ชนะร่วมกัน')
    expect(describeOutcome(battle())).toBe('เสมอกันทุกทีม')
  })
})

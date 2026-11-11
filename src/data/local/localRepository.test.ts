import { beforeEach, describe, expect, it } from 'vitest'

import { RepositoryError } from '../repository'
import type { ResultInput, StudentInput } from '../types'
import { LocalRepository } from './localRepository'

let counter = 0
let repo: LocalRepository

/** Every test gets its own database, so tests cannot see each other's rows. */
beforeEach(() => {
  counter += 1
  repo = new LocalRepository(`ngsr-test-${counter}`)
})

function studentInput(classroomId: string, number: number, firstName = `นักเรียน${number}`): StudentInput {
  return { classroomId, studentCode: '', number, firstName, lastName: 'ทดสอบ', nickname: '', avatar: 'bot:abc' }
}

function resultInput(sessionId: string, overrides: Partial<ResultInput> = {}): ResultInput {
  return {
    sessionId,
    classroomId: 'c1',
    studentId: null,
    displayName: 'มานี',
    studentNumber: 1,
    avatar: null,
    mode: 'wheel',
    drawType: 'single',
    drawIndex: 1,
    pickIndex: 1,
    teamIndex: null,
    meta: null,
    ...overrides,
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('LocalRepository — classrooms', () => {
  it('creates, lists, updates and deletes', async () => {
    const created = await repo.createClassroom({ name: 'ป.5/1', gradeLevel: 'ป.5', academicYear: '2569', color: 'cyan' })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.isDemo).toBe(false)
    expect(await repo.listClassrooms()).toEqual([created])

    await pause(2)
    const updated = await repo.updateClassroom(created.id, { name: 'ป.5/2' })
    expect(updated.name).toBe('ป.5/2')
    expect(updated.gradeLevel).toBe('ป.5')
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt > created.updatedAt).toBe(true)

    await repo.deleteClassroom(created.id)
    expect(await repo.listClassrooms()).toEqual([])
  })

  it('rejects updates to a missing classroom with a user-facing error', async () => {
    await expect(repo.updateClassroom('missing', { name: 'x' })).rejects.toBeInstanceOf(RepositoryError)
    await expect(repo.updateClassroom('missing', { name: 'x' })).rejects.toMatchObject({ code: 'not-found' })
  })

  it('deletes the students of a deleted classroom but nobody else', async () => {
    const a = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    const b = await repo.createClassroom({ name: 'B', gradeLevel: '', academicYear: '', color: 'pink' })
    await repo.createStudents([studentInput(a.id, 1), studentInput(a.id, 2), studentInput(b.id, 1)])

    await repo.deleteClassroom(a.id)
    const remaining = await repo.listStudents()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.classroomId).toBe(b.id)
  })
})

describe('LocalRepository — students', () => {
  it('bulk-creates, updates and deletes students', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    const created = await repo.createStudents([studentInput(classroom.id, 1, 'มานี'), studentInput(classroom.id, 2, 'ปิติ')])
    expect(created).toHaveLength(2)
    expect(new Set(created.map((s) => s.id)).size).toBe(2)

    const first = created[0]
    if (!first) throw new Error('expected a student')
    const updated = await repo.updateStudent(first.id, { nickname: 'นี', number: 9 })
    expect(updated).toMatchObject({ firstName: 'มานี', nickname: 'นี', number: 9 })

    await repo.deleteStudents([first.id])
    expect((await repo.listStudents()).map((s) => s.firstName)).toEqual(['ปิติ'])
  })

  it('stores Thai text unchanged', async () => {
    const classroom = await repo.createClassroom({ name: 'ห้องเรียน', gradeLevel: '', academicYear: '', color: 'cyan' })
    await repo.createStudents([studentInput(classroom.id, 1, 'ศิริวัฒน์ชัย์')])
    expect((await repo.listStudents())[0]?.firstName).toBe('ศิริวัฒน์ชัย์')
  })

  it('refuses to add students to a classroom that does not exist, and adds none of the batch', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    await expect(
      repo.createStudents([studentInput(classroom.id, 1), studentInput('ghost', 2)]),
    ).rejects.toMatchObject({ code: 'not-found' })
    expect(await repo.listStudents()).toEqual([])
  })
})

describe('LocalRepository — history', () => {
  it('records sessions and results and ends a session once', async () => {
    const session = await repo.createSession({
      classroomId: 'c1',
      classroomName: 'ป.5/1',
      source: 'students',
      rules: { repeatPolicy: 'no-repeat' },
    })
    expect(session.endedAt).toBeNull()

    const [result] = await repo.addResults([resultInput(session.id)])
    expect(result).toMatchObject({ points: 0, sessionId: session.id, displayName: 'มานี' })

    await repo.endSession(session.id)
    const [ended] = await repo.listSessions([session.id])
    expect(ended?.endedAt).not.toBeNull()
    const endedAt = ended?.endedAt
    await pause(2)
    await repo.endSession(session.id)
    expect((await repo.listSessions([session.id]))[0]?.endedAt).toBe(endedAt)

    // Ending an unknown session is a no-op rather than an error.
    await expect(repo.endSession('missing')).resolves.toBeUndefined()
  })

  it('queries newest first with filters, search and paging', async () => {
    const session = await repo.createSession({
      classroomId: 'c1',
      classroomName: 'A',
      source: 'students',
      rules: { repeatPolicy: 'no-repeat' },
    })
    await repo.addResults([resultInput(session.id, { displayName: 'มานี', drawIndex: 1 })])
    await pause(3)
    await repo.addResults([resultInput(session.id, { displayName: 'ปิติ', drawIndex: 2, mode: 'slot' })])
    await pause(3)
    await repo.addResults([
      resultInput(session.id, { displayName: 'ชูใจ', drawIndex: 3, classroomId: 'c2', pickIndex: 1 }),
      resultInput(session.id, { displayName: 'วีระ', drawIndex: 3, classroomId: 'c2', pickIndex: 2 }),
    ])

    const all = await repo.queryResults({})
    expect(all.total).toBe(4)
    expect(all.rows.map((row) => row.displayName)).toEqual(['ชูใจ', 'วีระ', 'ปิติ', 'มานี'])

    expect((await repo.queryResults({ classroomId: 'c2' })).total).toBe(2)
    expect((await repo.queryResults({ mode: 'slot' })).rows.map((r) => r.displayName)).toEqual(['ปิติ'])
    expect((await repo.queryResults({ search: 'มา' })).rows.map((r) => r.displayName)).toEqual(['มานี'])

    const page = await repo.queryResults({ limit: 2, offset: 1 })
    expect(page.total).toBe(4)
    expect(page.rows.map((row) => row.displayName)).toEqual(['วีระ', 'ปิติ'])

    const middle = all.rows[2]
    if (!middle) throw new Error('expected a row')
    const ranged = await repo.queryResults({ from: middle.createdAt, to: all.rows[0]?.createdAt })
    expect(ranged.rows.map((row) => row.displayName)).toEqual(['ปิติ'])
  })

  it('updates points, deletes results and clears history without touching the roster', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    const session = await repo.createSession({
      classroomId: classroom.id,
      classroomName: 'A',
      source: 'students',
      rules: { repeatPolicy: 'allow-repeat' },
    })
    const [first, second] = await repo.addResults([resultInput(session.id), resultInput(session.id, { pickIndex: 2 })])
    if (!first || !second) throw new Error('expected two results')

    expect((await repo.updateResult(first.id, { points: 3 })).points).toBe(3)
    await repo.deleteResults([second.id])
    expect((await repo.queryResults({})).total).toBe(1)

    await repo.clearHistory()
    expect((await repo.queryResults({})).total).toBe(0)
    expect(await repo.listSessions([session.id])).toEqual([])
    expect(await repo.listClassrooms()).toHaveLength(1)
  })

  it('sums stars and picks per student of one classroom for the Class Ranking', async () => {
    const session = await repo.createSession({
      classroomId: 'c1',
      classroomName: 'A',
      source: 'students',
      rules: { repeatPolicy: 'allow-repeat' },
    })
    const [single, , team] = await repo.addResults([
      resultInput(session.id, { studentId: 's1' }),
      resultInput(session.id, { studentId: 's2', drawIndex: 2, drawType: 'multiple' }),
      resultInput(session.id, { studentId: 's1', drawIndex: 3, mode: 'team', drawType: 'team', teamIndex: 0 }),
      resultInput(session.id, { studentId: null, drawIndex: 4 }),
      resultInput(session.id, { studentId: 's3', classroomId: 'c2', drawIndex: 5 }),
    ])
    if (!single || !team) throw new Error('expected results')
    await repo.updateResult(single.id, { points: 2 })
    await repo.updateResult(team.id, { points: 1 })

    const stats = await repo.getStudentStats({ classroomId: 'c1' })
    const byStudent = new Map(stats.map((stat) => [stat.studentId, stat]))
    expect(stats).toHaveLength(2)
    expect(byStudent.get('s1')).toMatchObject({ stars: 3, picks: 1, lastPickedAt: single.createdAt })
    expect(byStudent.get('s2')).toMatchObject({ stars: 0, picks: 1 })

    await pause(5)
    const later = new Date().toISOString()
    expect(await repo.getStudentStats({ classroomId: 'c1', from: later })).toEqual([])
    expect(await repo.getStudentStats({ classroomId: 'c1', to: later })).toHaveLength(2)
    expect(await repo.getStudentStats({ classroomId: 'nowhere' })).toEqual([])
  })
})

describe('LocalRepository — snapshots', () => {
  it('exports everything and imports it into another database', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    await repo.createStudents([studentInput(classroom.id, 1), studentInput(classroom.id, 2)])
    const session = await repo.createSession({
      classroomId: classroom.id,
      classroomName: 'A',
      source: 'students',
      rules: { repeatPolicy: 'no-repeat' },
    })
    await repo.addResults([resultInput(session.id)])

    const snapshot = await repo.exportSnapshot()
    expect(snapshot.classrooms).toHaveLength(1)
    expect(snapshot.students).toHaveLength(2)
    expect(snapshot.sessions).toHaveLength(1)
    expect(snapshot.results).toHaveLength(1)

    const other = new LocalRepository(`ngsr-test-${counter}-copy`)
    const summary = await other.importSnapshot(snapshot)
    expect(summary).toEqual({ classrooms: 1, students: 2, sessions: 1, results: 1 })
    expect(await other.exportSnapshot()).toEqual(snapshot)

    // Importing the same snapshot again upserts instead of duplicating.
    await other.importSnapshot(snapshot)
    expect((await other.listStudents()).length).toBe(2)
  })

  it('strips cloud ownership from imported rows', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    await repo.importSnapshot({
      classrooms: [{ ...classroom, schoolId: 'school-1', ownerId: 'user-1' }],
      students: [],
      sessions: [],
      results: [],
    })
    expect((await repo.listClassrooms())[0]).toMatchObject({ schoolId: null, ownerId: null })
  })

  it('clears every store', async () => {
    const classroom = await repo.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    await repo.createStudents([studentInput(classroom.id, 1)])
    await repo.clearAll()
    expect(await repo.exportSnapshot()).toEqual({ classrooms: [], students: [], sessions: [], results: [] })
  })
})

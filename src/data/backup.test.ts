import { describe, expect, it } from 'vitest'

import { BACKUP_FORMAT, BACKUP_VERSION, createBackup, parseBackup, sanitizeSnapshot } from './backup'
import type { DataSnapshot } from './repository'
import { createDefaultSettings } from './settings'

const C1 = '11111111-1111-4111-8111-111111111111'
const S1 = '22222222-2222-4222-8222-222222222222'
const S2 = '33333333-3333-4333-8333-333333333333'
const SESSION = '44444444-4444-4444-8444-444444444444'
const R1 = '55555555-5555-4555-8555-555555555555'
const AT = '2026-11-09T03:00:00.000Z'

function snapshot(): DataSnapshot {
  return {
    classrooms: [
      {
        id: C1,
        schoolId: null,
        ownerId: null,
        name: 'ป.5/1',
        gradeLevel: 'ป.5',
        academicYear: '2569',
        color: 'cyan',
        isDemo: false,
        createdAt: AT,
        updatedAt: AT,
      },
    ],
    students: [
      {
        id: S1,
        schoolId: null,
        classroomId: C1,
        studentCode: '00123',
        number: 1,
        firstName: 'กิตติพงษ์',
        lastName: 'ใจดี',
        nickname: 'กิต',
        avatar: 'emoji:🦊',
        createdAt: AT,
        updatedAt: AT,
      },
    ],
    sessions: [
      {
        id: SESSION,
        schoolId: null,
        userId: null,
        classroomId: C1,
        classroomName: 'ป.5/1',
        source: 'students',
        rules: { repeatPolicy: 'no-repeat' },
        startedAt: AT,
        endedAt: null,
      },
    ],
    results: [
      {
        id: R1,
        schoolId: null,
        userId: null,
        sessionId: SESSION,
        classroomId: C1,
        studentId: S1,
        displayName: 'กิตติพงษ์ ใจดี',
        studentNumber: 1,
        avatar: 'emoji:🦊',
        mode: 'wheel',
        drawType: 'single',
        drawIndex: 1,
        pickIndex: 1,
        teamIndex: null,
        points: 2,
        meta: null,
        createdAt: AT,
      },
    ],
  }
}

describe('backup round trip', () => {
  it('restores exactly what was exported', () => {
    const settings = createDefaultSettings()
    settings.appearance.accent = 'pink'
    const backup = createBackup(snapshot(), settings, new Date(AT))
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: AT })

    const parsed = parseBackup(JSON.stringify(backup))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.data).toEqual(snapshot())
    expect(parsed.settings?.appearance.accent).toBe('pink')
    expect(parsed.exportedAt).toBe(AT)
  })
})

describe('parseBackup', () => {
  it('rejects text that is not JSON', () => {
    expect(parseBackup('<html>')).toMatchObject({ ok: false })
  })

  it('rejects JSON that is not one of our backups', () => {
    expect(parseBackup('{"classrooms":[]}')).toMatchObject({ ok: false })
    expect(parseBackup('[1,2,3]')).toMatchObject({ ok: false })
    expect(parseBackup('null')).toMatchObject({ ok: false })
  })

  it('rejects backups from a newer version', () => {
    const result = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, data: {} }))
    expect(result).toMatchObject({ ok: false })
  })

  it('accepts a backup without settings', () => {
    const result = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: snapshot() }))
    expect(result).toMatchObject({ ok: true, settings: null, exportedAt: null })
  })
})

describe('sanitizeSnapshot', () => {
  it('returns empty collections for junk input', () => {
    const empty = { classrooms: [], students: [], sessions: [], results: [] }
    expect(sanitizeSnapshot(null)).toEqual(empty)
    expect(sanitizeSnapshot('x')).toEqual(empty)
    expect(sanitizeSnapshot({ classrooms: 'no', students: [1, 'a', null] })).toEqual(empty)
  })

  it('drops rows without a valid identity and rows pointing at missing parents', () => {
    const input = snapshot() as unknown as Record<string, Record<string, unknown>[]>
    input.classrooms?.push({ id: 'not-a-uuid', name: 'x' }, { id: S2, name: '   ' })
    input.students?.push(
      { ...input.students[0], id: S2, classroomId: '99999999-9999-4999-8999-999999999999' }, // orphan
      { ...input.students[0], id: 'bad' },
      { ...input.students[0], id: '66666666-6666-4666-8666-666666666666', firstName: '' },
      { ...input.students[0], id: '77777777-7777-4777-8777-777777777777', number: 0 },
    )
    input.results?.push({ ...input.results[0], id: '88888888-8888-4888-8888-888888888888', sessionId: S2 })

    const clean = sanitizeSnapshot(input)
    expect(clean.classrooms).toHaveLength(1)
    expect(clean.students).toHaveLength(1)
    expect(clean.results).toHaveLength(1)
  })

  it('ignores duplicate ids', () => {
    const input = snapshot()
    const first = input.students[0]
    if (!first) throw new Error('fixture')
    input.students.push({ ...first, firstName: 'ซ้ำ' })
    expect(sanitizeSnapshot(input).students).toHaveLength(1)
  })

  it('coerces fields into their allowed values', () => {
    const input = snapshot() as unknown as {
      classrooms: Record<string, unknown>[]
      students: Record<string, unknown>[]
      results: Record<string, unknown>[]
    }
    Object.assign(input.classrooms[0] ?? {}, { color: 'rainbow', academicYear: 'abc', schoolId: 'x', ownerId: 'y', isDemo: 'yes' })
    Object.assign(input.students[0] ?? {}, {
      avatar: 'https://evil.example/pixel.png',
      studentCode: '<script>',
      nickname: 'ก'.repeat(200),
      createdAt: 'not a date',
    })
    Object.assign(input.results[0] ?? {}, { points: -5, drawIndex: 'x', meta: { teamName: 'ทีม 1', evil: true, streak: 3 } })

    const clean = sanitizeSnapshot(input)
    expect(clean.classrooms[0]).toMatchObject({ color: 'violet', academicYear: '', schoolId: null, ownerId: null, isDemo: false })
    expect(clean.students[0]).toMatchObject({ avatar: '', studentCode: '' })
    expect(clean.students[0]?.nickname).toHaveLength(30)
    expect(Number.isNaN(Date.parse(clean.students[0]?.createdAt ?? ''))).toBe(false)
    expect(clean.results[0]).toMatchObject({ points: 0, drawIndex: 1, meta: { teamName: 'ทีม 1', streak: 3 } })
    expect(clean.results[0]?.meta).not.toHaveProperty('evil')
  })

  it('keeps a session whose classroom is gone, without the dangling link', () => {
    const input = snapshot()
    input.classrooms = []
    input.students = []
    const clean = sanitizeSnapshot(input)
    expect(clean.sessions[0]).toMatchObject({ classroomId: null, classroomName: 'ป.5/1' })
    expect(clean.results[0]).toMatchObject({ classroomId: null, studentId: null, displayName: 'กิตติพงษ์ ใจดี' })
  })
})

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { RepositoryError } from '../repository'
import type { DataSnapshot } from '../repository'
import type { ClassroomRow, Database, ResultRow, StudentRow } from './database.types'
import { escapeLike, PAGE_SIZE, SupabaseRepository } from './supabaseRepository'

const USER = '11111111-1111-4111-8111-111111111111'
const SCHOOL = '22222222-2222-4222-8222-222222222222'
const ROOM = '33333333-3333-4333-8333-333333333333'
const AT = '2026-11-09T03:00:00.000Z'

interface Recorded {
  method: string
  url: URL
  headers: Headers
  body: unknown
}

interface Reply {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

/** A stand-in for the Supabase Data API that records every request and answers from a handler. */
function fakeBackend(handler: (request: Recorded) => Reply | Promise<Reply>) {
  const requests: Recorded[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const raw = init?.body ? String(init.body) : ''
    const request: Recorded = {
      method: init?.method ?? 'GET',
      url,
      headers: new Headers(init?.headers),
      body: raw ? JSON.parse(raw) : undefined,
    }
    requests.push(request)
    const reply = await handler(request)
    const status = reply.status ?? 200
    const empty = status === 204 || reply.body === undefined || request.method === 'HEAD'
    return new Response(empty ? null : JSON.stringify(reply.body), {
      status,
      headers: { 'content-type': 'application/json', ...reply.headers },
    })
  }
  const client = createClient<Database>('http://localhost:54321', 'sb_publishable_test', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const repository = new SupabaseRepository(client, { userId: USER, schoolId: SCHOOL })
  return { requests, repository }
}

function classroomRow(partial: Partial<ClassroomRow> = {}): ClassroomRow {
  return {
    id: ROOM,
    school_id: SCHOOL,
    owner_id: USER,
    name: 'ป.5/1',
    grade_level: 'ป.5',
    academic_year: '2569',
    color: 'cyan',
    is_demo: false,
    created_at: AT,
    updated_at: AT,
    ...partial,
  }
}

function studentRow(partial: Partial<StudentRow> = {}): StudentRow {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    school_id: SCHOOL,
    classroom_id: ROOM,
    student_code: '',
    number: 1,
    first_name: 'มานี',
    last_name: 'มีตา',
    nickname: 'นี',
    avatar: 'emoji:🦊',
    created_at: AT,
    updated_at: AT,
    ...partial,
  }
}

function resultRow(partial: Partial<ResultRow> = {}): ResultRow {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    school_id: SCHOOL,
    user_id: USER,
    session_id: '66666666-6666-4666-8666-666666666666',
    classroom_id: ROOM,
    student_id: null,
    display_name: 'มานี มีตา',
    student_number: 1,
    avatar: null,
    mode: 'wheel',
    draw_type: 'single',
    draw_index: 1,
    pick_index: 1,
    team_index: null,
    points: 0,
    meta: { teamName: 'ทีม 1', unknown: true },
    created_at: AT,
    ...partial,
  }
}

const params = (request: Recorded) => Object.fromEntries(request.url.searchParams.entries())

describe('SupabaseRepository — reads', () => {
  it('lists the teacher’s own classrooms and maps snake_case rows', async () => {
    const { requests, repository } = fakeBackend(() => ({ body: [classroomRow()] }))
    const classrooms = await repository.listClassrooms()

    expect(classrooms).toEqual([
      {
        id: ROOM,
        schoolId: SCHOOL,
        ownerId: USER,
        name: 'ป.5/1',
        gradeLevel: 'ป.5',
        academicYear: '2569',
        color: 'cyan',
        isDemo: false,
        createdAt: AT,
        updatedAt: AT,
      },
    ])
    expect(requests[0]?.url.pathname).toBe('/rest/v1/classrooms')
    expect(params(requests[0] as Recorded)).toMatchObject({ owner_id: `eq.${USER}`, order: 'created_at.asc,id.asc' })
  })

  it('reads past the per-request row cap page by page', async () => {
    const { requests, repository } = fakeBackend((request) => {
      const offset = Number(request.url.searchParams.get('offset') ?? 0)
      const count = offset === 0 ? PAGE_SIZE : 3
      return { body: Array.from({ length: count }, (_unused, i) => classroomRow({ id: `${offset + i}`, name: `ห้อง ${offset + i}` })) }
    })
    const classrooms = await repository.listClassrooms()
    expect(classrooms).toHaveLength(PAGE_SIZE + 3)
    expect(requests.map((request) => request.url.searchParams.get('offset'))).toEqual(['0', String(PAGE_SIZE)])
  })

  it('lists students of the teacher’s classrooms only', async () => {
    const { requests, repository } = fakeBackend((request) =>
      request.url.pathname.endsWith('/classrooms') ? { body: [{ id: ROOM }] } : { body: [studentRow()] },
    )
    const students = await repository.listStudents()
    expect(students[0]).toMatchObject({ firstName: 'มานี', classroomId: ROOM, avatar: 'emoji:🦊' })
    expect(params(requests[0] as Recorded)).toMatchObject({ select: 'id', owner_id: `eq.${USER}` })
    expect(params(requests[1] as Recorded)).toMatchObject({ classroom_id: `in.(${ROOM})` })
  })

  it('queries history with every filter, newest first, and reads the total count', async () => {
    const { requests, repository } = fakeBackend(() => ({
      status: 206,
      body: [resultRow()],
      headers: { 'content-range': '0-0/57' },
    }))
    const page = await repository.queryResults({
      classroomId: ROOM,
      mode: 'wheel',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-10T00:00:00.000Z',
      search: '50%_off',
      limit: 25,
      offset: 50,
    })

    expect(page.total).toBe(57)
    expect(page.rows[0]).toMatchObject({ displayName: 'มานี มีตา', meta: { teamName: 'ทีม 1' } })
    expect(page.rows[0]?.meta).not.toHaveProperty('unknown')
    const request = requests[0] as Recorded
    expect(params(request)).toMatchObject({
      user_id: `eq.${USER}`,
      classroom_id: `eq.${ROOM}`,
      mode: 'eq.wheel',
      created_at: 'lt.2026-11-10T00:00:00.000Z',
      display_name: 'ilike.%50\\%\\_off%',
      order: 'created_at.desc,draw_index.desc,pick_index.asc',
      offset: '50',
      limit: '25',
    })
    expect(request.url.searchParams.getAll('created_at')).toContain('gte.2026-11-01T00:00:00.000Z')
    expect(request.headers.get('prefer')).toContain('count=exact')
  })

  it('counts without fetching rows when the limit is 0', async () => {
    const { requests, repository } = fakeBackend(() => ({ headers: { 'content-range': '*/12' } }))
    expect(await repository.queryResults({ limit: 0 })).toEqual({ rows: [], total: 12 })
    expect(requests[0]?.method).toBe('HEAD')
  })
})

describe('SupabaseRepository — writes', () => {
  it('creates a classroom owned by the signed-in teacher and school', async () => {
    const { requests, repository } = fakeBackend((request) => ({ status: 201, body: { ...classroomRow(), ...(request.body as object) } }))
    const created = await repository.createClassroom({ name: 'ป.6/2', gradeLevel: '', academicYear: '2569', color: 'pink' })

    expect(created).toMatchObject({ name: 'ป.6/2', color: 'pink', ownerId: USER, schoolId: SCHOOL })
    const request = requests[0] as Recorded
    expect(request.method).toBe('POST')
    expect(request.body).toEqual({
      school_id: SCHOOL,
      owner_id: USER,
      name: 'ป.6/2',
      grade_level: '',
      academic_year: '2569',
      color: 'pink',
      is_demo: false,
    })
    expect(request.headers.get('prefer')).toContain('return=representation')
  })

  it('sends only the changed student fields', async () => {
    const { requests, repository } = fakeBackend(() => ({ body: studentRow({ nickname: 'มานี่' }) }))
    await repository.updateStudent('s1', { nickname: 'มานี่' })
    expect(requests[0]?.method).toBe('PATCH')
    expect(requests[0]?.body).toEqual({ nickname: 'มานี่' })
    expect(params(requests[0] as Recorded)).toMatchObject({ id: 'eq.s1' })
  })

  it('replaces a roster through the transactional database function', async () => {
    const { requests, repository } = fakeBackend(() => ({ body: [studentRow({ number: 1 }), studentRow({ id: 'x', number: 2 })] }))
    const students = await repository.replaceStudents(ROOM, [
      { classroomId: ROOM, studentCode: '', number: 1, firstName: 'ก', lastName: '', nickname: '', avatar: '' },
      { classroomId: ROOM, studentCode: 'A2', number: 2, firstName: 'ข', lastName: 'ค', nickname: '', avatar: 'bot:1' },
    ])
    expect(students).toHaveLength(2)
    const request = requests[0] as Recorded
    expect(request.url.pathname).toBe('/rest/v1/rpc/replace_classroom_students')
    expect(request.body).toEqual({
      target_classroom: ROOM,
      new_students: [
        { student_code: '', number: 1, first_name: 'ก', last_name: '', nickname: '', avatar: '' },
        { student_code: 'A2', number: 2, first_name: 'ข', last_name: 'ค', nickname: '', avatar: 'bot:1' },
      ],
    })
  })

  it('reads the Class Ranking totals from the database function', async () => {
    const { requests, repository } = fakeBackend(() => ({
      body: [{ student_id: 's1', stars: 4, picks: 2, last_picked_at: AT }],
    }))
    const stats = await repository.getStudentStats({ classroomId: ROOM, from: AT })
    expect(stats).toEqual([{ studentId: 's1', stars: 4, picks: 2, lastPickedAt: AT }])
    const request = requests[0] as Recorded
    expect(request.url.pathname).toBe('/rest/v1/rpc/classroom_student_stats')
    expect(request.body).toEqual({ target_classroom: ROOM, from_ts: AT, to_ts: null })
  })

  it('records results in pick order with ownership attached', async () => {
    const { requests, repository } = fakeBackend((request) => ({
      status: 201,
      body: (request.body as object[]).map((row, index) => ({ ...resultRow(), ...row, id: `r${index}` })).reverse(),
    }))
    const created = await repository.addResults([
      { sessionId: 's', classroomId: ROOM, studentId: null, displayName: 'ก', studentNumber: 1, avatar: null, mode: 'slot', drawType: 'multiple', drawIndex: 3, pickIndex: 1, teamIndex: null, meta: null },
      { sessionId: 's', classroomId: ROOM, studentId: null, displayName: 'ข', studentNumber: 2, avatar: null, mode: 'slot', drawType: 'multiple', drawIndex: 3, pickIndex: 2, teamIndex: null, meta: null },
    ])
    expect(created.map((result) => result.pickIndex)).toEqual([1, 2])
    expect(requests[0]?.body).toEqual([
      expect.objectContaining({ user_id: USER, school_id: SCHOOL, pick_index: 1, display_name: 'ก' }),
      expect.objectContaining({ user_id: USER, school_id: SCHOOL, pick_index: 2, display_name: 'ข' }),
    ])
  })

  it('ends a round only when it is still open', async () => {
    const { requests, repository } = fakeBackend(() => ({ status: 204 }))
    await repository.endSession('s1')
    expect(params(requests[0] as Recorded)).toMatchObject({ id: 'eq.s1', ended_at: 'is.null' })
  })

  it('splits large deletes into short requests', async () => {
    const { requests, repository } = fakeBackend(() => ({ status: 204 }))
    await repository.deleteStudents(Array.from({ length: 250 }, (_unused, i) => `id-${i}`))
    expect(requests).toHaveLength(3)
    expect(requests.every((request) => request.method === 'DELETE')).toBe(true)
  })

  it('clears only the teacher’s own data', async () => {
    const { requests, repository } = fakeBackend(() => ({ status: 204 }))
    await repository.clearAll()
    expect(requests.map((request) => `${request.method} ${request.url.pathname}?${request.url.searchParams.toString()}`)).toEqual([
      `DELETE /rest/v1/random_sessions?user_id=eq.${USER}`,
      `DELETE /rest/v1/classrooms?owner_id=eq.${USER}`,
    ])
  })

  it('uploads a snapshot with ownership rewritten and dangling links cleared', async () => {
    const { requests, repository } = fakeBackend(() => ({ status: 201 }))
    const snapshot: DataSnapshot = {
      classrooms: [
        { id: ROOM, schoolId: null, ownerId: null, name: 'ป.5/1', gradeLevel: '', academicYear: '', color: 'cyan', isDemo: true, createdAt: AT, updatedAt: AT },
      ],
      students: [
        { id: 'st1', schoolId: null, classroomId: ROOM, studentCode: '', number: 1, firstName: 'ก', lastName: '', nickname: '', avatar: '', createdAt: AT, updatedAt: AT },
        { id: 'orphan', schoolId: null, classroomId: 'gone', studentCode: '', number: 1, firstName: 'x', lastName: '', nickname: '', avatar: '', createdAt: AT, updatedAt: AT },
      ],
      sessions: [
        { id: 'se1', schoolId: null, userId: null, classroomId: 'deleted-room', classroomName: 'ห้องที่ลบแล้ว', source: 'students', rules: { repeatPolicy: 'no-repeat' }, startedAt: AT, endedAt: null },
      ],
      results: [
        { id: 'r1', schoolId: null, userId: null, sessionId: 'se1', classroomId: 'deleted-room', studentId: 'gone-student', displayName: 'ก', studentNumber: 1, avatar: null, mode: 'wheel', drawType: 'single', drawIndex: 1, pickIndex: 1, teamIndex: null, points: 2, meta: null, createdAt: AT },
      ],
    }
    const summary = await repository.importSnapshot(snapshot)
    expect(summary).toEqual({ classrooms: 1, students: 1, sessions: 1, results: 1 })

    const [classrooms, students, sessions, results] = requests
    for (const request of requests) {
      expect(request.method).toBe('POST')
      expect(request.url.searchParams.get('on_conflict')).toBe('id')
      expect(request.headers.get('prefer')).toContain('resolution=merge-duplicates')
    }
    expect(classrooms?.body).toEqual([expect.objectContaining({ id: ROOM, owner_id: USER, school_id: SCHOOL, is_demo: true })])
    expect(students?.body).toEqual([expect.objectContaining({ id: 'st1', school_id: SCHOOL, classroom_id: ROOM })])
    expect(sessions?.body).toEqual([expect.objectContaining({ id: 'se1', user_id: USER, classroom_id: null, classroom_name: 'ห้องที่ลบแล้ว' })])
    expect(results?.body).toEqual([
      expect.objectContaining({ id: 'r1', user_id: USER, classroom_id: null, student_id: null, points: 2, created_at: AT }),
    ])
  })
})

describe('SupabaseRepository — errors', () => {
  it('reports a missing row as not-found', async () => {
    const { repository } = fakeBackend(() => ({
      status: 406,
      body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null },
    }))
    await expect(repository.updateClassroom('x', { name: 'y' })).rejects.toMatchObject({ code: 'not-found' })
  })

  it('explains a duplicate roll number', async () => {
    const { repository } = fakeBackend(() => ({
      status: 409,
      body: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "students_classroom_id_number_key"',
        details: 'Key (classroom_id, number)=(…, 1) already exists.',
        hint: null,
      },
    }))
    const error = await repository
      .createStudents([{ classroomId: ROOM, studentCode: '', number: 1, firstName: 'ก', lastName: '', nickname: '', avatar: '' }])
      .catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(RepositoryError)
    expect(error).toMatchObject({ code: 'conflict', message: 'เลขที่นี้ถูกใช้แล้วในห้องเรียน' })
  })

  it('translates errors raised by the database functions', async () => {
    const { repository } = fakeBackend(() => ({ status: 400, body: { code: 'P0001', message: 'classroom_not_found', details: null, hint: null } }))
    await expect(repository.replaceStudents(ROOM, [])).rejects.toMatchObject({
      message: 'ไม่พบห้องเรียน หรือคุณไม่มีสิทธิ์จัดการห้องนี้',
    })
  })

  it('reports permission errors and network failures', async () => {
    const denied = fakeBackend(() => ({ status: 403, body: { code: '42501', message: 'new row violates row-level security policy', details: null, hint: null } }))
    await expect(denied.repository.createClassroom({ name: 'x', gradeLevel: '', academicYear: '', color: 'cyan' })).rejects.toMatchObject({
      code: 'forbidden',
    })

    // Writes are not retried (reads are, by supabase-js, with back-off), so a failed write surfaces at once.
    const offline = fakeBackend(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(offline.repository.createClassroom({ name: 'x', gradeLevel: '', academicYear: '', color: 'cyan' })).rejects.toMatchObject({
      code: 'unavailable',
    })
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b')
    expect(escapeLike('มานี')).toBe('มานี')
  })
})

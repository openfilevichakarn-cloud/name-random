import type { SupabaseClient } from '@supabase/supabase-js'

import type { DataRepository, DataSnapshot, ImportSummary } from '../repository'
import type {
  Classroom,
  ClassroomInput,
  HistoryPage,
  HistoryQuery,
  ID,
  RandomResult,
  RandomSession,
  ResultInput,
  ResultPatch,
  SessionInput,
  Student,
  StudentInput,
  StudentPatch,
} from '../types'
import type { ClassroomRow, Database, Json, ResultRow, SessionRow, StudentRow } from './database.types'
import {
  fromClassroomInput,
  fromClassroomPatch,
  fromResultInput,
  fromStudentInput,
  fromStudentPatch,
  toClassroom,
  toRepositoryError,
  toResult,
  toSession,
  toStudent,
  type Owner,
} from './mappers'

/** PostgREST returns at most this many rows per request on Supabase (the `max_rows` setting). */
export const PAGE_SIZE = 1000
/** Rows per write request, and ids per `in` filter (keeps URLs short). */
const WRITE_CHUNK = 500
const ID_CHUNK = 100

interface Response<T> {
  data: T | null
  error: unknown
  count?: number | null
}

/**
 * Resolve a supabase-js query or throw a RepositoryError. A successful response always carries data,
 * except for writes without `.select()`, whose callers ignore it.
 */
async function run<T>(
  query: PromiseLike<Response<T>>,
  fallback?: string,
): Promise<{ data: NonNullable<T>; count: number | null }> {
  let response: Response<T>
  try {
    response = await query
  } catch (error) {
    throw toRepositoryError(error, fallback)
  }
  if (response.error) throw toRepositoryError(response.error, fallback)
  return { data: response.data as NonNullable<T>, count: response.count ?? null }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Escape LIKE wildcards so a search for "50%" matches the text literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Cloud persistence on Supabase. Lists are scoped to the signed-in teacher's own data
 * (Row Level Security would also let school admins read colleagues' rows).
 */
export class SupabaseRepository implements DataRepository {
  readonly kind = 'cloud' as const
  private readonly client: SupabaseClient<Database>
  private readonly owner: Owner

  constructor(client: SupabaseClient<Database>, owner: Owner) {
    this.client = client
    this.owner = owner
  }

  /** Read every page of a query (PostgREST caps each response). */
  private async fetchAll<T>(page: (from: number, to: number) => PromiseLike<Response<T[]>>): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data } = await run(page(from, from + PAGE_SIZE - 1), 'โหลดข้อมูลจากคลาวด์ไม่สำเร็จ')
      rows.push(...data)
      if (data.length < PAGE_SIZE) return rows
    }
  }

  private async ownClassroomIds(): Promise<string[]> {
    const rows = await this.fetchAll<{ id: string }>((from, to) =>
      this.client.from('classrooms').select('id').eq('owner_id', this.owner.userId).order('id').range(from, to),
    )
    return rows.map((row) => row.id)
  }

  // ---------------------------------------------------------------------------
  // Classrooms
  // ---------------------------------------------------------------------------

  async listClassrooms(): Promise<Classroom[]> {
    const rows = await this.fetchAll<ClassroomRow>((from, to) =>
      this.client
        .from('classrooms')
        .select('*')
        .eq('owner_id', this.owner.userId)
        .order('created_at')
        .order('id')
        .range(from, to),
    )
    return rows.map(toClassroom)
  }

  async createClassroom(input: ClassroomInput): Promise<Classroom> {
    const { data } = await run(
      this.client.from('classrooms').insert(fromClassroomInput(input, this.owner)).select().single(),
      'สร้างห้องเรียนไม่สำเร็จ',
    )
    return toClassroom(data)
  }

  async updateClassroom(id: ID, patch: Partial<ClassroomInput>): Promise<Classroom> {
    const { data } = await run(
      this.client.from('classrooms').update(fromClassroomPatch(patch)).eq('id', id).select().single(),
      'บันทึกห้องเรียนไม่สำเร็จ',
    )
    return toClassroom(data)
  }

  async deleteClassroom(id: ID): Promise<void> {
    // Students go with it (ON DELETE CASCADE); history keeps its snapshots.
    await run(this.client.from('classrooms').delete().eq('id', id), 'ลบห้องเรียนไม่สำเร็จ')
  }

  // ---------------------------------------------------------------------------
  // Students
  // ---------------------------------------------------------------------------

  async listStudents(): Promise<Student[]> {
    const classroomIds = await this.ownClassroomIds()
    const students: Student[] = []
    for (const ids of chunk(classroomIds, ID_CHUNK)) {
      const rows = await this.fetchAll<StudentRow>((from, to) =>
        this.client.from('students').select('*').in('classroom_id', ids).order('id').range(from, to),
      )
      students.push(...rows.map(toStudent))
    }
    return students
  }

  async createStudents(inputs: StudentInput[]): Promise<Student[]> {
    const created: Student[] = []
    for (const part of chunk(inputs, WRITE_CHUNK)) {
      const { data } = await run(
        this.client
          .from('students')
          .insert(part.map((input) => fromStudentInput(input, this.owner)))
          .select(),
        'เพิ่มนักเรียนไม่สำเร็จ',
      )
      created.push(...data.map(toStudent))
    }
    return created
  }

  async updateStudent(id: ID, patch: StudentPatch): Promise<Student> {
    const { data } = await run(
      this.client.from('students').update(fromStudentPatch(patch)).eq('id', id).select().single(),
      'บันทึกข้อมูลนักเรียนไม่สำเร็จ',
    )
    return toStudent(data)
  }

  async deleteStudents(ids: ID[]): Promise<void> {
    for (const part of chunk(ids, ID_CHUNK)) {
      await run(this.client.from('students').delete().in('id', part), 'ลบนักเรียนไม่สำเร็จ')
    }
  }

  async replaceStudents(classroomId: ID, inputs: StudentInput[]): Promise<Student[]> {
    // One database transaction: if any row is rejected the previous roster stays untouched.
    const payload = inputs.map((input) => {
      const row = fromStudentInput(input, this.owner)
      return {
        student_code: row.student_code,
        number: row.number,
        first_name: row.first_name,
        last_name: row.last_name,
        nickname: row.nickname,
        avatar: row.avatar,
      }
    })
    const { data } = await run(
      this.client.rpc('replace_classroom_students', { target_classroom: classroomId, new_students: payload as Json }),
      'นำเข้ารายชื่อไม่สำเร็จ',
    )
    return (data ?? []).map(toStudent)
  }

  // ---------------------------------------------------------------------------
  // Random history
  // ---------------------------------------------------------------------------

  async createSession(input: SessionInput): Promise<RandomSession> {
    const { data } = await run(
      this.client
        .from('random_sessions')
        .insert({
          school_id: this.owner.schoolId,
          user_id: this.owner.userId,
          classroom_id: input.classroomId,
          classroom_name: input.classroomName,
          source: input.source,
          rules: input.rules as unknown as Json,
        })
        .select()
        .single(),
      'บันทึกรอบการสุ่มไม่สำเร็จ',
    )
    return toSession(data)
  }

  async endSession(id: ID): Promise<void> {
    await run(
      this.client.from('random_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id).is('ended_at', null),
    )
  }

  async listSessions(ids: ID[]): Promise<RandomSession[]> {
    const sessions: RandomSession[] = []
    for (const part of chunk([...new Set(ids)], ID_CHUNK)) {
      const { data } = await run(this.client.from('random_sessions').select('*').in('id', part))
      sessions.push(...data.map(toSession))
    }
    return sessions
  }

  async addResults(inputs: ResultInput[]): Promise<RandomResult[]> {
    if (inputs.length === 0) return []
    const { data } = await run(
      this.client
        .from('random_results')
        .insert(inputs.map((input) => fromResultInput(input, this.owner)))
        .select(),
      'บันทึกผลการสุ่มไม่สำเร็จ',
    )
    return data.map(toResult).sort((a, b) => a.pickIndex - b.pickIndex)
  }

  async updateResult(id: ID, patch: ResultPatch): Promise<RandomResult> {
    const row: Database['public']['Tables']['random_results']['Update'] = {}
    if (patch.points !== undefined) row.points = patch.points
    if (patch.meta !== undefined) row.meta = patch.meta as Json | null
    const { data } = await run(this.client.from('random_results').update(row).eq('id', id).select().single())
    return toResult(data)
  }

  async deleteResults(ids: ID[]): Promise<void> {
    for (const part of chunk(ids, ID_CHUNK)) {
      await run(this.client.from('random_results').delete().in('id', part), 'ลบรายการไม่สำเร็จ')
    }
  }

  async queryResults(query: HistoryQuery): Promise<HistoryPage> {
    const limit = Math.max(0, query.limit ?? 100)
    const offset = Math.max(0, query.offset ?? 0)
    const search = query.search?.trim() ?? ''

    const build = (options?: { head?: boolean; count?: 'exact' }) => {
      let builder = this.client.from('random_results').select('*', options).eq('user_id', this.owner.userId)
      if (query.classroomId) builder = builder.eq('classroom_id', query.classroomId)
      if (query.mode) builder = builder.eq('mode', query.mode)
      if (query.from) builder = builder.gte('created_at', query.from)
      if (query.to) builder = builder.lt('created_at', query.to)
      if (search) builder = builder.ilike('display_name', `%${escapeLike(search)}%`)
      return builder
    }

    if (limit === 0) {
      const { count } = await run(build({ head: true, count: 'exact' }), 'โหลดประวัติไม่สำเร็จ')
      return { rows: [], total: count ?? 0 }
    }

    const ordered = (options?: { count: 'exact' }) =>
      build(options)
        .order('created_at', { ascending: false })
        .order('draw_index', { ascending: false })
        .order('pick_index', { ascending: true })

    const rows: RandomResult[] = []
    let total = 0
    for (let from = offset; rows.length < limit; from += PAGE_SIZE) {
      const to = from + Math.min(PAGE_SIZE, limit - rows.length) - 1
      const first = from === offset
      const { data, count } = await run(ordered(first ? { count: 'exact' } : undefined).range(from, to), 'โหลดประวัติไม่สำเร็จ')
      if (first) total = count ?? data.length
      rows.push(...(data as ResultRow[]).map(toResult))
      if (data.length < to - from + 1) break
    }
    return { rows, total }
  }

  async clearHistory(): Promise<void> {
    // Results belong to sessions and go with them (ON DELETE CASCADE).
    await run(this.client.from('random_sessions').delete().eq('user_id', this.owner.userId), 'ล้างประวัติไม่สำเร็จ')
  }

  // ---------------------------------------------------------------------------
  // Bulk
  // ---------------------------------------------------------------------------

  async exportSnapshot(): Promise<DataSnapshot> {
    const [classrooms, students, sessionRows, resultRows] = await Promise.all([
      this.listClassrooms(),
      this.listStudents(),
      this.fetchAll<SessionRow>((from, to) =>
        this.client.from('random_sessions').select('*').eq('user_id', this.owner.userId).order('id').range(from, to),
      ),
      this.fetchAll<ResultRow>((from, to) =>
        this.client.from('random_results').select('*').eq('user_id', this.owner.userId).order('id').range(from, to),
      ),
    ])
    return { classrooms, students, sessions: sessionRows.map(toSession), results: resultRows.map(toResult) }
  }

  /**
   * Upload a snapshot (local data or a backup) into the signed-in account. Rows keep their ids;
   * ownership is rewritten to the current teacher and school. Links to classrooms or students
   * that are not part of the snapshot are cleared, so history never points at someone else's data.
   */
  async importSnapshot(snapshot: DataSnapshot): Promise<ImportSummary> {
    const owner = this.owner
    const classroomIds = new Set(snapshot.classrooms.map((classroom) => classroom.id))
    const studentIds = new Set(snapshot.students.map((student) => student.id))
    const upsert = async <T extends keyof Database['public']['Tables']>(
      table: T,
      rows: Database['public']['Tables'][T]['Insert'][],
    ) => {
      for (const part of chunk(rows, WRITE_CHUNK)) {
        await run(
          this.client.from(table).upsert(part as never, { onConflict: 'id' }),
          'อัปโหลดข้อมูลขึ้นคลาวด์ไม่สำเร็จ',
        )
      }
    }

    await upsert(
      'classrooms',
      snapshot.classrooms.map((classroom) => ({
        ...fromClassroomInput(classroom, owner, classroom.id),
        created_at: classroom.createdAt,
        updated_at: classroom.updatedAt,
      })),
    )
    await upsert(
      'students',
      snapshot.students
        .filter((student) => classroomIds.has(student.classroomId))
        .map((student) => ({
          ...fromStudentInput(student, owner, student.id),
          created_at: student.createdAt,
          updated_at: student.updatedAt,
        })),
    )
    await upsert(
      'random_sessions',
      snapshot.sessions.map((session) => ({
        id: session.id,
        school_id: owner.schoolId,
        user_id: owner.userId,
        classroom_id: session.classroomId && classroomIds.has(session.classroomId) ? session.classroomId : null,
        classroom_name: session.classroomName,
        source: session.source,
        rules: session.rules as unknown as Json,
        started_at: session.startedAt,
        ended_at: session.endedAt,
      })),
    )
    const sessionIds = new Set(snapshot.sessions.map((session) => session.id))
    await upsert(
      'random_results',
      snapshot.results
        .filter((result) => sessionIds.has(result.sessionId))
        .map((result) => ({
          ...fromResultInput(
            {
              ...result,
              classroomId: result.classroomId && classroomIds.has(result.classroomId) ? result.classroomId : null,
              studentId: result.studentId && studentIds.has(result.studentId) ? result.studentId : null,
            },
            owner,
          ),
          id: result.id,
          points: result.points,
          created_at: result.createdAt,
        })),
    )

    return {
      classrooms: snapshot.classrooms.length,
      students: snapshot.students.filter((student) => classroomIds.has(student.classroomId)).length,
      sessions: snapshot.sessions.length,
      results: snapshot.results.filter((result) => sessionIds.has(result.sessionId)).length,
    }
  }

  async clearAll(): Promise<void> {
    await this.clearHistory()
    await run(this.client.from('classrooms').delete().eq('owner_id', this.owner.userId), 'ลบข้อมูลไม่สำเร็จ')
  }
}

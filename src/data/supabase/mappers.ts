import { RepositoryError } from '../repository'
import type {
  Classroom,
  ClassroomInput,
  RandomResult,
  RandomSession,
  ResultInput,
  ResultMeta,
  SessionRules,
  Student,
  StudentInput,
  StudentPatch,
} from '../types'
import type {
  ClassroomRow,
  Database,
  Json,
  ResultRow,
  SessionRow,
  StudentRow,
} from './database.types'

type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

/** Who owns rows written through the cloud repository. */
export interface Owner {
  userId: string
  schoolId: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// -----------------------------------------------------------------------------
// Rows → domain
// -----------------------------------------------------------------------------

export function toClassroom(row: ClassroomRow): Classroom {
  return {
    id: row.id,
    schoolId: row.school_id,
    ownerId: row.owner_id,
    name: row.name,
    gradeLevel: row.grade_level,
    academicYear: row.academic_year,
    color: row.color,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    schoolId: row.school_id,
    classroomId: row.classroom_id,
    studentCode: row.student_code,
    number: row.number,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname,
    avatar: row.avatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRules(value: Json): SessionRules {
  const rules = isObject(value) ? value : {}
  const result: SessionRules = { repeatPolicy: rules.repeatPolicy === 'allow-repeat' ? 'allow-repeat' : 'no-repeat' }
  if (typeof rules.numberMin === 'number' && typeof rules.numberMax === 'number') {
    result.numberMin = rules.numberMin
    result.numberMax = rules.numberMax
  }
  return result
}

export function toSession(row: SessionRow): RandomSession {
  return {
    id: row.id,
    schoolId: row.school_id,
    userId: row.user_id,
    classroomId: row.classroom_id,
    classroomName: row.classroom_name,
    source: row.source,
    rules: toRules(row.rules),
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function toMeta(value: Json | null): ResultMeta | null {
  if (!isObject(value)) return null
  const meta: ResultMeta = {}
  if (typeof value.teamName === 'string') meta.teamName = value.teamName
  if (typeof value.challenge === 'string') meta.challenge = value.challenge
  if (typeof value.reward === 'string') meta.reward = value.reward
  if (typeof value.streak === 'number') meta.streak = value.streak
  if (value.quiz === 'correct' || value.quiz === 'wrong') meta.quiz = value.quiz
  return Object.keys(meta).length > 0 ? meta : null
}

export function toResult(row: ResultRow): RandomResult {
  return {
    id: row.id,
    schoolId: row.school_id,
    userId: row.user_id,
    sessionId: row.session_id,
    classroomId: row.classroom_id,
    studentId: row.student_id,
    displayName: row.display_name,
    studentNumber: row.student_number,
    avatar: row.avatar,
    mode: row.mode,
    drawType: row.draw_type,
    drawIndex: row.draw_index,
    pickIndex: row.pick_index,
    teamIndex: row.team_index,
    points: row.points,
    meta: toMeta(row.meta),
    createdAt: row.created_at,
  }
}

// -----------------------------------------------------------------------------
// Domain → rows
// -----------------------------------------------------------------------------

export function fromClassroomInput(input: ClassroomInput, owner: Owner, id?: string): Insert<'classrooms'> {
  return {
    ...(id ? { id } : {}),
    school_id: owner.schoolId,
    owner_id: owner.userId,
    name: input.name,
    grade_level: input.gradeLevel,
    academic_year: input.academicYear,
    color: input.color,
    is_demo: input.isDemo ?? false,
  }
}

export function fromClassroomPatch(patch: Partial<ClassroomInput>): Update<'classrooms'> {
  const row: Update<'classrooms'> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.gradeLevel !== undefined) row.grade_level = patch.gradeLevel
  if (patch.academicYear !== undefined) row.academic_year = patch.academicYear
  if (patch.color !== undefined) row.color = patch.color
  if (patch.isDemo !== undefined) row.is_demo = patch.isDemo
  return row
}

export function fromStudentInput(input: StudentInput, owner: Owner, id?: string): Insert<'students'> {
  return {
    ...(id ? { id } : {}),
    school_id: owner.schoolId,
    classroom_id: input.classroomId,
    student_code: input.studentCode,
    number: input.number,
    first_name: input.firstName,
    last_name: input.lastName,
    nickname: input.nickname,
    avatar: input.avatar,
  }
}

export function fromStudentPatch(patch: StudentPatch): Update<'students'> {
  const row: Update<'students'> = {}
  if (patch.studentCode !== undefined) row.student_code = patch.studentCode
  if (patch.number !== undefined) row.number = patch.number
  if (patch.firstName !== undefined) row.first_name = patch.firstName
  if (patch.lastName !== undefined) row.last_name = patch.lastName
  if (patch.nickname !== undefined) row.nickname = patch.nickname
  if (patch.avatar !== undefined) row.avatar = patch.avatar
  return row
}

export function fromResultInput(input: ResultInput, owner: Owner): Insert<'random_results'> {
  return {
    school_id: owner.schoolId,
    user_id: owner.userId,
    session_id: input.sessionId,
    classroom_id: input.classroomId,
    student_id: input.studentId,
    display_name: input.displayName,
    student_number: input.studentNumber,
    avatar: input.avatar,
    mode: input.mode,
    draw_type: input.drawType,
    draw_index: input.drawIndex,
    pick_index: input.pickIndex,
    team_index: input.teamIndex,
    meta: (input.meta ?? null) as Json | null,
  }
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

interface ErrorLike {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

/** Translate stable error keys raised by the database functions. */
const FUNCTION_ERRORS: Record<string, string> = {
  not_authenticated: 'กรุณาเข้าสู่ระบบอีกครั้ง',
  already_in_school: 'บัญชีนี้เป็นสมาชิกโรงเรียนอยู่แล้ว',
  join_code_invalid: 'รหัสเข้าร่วมไม่ถูกต้อง หรือถูกเปลี่ยนไปแล้ว',
  school_name_invalid: 'กรุณากรอกชื่อโรงเรียน (ไม่เกิน 100 ตัวอักษร)',
  not_admin: 'เฉพาะเจ้าของหรือผู้ดูแลโรงเรียนเท่านั้น',
  not_owner: 'เฉพาะเจ้าของโรงเรียนเท่านั้น',
  role_invalid: 'บทบาทไม่ถูกต้อง',
  cannot_change_own_role: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้',
  member_not_found: 'ไม่พบสมาชิกคนนี้ในโรงเรียน',
  classroom_not_found: 'ไม่พบห้องเรียน หรือคุณไม่มีสิทธิ์จัดการห้องนี้',
  students_invalid: 'ข้อมูลนักเรียนไม่ถูกต้อง',
}

/** Turn a PostgREST / network error into a RepositoryError with a Thai message. */
export function toRepositoryError(error: unknown, fallback = 'บันทึกข้อมูลบนคลาวด์ไม่สำเร็จ'): RepositoryError {
  if (error instanceof RepositoryError) return error
  const value: ErrorLike = isObject(error) ? (error as ErrorLike) : {}
  const message = value.message ?? (error instanceof Error ? error.message : '')
  const known = FUNCTION_ERRORS[message.trim()]
  if (known) return new RepositoryError(value.code === '42501' ? 'forbidden' : 'conflict', known, { cause: error })

  switch (value.code) {
    case '23505':
      if (/number/.test(`${value.message} ${value.details ?? ''}`)) {
        return new RepositoryError('conflict', 'เลขที่นี้ถูกใช้แล้วในห้องเรียน', { cause: error })
      }
      if (/code/.test(`${value.message} ${value.details ?? ''}`)) {
        return new RepositoryError('conflict', 'รหัสนักเรียนนี้มีอยู่ในห้องแล้ว', { cause: error })
      }
      return new RepositoryError('conflict', 'มีข้อมูลนี้อยู่แล้ว', { cause: error })
    case '42501':
      return new RepositoryError('forbidden', 'คุณไม่มีสิทธิ์ทำรายการนี้', { cause: error })
    case 'PGRST116':
      return new RepositoryError('not-found', 'ไม่พบข้อมูล อาจถูกลบไปแล้ว', { cause: error })
    case 'PGRST301':
    case 'PGRST303':
      return new RepositoryError('forbidden', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', { cause: error })
    case '23503':
      return new RepositoryError('not-found', 'ข้อมูลที่อ้างถึงไม่มีอยู่แล้ว', { cause: error })
    case '23514':
    case '22P02':
      return new RepositoryError('conflict', 'ข้อมูลไม่ถูกต้องตามรูปแบบ', { cause: error })
  }
  // supabase-js reports network failures as a TypeError("Failed to fetch") inside the error message.
  if (/fetch|network|Load failed/i.test(message)) {
    return new RepositoryError('unavailable', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', { cause: error })
  }
  return new RepositoryError('unknown', fallback, { cause: error })
}

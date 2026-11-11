/**
 * Domain model. Field names are camelCase here and snake_case in PostgreSQL;
 * `data/supabase/mappers.ts` converts between the two.
 */

export type ID = string
/** ISO-8601 timestamp, always UTC (`Date.prototype.toISOString`). */
export type ISODateTime = string

// ---------------------------------------------------------------------------
// Randomizer vocabulary
// ---------------------------------------------------------------------------

export const RANDOM_MODES = ['wheel', 'slot', 'card', 'countdown', 'gacha'] as const
/** The five Randomizer Studio game modes. */
export type RandomMode = (typeof RANDOM_MODES)[number]
/** How a result was produced. `team` results come from the group maker, not from a game mode. */
export type ResultMode = RandomMode | 'team'

/** What the pool is made of: the classroom roster, or a plain range of numbers. */
export type DrawSource = 'students' | 'numbers'
/** One winner, k distinct winners, or a full split into teams. */
export type DrawType = 'single' | 'multiple' | 'team'
export type RepeatPolicy = 'no-repeat' | 'allow-repeat'

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export type UserRole = 'owner' | 'admin' | 'teacher'

export interface School {
  id: ID
  name: string
  /** Invite code teachers use to join the school. Only visible to owner/admin. */
  joinCode: string | null
  createdAt: ISODateTime
}

export interface UserProfile {
  id: ID
  schoolId: ID | null
  displayName: string
  role: UserRole
  createdAt: ISODateTime
}

// ---------------------------------------------------------------------------
// Classrooms & students
// ---------------------------------------------------------------------------

export const CLASSROOM_COLORS = ['violet', 'cyan', 'pink', 'lime', 'gold'] as const
export type ClassroomColor = (typeof CLASSROOM_COLORS)[number]

export interface Classroom {
  id: ID
  schoolId: ID | null
  ownerId: ID | null
  name: string
  gradeLevel: string
  academicYear: string
  color: ClassroomColor
  /** Sample data created by "ลองด้วยข้อมูลตัวอย่าง" — always labelled as such in the UI. */
  isDemo: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface ClassroomInput {
  name: string
  gradeLevel: string
  academicYear: string
  color: ClassroomColor
  isDemo?: boolean
}

export interface Student {
  id: ID
  schoolId: ID | null
  classroomId: ID
  /** รหัสนักเรียน — empty string when unknown. */
  studentCode: string
  /** เลขที่ — positive integer, unique inside a classroom. */
  number: number
  firstName: string
  lastName: string
  nickname: string
  /** Encoded avatar, e.g. `bot:3f9a` or `emoji:🦊`. Empty string = generate from the student id. */
  avatar: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface StudentInput {
  classroomId: ID
  studentCode: string
  number: number
  firstName: string
  lastName: string
  nickname: string
  avatar: string
}

export type StudentPatch = Partial<Omit<StudentInput, 'classroomId'>>

// ---------------------------------------------------------------------------
// Random history
// ---------------------------------------------------------------------------

/** Rules in force when a round started (kept with the round for the record). */
export interface SessionRules {
  repeatPolicy: RepeatPolicy
  numberMin?: number
  numberMax?: number
}

/** A round ("รอบ"): consecutive draws on one pool until the teacher starts a new round. */
export interface RandomSession {
  id: ID
  schoolId: ID | null
  userId: ID | null
  classroomId: ID | null
  /** Snapshot so history survives classroom rename/delete. */
  classroomName: string
  source: DrawSource
  rules: SessionRules
  startedAt: ISODateTime
  endedAt: ISODateTime | null
}

export interface SessionInput {
  classroomId: ID | null
  classroomName: string
  source: DrawSource
  rules: SessionRules
}

/** How a student answered in Quiz Mode. */
export type QuizOutcome = 'correct' | 'wrong'

/** Optional extras attached to a result by the advanced features. */
export interface ResultMeta {
  teamName?: string
  /** Random Challenge: the mission the student got. */
  challenge?: string
  /** Surprise Reward. */
  reward?: string
  /** Lucky Streak: how many times the student had been picked that day, this pick included (≥ 2). */
  streak?: number
  quiz?: QuizOutcome
}

export interface RandomResult {
  id: ID
  schoolId: ID | null
  userId: ID | null
  sessionId: ID
  classroomId: ID | null
  /** Null for number draws without a matching student, or after the student was deleted. */
  studentId: ID | null
  /** Snapshots taken at draw time. */
  displayName: string
  studentNumber: number | null
  avatar: string | null
  mode: ResultMode
  drawType: DrawType
  /** 1-based index of the draw inside its session; one draw can yield several results. */
  drawIndex: number
  /** 1-based position inside the draw. */
  pickIndex: number
  /** 0-based team index for team draws, otherwise null. */
  teamIndex: number | null
  /** Stars awarded by the teacher (Class Ranking). */
  points: number
  meta: ResultMeta | null
  createdAt: ISODateTime
}

export interface ResultInput {
  sessionId: ID
  classroomId: ID | null
  studentId: ID | null
  displayName: string
  studentNumber: number | null
  avatar: string | null
  mode: ResultMode
  drawType: DrawType
  drawIndex: number
  pickIndex: number
  teamIndex: number | null
  meta: ResultMeta | null
}

export interface ResultPatch {
  points?: number
  meta?: ResultMeta | null
}

export interface HistoryQuery {
  classroomId?: ID | null
  mode?: ResultMode | null
  /** Inclusive lower bound (ISO). */
  from?: ISODateTime | null
  /** Exclusive upper bound (ISO). */
  to?: ISODateTime | null
  /** Case-insensitive match against the displayed name. */
  search?: string
  limit?: number
  offset?: number
}

export interface HistoryPage {
  rows: RandomResult[]
  /** Total number of rows matching the query, ignoring limit/offset. */
  total: number
}

// ---------------------------------------------------------------------------
// Class Ranking
// ---------------------------------------------------------------------------

export interface StatsQuery {
  classroomId: ID
  /** Inclusive lower bound (ISO). */
  from?: ISODateTime | null
  /** Exclusive upper bound (ISO). */
  to?: ISODateTime | null
}

/** One student's totals in a classroom over a period. Students without any result are not listed. */
export interface StudentStat {
  studentId: ID
  /** Stars from every draw, team splits included (Team Battle wins). */
  stars: number
  /** Times picked in single and multiple draws (a team split is not a pick). */
  picks: number
  /** Most recent pick, or null when the student was only in team splits. */
  lastPickedAt: ISODateTime | null
}

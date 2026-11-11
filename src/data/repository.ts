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
  StatsQuery,
  Student,
  StudentInput,
  StudentPatch,
  StudentStat,
} from './types'

/** Everything the app stores, in one portable object (backup file, local → cloud upload). */
export interface DataSnapshot {
  classrooms: Classroom[]
  students: Student[]
  sessions: RandomSession[]
  results: RandomResult[]
}

export interface ImportSummary {
  classrooms: number
  students: number
  sessions: number
  results: number
}

/**
 * Storage boundary. The UI and the stores only ever talk to this interface, so the local
 * (IndexedDB) and cloud (Supabase) implementations are interchangeable.
 *
 * Every method rejects with a `RepositoryError` carrying a message that is safe to show to the user.
 */
export interface DataRepository {
  readonly kind: 'local' | 'cloud'

  // Classrooms
  listClassrooms(): Promise<Classroom[]>
  createClassroom(input: ClassroomInput): Promise<Classroom>
  updateClassroom(id: ID, patch: Partial<ClassroomInput>): Promise<Classroom>
  /** Deletes the classroom and its students. History keeps its snapshots. */
  deleteClassroom(id: ID): Promise<void>

  // Students
  listStudents(): Promise<Student[]>
  createStudents(inputs: StudentInput[]): Promise<Student[]>
  updateStudent(id: ID, patch: StudentPatch): Promise<Student>
  deleteStudents(ids: ID[]): Promise<void>
  /** Swap a classroom's whole roster atomically: on failure the previous roster is untouched. */
  replaceStudents(classroomId: ID, inputs: StudentInput[]): Promise<Student[]>

  // Random history
  createSession(input: SessionInput): Promise<RandomSession>
  endSession(id: ID): Promise<void>
  listSessions(ids: ID[]): Promise<RandomSession[]>
  addResults(inputs: ResultInput[]): Promise<RandomResult[]>
  updateResult(id: ID, patch: ResultPatch): Promise<RandomResult>
  deleteResults(ids: ID[]): Promise<void>
  /** Newest first. */
  queryResults(query: HistoryQuery): Promise<HistoryPage>
  /** Remove every session and result the current user owns. */
  clearHistory(): Promise<void>
  /** Class Ranking: stars and picks per student of a classroom (own draws only). */
  getStudentStats(query: StatsQuery): Promise<StudentStat[]>

  // Bulk
  exportSnapshot(): Promise<DataSnapshot>
  /** Upsert by id. Rows keep their ids and timestamps; ownership is rewritten to the current user. */
  importSnapshot(snapshot: DataSnapshot): Promise<ImportSummary>
  /** Remove all classrooms, students and history the current user owns. */
  clearAll(): Promise<void>
}

export type RepositoryErrorCode = 'not-found' | 'unavailable' | 'forbidden' | 'conflict' | 'unknown'

/** Error with a user-facing Thai message. */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
    this.code = code
  }
}

/** Turn anything thrown into a message that can be shown in a toast. */
export function describeError(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'): string {
  if (error instanceof RepositoryError) return error.message
  if (error instanceof Error && error.message) return `${fallback} (${error.message})`
  return fallback
}

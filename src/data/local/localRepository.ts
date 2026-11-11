import { createId } from '@/lib/id'

import {
  RepositoryError,
  type DataRepository,
  type DataSnapshot,
  type ImportSummary,
} from '../repository'
import { aggregateStudentStats } from '../stats'
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
} from '../types'
import { DB_NAME, openDatabase, promisify, STORES, transactionDone, type StoreName } from './idb'

const DEFAULT_PAGE_SIZE = 100

function nowIso(): string {
  return new Date().toISOString()
}

function notFound(what: string): RepositoryError {
  return new RepositoryError('not-found', `ไม่พบ${what} อาจถูกลบไปแล้ว`)
}

/** Browser-local persistence on IndexedDB. Works offline and needs no account. */
export class LocalRepository implements DataRepository {
  readonly kind = 'local' as const
  private readonly dbName: string
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(dbName: string = DB_NAME) {
    this.dbName = dbName
  }

  private database(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase(this.dbName).catch((error: unknown) => {
        this.dbPromise = null
        throw error
      })
    }
    return this.dbPromise
  }

  /** Run `work` inside one transaction and resolve with its value once the transaction has committed. */
  private async transact<T>(
    stores: StoreName[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    const db = await this.database()
    let tx: IDBTransaction
    try {
      tx = db.transaction(stores, mode)
    } catch (error) {
      // The connection was closed (e.g. by a version change in another tab) — reopen on the next call.
      this.dbPromise = null
      throw new RepositoryError('unavailable', 'การเชื่อมต่อฐานข้อมูลในเครื่องถูกปิด กรุณาลองใหม่', { cause: error })
    }
    const done = transactionDone(tx)
    try {
      const value = await work(tx)
      await done
      return value
    } catch (error) {
      // Keep `done` from surfacing as an unhandled rejection when `work` threw first.
      done.catch(() => undefined)
      try {
        tx.abort()
      } catch {
        // already finished
      }
      if (error instanceof RepositoryError) throw error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new RepositoryError('unavailable', 'พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม กรุณาลบประวัติเก่าแล้วลองใหม่', {
          cause: error,
        })
      }
      throw new RepositoryError('unknown', 'บันทึกข้อมูลในเครื่องไม่สำเร็จ', { cause: error })
    }
  }

  // -------------------------------------------------------------------------
  // Classrooms
  // -------------------------------------------------------------------------

  async listClassrooms(): Promise<Classroom[]> {
    const rows = await this.transact([STORES.classrooms], 'readonly', (tx) =>
      promisify<Classroom[]>(tx.objectStore(STORES.classrooms).getAll()),
    )
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createClassroom(input: ClassroomInput): Promise<Classroom> {
    const timestamp = nowIso()
    const classroom: Classroom = {
      id: createId(),
      schoolId: null,
      ownerId: null,
      name: input.name,
      gradeLevel: input.gradeLevel,
      academicYear: input.academicYear,
      color: input.color,
      isDemo: input.isDemo ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.transact([STORES.classrooms], 'readwrite', (tx) => {
      tx.objectStore(STORES.classrooms).add(classroom)
    })
    return classroom
  }

  async updateClassroom(id: ID, patch: Partial<ClassroomInput>): Promise<Classroom> {
    return this.transact([STORES.classrooms], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.classrooms)
      const current = await promisify<Classroom | undefined>(store.get(id))
      if (!current) throw notFound('ห้องเรียน')
      const next: Classroom = { ...current, ...patch, isDemo: patch.isDemo ?? current.isDemo, updatedAt: nowIso() }
      store.put(next)
      return next
    })
  }

  async deleteClassroom(id: ID): Promise<void> {
    await this.transact([STORES.classrooms, STORES.students], 'readwrite', async (tx) => {
      tx.objectStore(STORES.classrooms).delete(id)
      const students = tx.objectStore(STORES.students)
      const keys = await promisify(students.index('classroomId').getAllKeys(id))
      for (const key of keys) students.delete(key)
    })
  }

  // -------------------------------------------------------------------------
  // Students
  // -------------------------------------------------------------------------

  async listStudents(): Promise<Student[]> {
    return this.transact([STORES.students], 'readonly', (tx) =>
      promisify<Student[]>(tx.objectStore(STORES.students).getAll()),
    )
  }

  private buildStudents(inputs: StudentInput[]): Student[] {
    const timestamp = nowIso()
    return inputs.map((input) => ({
      id: createId(),
      schoolId: null,
      classroomId: input.classroomId,
      studentCode: input.studentCode,
      number: input.number,
      firstName: input.firstName,
      lastName: input.lastName,
      nickname: input.nickname,
      avatar: input.avatar,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
  }

  async createStudents(inputs: StudentInput[]): Promise<Student[]> {
    if (inputs.length === 0) return []
    const students = this.buildStudents(inputs)
    await this.transact([STORES.classrooms, STORES.students], 'readwrite', async (tx) => {
      const classroomIds = new Set(students.map((student) => student.classroomId))
      for (const classroomId of classroomIds) {
        const exists = await promisify(tx.objectStore(STORES.classrooms).count(classroomId))
        if (exists === 0) throw notFound('ห้องเรียน')
      }
      const store = tx.objectStore(STORES.students)
      for (const student of students) store.add(student)
    })
    return students
  }

  async updateStudent(id: ID, patch: StudentPatch): Promise<Student> {
    return this.transact([STORES.students], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.students)
      const current = await promisify<Student | undefined>(store.get(id))
      if (!current) throw notFound('นักเรียน')
      const next: Student = { ...current, ...patch, updatedAt: nowIso() }
      store.put(next)
      return next
    })
  }

  async replaceStudents(classroomId: ID, inputs: StudentInput[]): Promise<Student[]> {
    const students = this.buildStudents(inputs.map((input) => ({ ...input, classroomId })))
    // One transaction: the old roster is only gone if the new one was written.
    await this.transact([STORES.classrooms, STORES.students], 'readwrite', async (tx) => {
      const exists = await promisify(tx.objectStore(STORES.classrooms).count(classroomId))
      if (exists === 0) throw notFound('ห้องเรียน')
      const store = tx.objectStore(STORES.students)
      const keys = await promisify(store.index('classroomId').getAllKeys(classroomId))
      for (const key of keys) store.delete(key)
      for (const student of students) store.add(student)
    })
    return students
  }

  async deleteStudents(ids: ID[]): Promise<void> {
    if (ids.length === 0) return
    await this.transact([STORES.students], 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.students)
      for (const id of ids) store.delete(id)
    })
  }

  // -------------------------------------------------------------------------
  // Random history
  // -------------------------------------------------------------------------

  async createSession(input: SessionInput): Promise<RandomSession> {
    const session: RandomSession = {
      id: createId(),
      schoolId: null,
      userId: null,
      classroomId: input.classroomId,
      classroomName: input.classroomName,
      source: input.source,
      rules: input.rules,
      startedAt: nowIso(),
      endedAt: null,
    }
    await this.transact([STORES.sessions], 'readwrite', (tx) => {
      tx.objectStore(STORES.sessions).add(session)
    })
    return session
  }

  async endSession(id: ID): Promise<void> {
    await this.transact([STORES.sessions], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.sessions)
      const current = await promisify<RandomSession | undefined>(store.get(id))
      // Ending a session that no longer exists (history was cleared) is not an error.
      if (current && !current.endedAt) store.put({ ...current, endedAt: nowIso() })
    })
  }

  async listSessions(ids: ID[]): Promise<RandomSession[]> {
    if (ids.length === 0) return []
    const rows = await this.transact([STORES.sessions], 'readonly', (tx) => {
      const store = tx.objectStore(STORES.sessions)
      return Promise.all(ids.map((id) => promisify<RandomSession | undefined>(store.get(id))))
    })
    return rows.filter((row): row is RandomSession => row !== undefined)
  }

  async addResults(inputs: ResultInput[]): Promise<RandomResult[]> {
    if (inputs.length === 0) return []
    const timestamp = nowIso()
    const results: RandomResult[] = inputs.map((input) => ({
      id: createId(),
      schoolId: null,
      userId: null,
      sessionId: input.sessionId,
      classroomId: input.classroomId,
      studentId: input.studentId,
      displayName: input.displayName,
      studentNumber: input.studentNumber,
      avatar: input.avatar,
      mode: input.mode,
      drawType: input.drawType,
      drawIndex: input.drawIndex,
      pickIndex: input.pickIndex,
      teamIndex: input.teamIndex,
      points: 0,
      meta: input.meta,
      createdAt: timestamp,
    }))
    await this.transact([STORES.results], 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.results)
      for (const result of results) store.add(result)
    })
    return results
  }

  async updateResult(id: ID, patch: ResultPatch): Promise<RandomResult> {
    return this.transact([STORES.results], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.results)
      const current = await promisify<RandomResult | undefined>(store.get(id))
      if (!current) throw notFound('ผลการสุ่ม')
      const next: RandomResult = { ...current, ...patch }
      store.put(next)
      return next
    })
  }

  async deleteResults(ids: ID[]): Promise<void> {
    if (ids.length === 0) return
    await this.transact([STORES.results], 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.results)
      for (const id of ids) store.delete(id)
    })
  }

  async queryResults(query: HistoryQuery): Promise<HistoryPage> {
    const limit = Math.max(0, query.limit ?? DEFAULT_PAGE_SIZE)
    const offset = Math.max(0, query.offset ?? 0)
    const search = query.search?.trim().toLocaleLowerCase() ?? ''

    let range: IDBKeyRange | null = null
    if (query.from && query.to) range = IDBKeyRange.bound(query.from, query.to, false, true)
    else if (query.from) range = IDBKeyRange.lowerBound(query.from)
    else if (query.to) range = IDBKeyRange.upperBound(query.to, true)

    const matches = (row: RandomResult): boolean => {
      if (query.classroomId && row.classroomId !== query.classroomId) return false
      if (query.mode && row.mode !== query.mode) return false
      if (search && !row.displayName.toLocaleLowerCase().includes(search)) return false
      return true
    }

    const matched = await this.transact([STORES.results], 'readonly', (tx) => {
      const index = tx.objectStore(STORES.results).index('createdAt')
      return new Promise<RandomResult[]>((resolve, reject) => {
        const rows: RandomResult[] = []
        const request = index.openCursor(range, 'prev')
        request.onerror = () => reject(request.error ?? new Error('cursor failed'))
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve(rows)
            return
          }
          const row = cursor.value as RandomResult
          if (matches(row)) rows.push(row)
          cursor.continue()
        }
      })
    })

    // Results of one draw share a timestamp: order them by position so the list reads naturally.
    matched.sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.drawIndex - a.drawIndex || a.pickIndex - b.pickIndex,
    )
    return { rows: matched.slice(offset, offset + limit), total: matched.length }
  }

  async getStudentStats(query: StatsQuery): Promise<StudentStat[]> {
    let range: IDBKeyRange | null = null
    if (query.from && query.to) range = IDBKeyRange.bound(query.from, query.to, false, true)
    else if (query.from) range = IDBKeyRange.lowerBound(query.from)
    else if (query.to) range = IDBKeyRange.upperBound(query.to, true)

    const rows = await this.transact([STORES.results], 'readonly', (tx) => {
      const index = tx.objectStore(STORES.results).index('createdAt')
      return new Promise<RandomResult[]>((resolve, reject) => {
        const matched: RandomResult[] = []
        const request = index.openCursor(range)
        request.onerror = () => reject(request.error ?? new Error('cursor failed'))
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve(matched)
            return
          }
          const row = cursor.value as RandomResult
          if (row.classroomId === query.classroomId && row.studentId) matched.push(row)
          cursor.continue()
        }
      })
    })
    return aggregateStudentStats(rows)
  }

  async clearHistory(): Promise<void> {
    await this.transact([STORES.sessions, STORES.results], 'readwrite', (tx) => {
      tx.objectStore(STORES.sessions).clear()
      tx.objectStore(STORES.results).clear()
    })
  }

  // -------------------------------------------------------------------------
  // Bulk
  // -------------------------------------------------------------------------

  async exportSnapshot(): Promise<DataSnapshot> {
    const stores = [STORES.classrooms, STORES.students, STORES.sessions, STORES.results]
    return this.transact(stores, 'readonly', async (tx) => {
      const [classrooms, students, sessions, results] = await Promise.all([
        promisify<Classroom[]>(tx.objectStore(STORES.classrooms).getAll()),
        promisify<Student[]>(tx.objectStore(STORES.students).getAll()),
        promisify<RandomSession[]>(tx.objectStore(STORES.sessions).getAll()),
        promisify<RandomResult[]>(tx.objectStore(STORES.results).getAll()),
      ])
      return { classrooms, students, sessions, results }
    })
  }

  async importSnapshot(snapshot: DataSnapshot): Promise<ImportSummary> {
    const stores = [STORES.classrooms, STORES.students, STORES.sessions, STORES.results]
    await this.transact(stores, 'readwrite', (tx) => {
      // Local data has no tenant: drop any cloud ownership that came with the snapshot.
      for (const row of snapshot.classrooms) {
        tx.objectStore(STORES.classrooms).put({ ...row, schoolId: null, ownerId: null })
      }
      for (const row of snapshot.students) {
        tx.objectStore(STORES.students).put({ ...row, schoolId: null })
      }
      for (const row of snapshot.sessions) {
        tx.objectStore(STORES.sessions).put({ ...row, schoolId: null, userId: null })
      }
      for (const row of snapshot.results) {
        tx.objectStore(STORES.results).put({ ...row, schoolId: null, userId: null })
      }
    })
    return {
      classrooms: snapshot.classrooms.length,
      students: snapshot.students.length,
      sessions: snapshot.sessions.length,
      results: snapshot.results.length,
    }
  }

  async clearAll(): Promise<void> {
    const stores = [STORES.classrooms, STORES.students, STORES.sessions, STORES.results]
    await this.transact(stores, 'readwrite', (tx) => {
      for (const store of stores) tx.objectStore(store).clear()
    })
  }
}

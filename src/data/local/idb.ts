import { RepositoryError } from '../repository'

export const DB_NAME = 'ngsr'
export const DB_VERSION = 1

export const STORES = {
  classrooms: 'classrooms',
  students: 'students',
  sessions: 'sessions',
  results: 'results',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

/** Wrap an IDBRequest in a promise. */
export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/** Resolve when the transaction commits, reject when it aborts or errors. */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORES.classrooms)) {
    db.createObjectStore(STORES.classrooms, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(STORES.students)) {
    const store = db.createObjectStore(STORES.students, { keyPath: 'id' })
    store.createIndex('classroomId', 'classroomId')
  }
  if (!db.objectStoreNames.contains(STORES.sessions)) {
    const store = db.createObjectStore(STORES.sessions, { keyPath: 'id' })
    store.createIndex('startedAt', 'startedAt')
  }
  if (!db.objectStoreNames.contains(STORES.results)) {
    const store = db.createObjectStore(STORES.results, { keyPath: 'id' })
    store.createIndex('createdAt', 'createdAt')
    store.createIndex('sessionId', 'sessionId')
  }
}

/** Open (and create/upgrade) the app database. */
export function openDatabase(name: string = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new RepositoryError('unavailable', 'เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูลในเครื่อง (IndexedDB)'))
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(name, DB_VERSION)
    } catch (error) {
      reject(new RepositoryError('unavailable', 'ไม่สามารถเปิดฐานข้อมูลในเครื่องได้', { cause: error }))
      return
    }
    request.onupgradeneeded = () => upgrade(request.result)
    request.onsuccess = () => {
      const db = request.result
      // Another tab upgraded the schema: release our handle so it is not blocked.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () =>
      reject(
        new RepositoryError('unavailable', 'ไม่สามารถเปิดฐานข้อมูลในเครื่องได้ (อาจถูกปิดกั้นในโหมดส่วนตัว)', {
          cause: request.error,
        }),
      )
    request.onblocked = () =>
      reject(new RepositoryError('unavailable', 'ฐานข้อมูลถูกใช้งานโดยแท็บอื่น กรุณาปิดแท็บอื่นแล้วลองใหม่'))
  })
}

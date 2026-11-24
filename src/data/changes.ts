import type { DataRepository } from './repository'

type Listener = () => void

const listeners = new Set<Listener>()
/** While > 0, writes are not reported (e.g. while applying data that came from Google Drive). */
let muted = 0

/** Be told after every successful write to the local data. Returns an unsubscribe function. */
export function subscribeDataChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Run `task` without reporting its writes as changes. */
export async function withoutChangeEvents<T>(task: () => Promise<T>): Promise<T> {
  muted += 1
  try {
    return await task()
  } finally {
    muted -= 1
  }
}

function notify(): void {
  if (muted > 0) return
  for (const listener of listeners) listener()
}

const WRITES = [
  'createClassroom',
  'updateClassroom',
  'deleteClassroom',
  'createStudents',
  'updateStudent',
  'deleteStudents',
  'replaceStudents',
  'createSession',
  'endSession',
  'addResults',
  'updateResult',
  'deleteResults',
  'clearHistory',
  'importSnapshot',
  'clearAll',
] as const satisfies readonly (keyof DataRepository)[]

/**
 * Wrap a repository so every successful write is reported to `subscribeDataChanges` listeners.
 * Reads pass straight through.
 */
export function trackChanges<R extends DataRepository>(repository: R): R {
  const writes = new Set<PropertyKey>(WRITES)
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (!writes.has(property) || typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        const result: unknown = await (value as (...parameters: unknown[]) => Promise<unknown>).apply(target, args)
        notify()
        return result
      }
    },
  })
}

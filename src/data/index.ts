import { LocalRepository } from './local/localRepository'
import type { DataRepository } from './repository'

let current: DataRepository = new LocalRepository()

/** The repository the app is currently using (local by default, cloud after sign-in). */
export function getRepository(): DataRepository {
  return current
}

/** Swap the active repository. Callers are responsible for reloading the stores afterwards. */
export function setRepository(repository: DataRepository): void {
  current = repository
}

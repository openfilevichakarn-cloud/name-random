import { trackChanges } from './changes'
import { LocalRepository } from './local/localRepository'
import type { DataRepository } from './repository'

/** The browser's own data, with writes reported to `subscribeDataChanges` (Google Drive sync listens). */
export function createLocalRepository(): DataRepository {
  return trackChanges(new LocalRepository())
}

let current: DataRepository = createLocalRepository()

/** The repository the app is currently using (local by default, cloud after sign-in). */
export function getRepository(): DataRepository {
  return current
}

/** Swap the active repository. Callers are responsible for reloading the stores afterwards. */
export function setRepository(repository: DataRepository): void {
  current = repository
}

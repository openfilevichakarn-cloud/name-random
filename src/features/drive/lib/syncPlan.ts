export type SyncAction = 'upload' | 'download' | 'conflict' | 'none'

export interface SyncState {
  /** The data file in Drive, or null when there is none yet. */
  remote: { version: string; empty: boolean } | null
  /** Drive version this device last downloaded or uploaded; null if it never synced with this file. */
  lastSyncedVersion: string | null
  /** This device changed data since the last sync. */
  localChanged: boolean
  /** This device holds no classrooms, students or history. */
  localEmpty: boolean
}

/**
 * Decide which way data has to move. Nothing is ever overwritten silently: when both sides changed
 * (or both hold data that were never synced together), the teacher chooses.
 */
export function planSync({ remote, lastSyncedVersion, localChanged, localEmpty }: SyncState): SyncAction {
  if (!remote) return 'upload'
  if (lastSyncedVersion === null) {
    if (localEmpty) return 'download'
    if (remote.empty) return 'upload'
    return 'conflict'
  }
  if (remote.version === lastSyncedVersion) return localChanged ? 'upload' : 'none'
  return localChanged ? 'conflict' : 'download'
}

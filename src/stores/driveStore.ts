import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getSafeStorage, STORAGE_PREFIX } from '@/lib/storage'

/**
 * - `off`: not linked on this device
 * - `needs-auth`: linked, but Google has to be asked for access again (after a reload or when access expired)
 * - `pending`: changes waiting to be saved
 */
export type DriveStatus = 'off' | 'needs-auth' | 'connecting' | 'syncing' | 'pending' | 'saved' | 'conflict' | 'error'

export interface DataCounts {
  classrooms: number
  students: number
  results: number
}

export interface DriveConflict {
  /** Null when the Drive file could not be read: only "keep this device" is possible. */
  drive: (DataCounts & { modifiedTime: string }) | null
  device: DataCounts
}

interface DriveState {
  // Remembered on this device
  linked: boolean
  email: string
  fileId: string | null
  fileLink: string | null
  /** Drive version this device last downloaded or uploaded. */
  lastSyncedVersion: string | null
  lastSyncedAt: string | null
  /** Data changed here since the last sync (survives a reload, so nothing waits unnoticed). */
  localChanged: boolean

  // This session only
  status: DriveStatus
  error: string | null
  conflict: DriveConflict | null

  set: (patch: Partial<Omit<DriveState, 'set' | 'reset'>>) => void
  reset: () => void
}

const UNLINKED = {
  linked: false,
  email: '',
  fileId: null,
  fileLink: null,
  lastSyncedVersion: null,
  lastSyncedAt: null,
  localChanged: false,
  status: 'off' as DriveStatus,
  error: null,
  conflict: null,
}

export const useDriveStore = create<DriveState>()(
  persist(
    (set) => ({
      ...UNLINKED,
      set: (patch) => set(patch),
      reset: () => set(UNLINKED),
    }),
    {
      name: `${STORAGE_PREFIX}drive`,
      version: 1,
      storage: createJSONStorage(getSafeStorage),
      partialize: ({ linked, email, fileId, fileLink, lastSyncedVersion, lastSyncedAt, localChanged }) => ({
        linked,
        email,
        fileId,
        fileLink,
        lastSyncedVersion,
        lastSyncedAt,
        localChanged,
      }),
      merge: (persisted, current) => {
        const value = (persisted ?? {}) as Record<string, unknown>
        const text = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : null)
        const linked = value.linked === true
        return {
          ...current,
          linked,
          email: text('email') ?? '',
          fileId: text('fileId'),
          fileLink: text('fileLink'),
          lastSyncedVersion: text('lastSyncedVersion'),
          lastSyncedAt: text('lastSyncedAt'),
          localChanged: value.localChanged === true,
          status: linked ? 'needs-auth' : 'off',
        }
      },
    },
  ),
)

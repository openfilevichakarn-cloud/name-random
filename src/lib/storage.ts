import type { StateStorage } from 'zustand/middleware'

/** In-memory fallback used when localStorage is unavailable (private mode, tests, SSR). */
function createMemoryStorage(): StateStorage {
  const map = new Map<string, string>()
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value)
    },
    removeItem: (name) => {
      map.delete(name)
    },
  }
}

let cached: StateStorage | null = null

/**
 * localStorage that never throws: quota errors and blocked storage degrade to
 * "settings are not remembered" instead of breaking the app.
 */
export function getSafeStorage(): StateStorage {
  if (cached) return cached
  const memory = createMemoryStorage()
  let local: Storage | null = null
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__ngsr_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      local = localStorage
    }
  } catch {
    local = null
  }

  if (!local) {
    cached = memory
    return cached
  }

  const storage = local
  cached = {
    getItem: (name) => {
      try {
        return storage.getItem(name)
      } catch {
        return memory.getItem(name) as string | null
      }
    },
    setItem: (name, value) => {
      try {
        storage.setItem(name, value)
      } catch {
        memory.setItem(name, value)
      }
    },
    removeItem: (name) => {
      try {
        storage.removeItem(name)
      } catch {
        memory.removeItem(name)
      }
    },
  }
  return cached
}

/** Prefix for every key the app writes, so "clear app data" can find them all. */
export const STORAGE_PREFIX = 'ngsr:'

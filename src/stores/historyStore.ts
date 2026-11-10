import { create } from 'zustand'

import { getRepository } from '@/data'
import { describeError } from '@/data/repository'
import type { ID, RandomResult, RandomSession, ResultInput, ResultPatch, SessionInput } from '@/data/types'
import { addDays, startOfDay } from '@/lib/date'

import type { LoadStatus } from './dataStore'

/** How far back the in-memory window reaches, and how many rows it holds at most. */
const RECENT_DAYS = 30
const RECENT_LIMIT = 1000

interface HistoryState {
  status: LoadStatus
  error: string | null
  /** Results of the last 30 days, newest first. Feeds the dashboard and the studio badges. */
  recent: RandomResult[]
  /** Bumped on every change, so views that query the repository directly know when to refetch. */
  revision: number

  load: () => Promise<void>
  reload: () => Promise<void>

  openSession: (input: SessionInput) => Promise<RandomSession>
  closeSession: (id: ID) => Promise<void>
  addResults: (inputs: ResultInput[]) => Promise<RandomResult[]>
  updateResult: (id: ID, patch: ResultPatch) => Promise<RandomResult>
  deleteResults: (ids: ID[]) => Promise<void>
  clear: () => Promise<void>
}

let inflight: Promise<void> | null = null

export const useHistoryStore = create<HistoryState>()((set, get) => {
  const fetchRecent = async () => {
    set({ status: 'loading', error: null })
    try {
      const from = addDays(startOfDay(), -RECENT_DAYS).toISOString()
      const page = await getRepository().queryResults({ from, limit: RECENT_LIMIT })
      set((state) => ({ status: 'ready', recent: page.rows, error: null, revision: state.revision + 1 }))
    } catch (error) {
      set({ status: 'error', error: describeError(error, 'โหลดประวัติไม่สำเร็จ') })
    }
  }

  const bump = () => set((state) => ({ revision: state.revision + 1 }))

  return {
    status: 'idle',
    error: null,
    recent: [],
    revision: 0,

    load: () => {
      if (get().status === 'ready') return Promise.resolve()
      inflight ??= fetchRecent().finally(() => {
        inflight = null
      })
      return inflight
    },

    reload: () => {
      inflight = fetchRecent().finally(() => {
        inflight = null
      })
      return inflight
    },

    openSession: (input) => getRepository().createSession(input),

    closeSession: async (id) => {
      await getRepository().endSession(id)
      bump()
    },

    addResults: async (inputs) => {
      const created = await getRepository().addResults(inputs)
      set((state) => ({
        // Newest first; within one draw keep the reveal order.
        recent: [...created, ...state.recent].slice(0, RECENT_LIMIT),
        revision: state.revision + 1,
      }))
      return created
    },

    updateResult: async (id, patch) => {
      const updated = await getRepository().updateResult(id, patch)
      set((state) => ({
        recent: state.recent.map((row) => (row.id === id ? updated : row)),
        revision: state.revision + 1,
      }))
      return updated
    },

    deleteResults: async (ids) => {
      await getRepository().deleteResults(ids)
      const removed = new Set(ids)
      set((state) => ({
        recent: state.recent.filter((row) => !removed.has(row.id)),
        revision: state.revision + 1,
      }))
    },

    clear: async () => {
      await getRepository().clearHistory()
      set((state) => ({ recent: [], revision: state.revision + 1 }))
    },
  }
})

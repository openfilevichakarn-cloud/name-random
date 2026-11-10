import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { RANDOM_MODES, type DrawSource, type DrawType, type ID, type RandomMode } from '@/data/types'
import { getSafeStorage, STORAGE_PREFIX } from '@/lib/storage'

/** `manual` = taken out before drawing (e.g. absent). `picked` = removed after being drawn. */
export type ExclusionReason = 'manual' | 'picked'

/** Draw bookkeeping for one pool (a classroom roster or a number range). */
export interface PoolRecord {
  /** The open round in the history, or null until the first draw of a round. */
  sessionId: ID | null
  /** Draws made in the current round. */
  drawCount: number
  /** Candidates drawn in the current round, oldest first (tracked while repeats are off). */
  drawnIds: string[]
  excluded: Record<string, ExclusionReason>
}

export const EMPTY_POOL: PoolRecord = Object.freeze({
  sessionId: null,
  drawCount: 0,
  drawnIds: [],
  excluded: {},
}) as PoolRecord

/** Identity of a pool. A different classroom, source or number range is a different round. */
export function poolKey(classroomId: ID | null, source: DrawSource, numberMin: number, numberMax: number): string {
  const owner = classroomId ?? 'none'
  return source === 'students' ? `${owner}|students` : `${owner}|numbers|${numberMin}-${numberMax}`
}

interface StudioState {
  classroomId: ID | null
  mode: RandomMode
  source: DrawSource
  drawType: DrawType
  pools: Record<string, PoolRecord>

  setClassroom: (classroomId: ID | null) => void
  setMode: (mode: RandomMode) => void
  setSource: (source: DrawSource) => void
  setDrawType: (drawType: DrawType) => void

  /** Mark candidates as drawn in the current round. */
  markDrawn: (key: string, ids: readonly string[]) => void
  /** Put a drawn candidate back into the round. */
  restoreDrawn: (key: string, id: string) => void
  /** Exclude candidates (with a reason) or bring them back (`null`). */
  setExclusion: (key: string, ids: readonly string[], reason: ExclusionReason | null) => void
  /** Draw only from `keepIds`: everyone else in `allIds` becomes manually excluded. */
  restrictTo: (key: string, allIds: readonly string[], keepIds: readonly string[]) => void
  /** Count a new draw in the round and return its 1-based index. */
  beginDraw: (key: string) => number
  setSession: (key: string, sessionId: ID | null) => void
  /** Start a new round: everyone drawn returns to the pool. Returns the session that was open. */
  resetRound: (key: string) => ID | null
  /** Drop the bookkeeping of a classroom that no longer exists. */
  forgetClassroom: (classroomId: ID) => void
  clearPools: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizePool(value: unknown): PoolRecord | null {
  if (!isRecord(value)) return null
  const excluded: Record<string, ExclusionReason> = {}
  if (isRecord(value.excluded)) {
    for (const [id, reason] of Object.entries(value.excluded)) {
      if (reason === 'manual' || reason === 'picked') excluded[id] = reason
    }
  }
  return {
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : null,
    drawCount: typeof value.drawCount === 'number' && value.drawCount >= 0 ? Math.floor(value.drawCount) : 0,
    drawnIds: Array.isArray(value.drawnIds) ? value.drawnIds.filter((id): id is string => typeof id === 'string') : [],
    excluded,
  }
}

function sanitizePersisted(value: unknown): Pick<StudioState, 'classroomId' | 'mode' | 'source' | 'drawType' | 'pools'> {
  const input = isRecord(value) ? value : {}
  const pools: Record<string, PoolRecord> = {}
  if (isRecord(input.pools)) {
    for (const [key, pool] of Object.entries(input.pools)) {
      const clean = sanitizePool(pool)
      if (clean) pools[key] = clean
    }
  }
  return {
    classroomId: typeof input.classroomId === 'string' ? input.classroomId : null,
    mode: RANDOM_MODES.includes(input.mode as RandomMode) ? (input.mode as RandomMode) : 'wheel',
    source: input.source === 'numbers' ? 'numbers' : 'students',
    drawType: input.drawType === 'multiple' || input.drawType === 'team' ? input.drawType : 'single',
    pools,
  }
}

/**
 * Studio selections and per-pool round state. Persisted, so an accidental reload in the middle
 * of a lesson does not forget who has already been drawn.
 */
export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => {
      const updatePool = (key: string, update: (pool: PoolRecord) => PoolRecord) => {
        set((state) => ({ pools: { ...state.pools, [key]: update(state.pools[key] ?? EMPTY_POOL) } }))
      }

      return {
        classroomId: null,
        mode: 'wheel',
        source: 'students',
        drawType: 'single',
        pools: {},

        setClassroom: (classroomId) => set({ classroomId }),
        setMode: (mode) => set({ mode }),
        setSource: (source) => set({ source }),
        setDrawType: (drawType) => set({ drawType }),

        markDrawn: (key, ids) =>
          updatePool(key, (pool) => {
            const known = new Set(pool.drawnIds)
            const added = ids.filter((id) => !known.has(id))
            return added.length > 0 ? { ...pool, drawnIds: [...pool.drawnIds, ...added] } : pool
          }),

        restoreDrawn: (key, id) =>
          updatePool(key, (pool) => ({ ...pool, drawnIds: pool.drawnIds.filter((drawn) => drawn !== id) })),

        setExclusion: (key, ids, reason) =>
          updatePool(key, (pool) => {
            const excluded = { ...pool.excluded }
            for (const id of ids) {
              if (reason) excluded[id] = reason
              else delete excluded[id]
            }
            return { ...pool, excluded }
          }),

        restrictTo: (key, allIds, keepIds) =>
          updatePool(key, (pool) => {
            const keep = new Set(keepIds)
            const excluded: Record<string, ExclusionReason> = {}
            for (const id of allIds) {
              if (!keep.has(id)) excluded[id] = 'manual'
            }
            return { ...pool, excluded }
          }),

        beginDraw: (key) => {
          const next = (get().pools[key]?.drawCount ?? 0) + 1
          updatePool(key, (pool) => ({ ...pool, drawCount: next }))
          return next
        },

        setSession: (key, sessionId) => updatePool(key, (pool) => ({ ...pool, sessionId })),

        resetRound: (key) => {
          const previous = get().pools[key]?.sessionId ?? null
          updatePool(key, (pool) => ({ ...pool, sessionId: null, drawCount: 0, drawnIds: [] }))
          return previous
        },

        forgetClassroom: (classroomId) =>
          set((state) => ({
            classroomId: state.classroomId === classroomId ? null : state.classroomId,
            pools: Object.fromEntries(
              Object.entries(state.pools).filter(([key]) => !key.startsWith(`${classroomId}|`)),
            ),
          })),

        clearPools: () => set({ pools: {} }),
      }
    },
    {
      name: `${STORAGE_PREFIX}studio`,
      version: 1,
      storage: createJSONStorage(getSafeStorage),
      partialize: ({ classroomId, mode, source, drawType, pools }) => ({ classroomId, mode, source, drawType, pools }),
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    },
  ),
)

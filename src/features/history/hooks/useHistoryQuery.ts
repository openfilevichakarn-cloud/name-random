import { useEffect, useState } from 'react'

import { getRepository } from '@/data'
import { describeError } from '@/data/repository'
import type { ID, RandomResult, RandomSession } from '@/data/types'
import { useHistoryStore } from '@/stores/historyStore'

import { toHistoryQuery, type HistoryFilters } from '../lib/report'

interface Loaded {
  /** The request these rows answer. */
  key: string
  rows: RandomResult[]
  total: number
  sessions: ReadonlyMap<ID, RandomSession>
  error: string | null
}

const EMPTY_SESSIONS: ReadonlyMap<ID, RandomSession> = new Map()

/**
 * Query the history through the repository. While a new request is in flight the previous
 * rows stay available (`loading` is true), so the list never flashes empty between filters.
 */
export function useHistoryQuery(filters: HistoryFilters, limit: number) {
  // Any change to the history (a new draw, a delete) invalidates the current page.
  const revision = useHistoryStore((state) => state.revision)
  const key = JSON.stringify([filters, limit, revision])
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    const repository = getRepository()
    const load = async () => {
      try {
        const page = await repository.queryResults({ ...toHistoryQuery(filters), limit })
        const sessionIds = [...new Set(page.rows.map((row) => row.sessionId))]
        const sessions = await repository.listSessions(sessionIds)
        if (cancelled) return
        setLoaded({
          key,
          rows: page.rows,
          total: page.total,
          sessions: new Map(sessions.map((session) => [session.id, session])),
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setLoaded((previous) => ({
          key,
          rows: previous?.rows ?? [],
          total: previous?.total ?? 0,
          sessions: previous?.sessions ?? EMPTY_SESSIONS,
          error: describeError(error, 'โหลดประวัติไม่สำเร็จ'),
        }))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // `key` captures filters, limit and revision.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [key])

  return {
    rows: loaded?.rows ?? [],
    total: loaded?.total ?? 0,
    sessions: loaded?.sessions ?? EMPTY_SESSIONS,
    error: loaded?.error ?? null,
    /** Nothing has been loaded yet. */
    initial: loaded === null,
    loading: loaded?.key !== key,
  }
}

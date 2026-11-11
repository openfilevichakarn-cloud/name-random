import { useEffect, useState } from 'react'

import { getRepository } from '@/data'
import { describeError } from '@/data/repository'
import type { ID, StudentStat } from '@/data/types'
import { toDateKey } from '@/lib/date'
import { useHistoryStore } from '@/stores/historyStore'

import { periodStart, type RankingPeriod } from '../lib/ranking'

interface Loaded {
  key: string
  stats: StudentStat[]
  error: string | null
}

const NO_STATS: StudentStat[] = []

/**
 * Per-student totals of a classroom for the ranking. Refetches whenever the history changes
 * (a star given in the studio shows up here right away). Previous totals stay on screen while loading.
 */
export function useStudentStats(classroomId: ID | null, period: RankingPeriod) {
  const revision = useHistoryStore((state) => state.revision)
  // The day is part of the key: "today" must move on at midnight on a screen left open.
  const key = JSON.stringify([classroomId, period, revision, toDateKey(new Date())])
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!classroomId) return
    let cancelled = false
    const from = periodStart(period)
    getRepository()
      .getStudentStats({ classroomId, from: from ? from.toISOString() : null })
      .then((stats) => {
        if (!cancelled) setLoaded({ key, stats, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(error)
        setLoaded((previous) => ({
          key,
          stats: previous?.stats ?? NO_STATS,
          error: describeError(error, 'โหลดอันดับไม่สำเร็จ'),
        }))
      })
    return () => {
      cancelled = true
    }
    // `key` captures the classroom, the period, the history revision and the day.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [key])

  return {
    stats: classroomId ? (loaded?.stats ?? NO_STATS) : NO_STATS,
    error: classroomId ? (loaded?.error ?? null) : null,
    /** Nothing has been loaded for any classroom yet. */
    initial: classroomId !== null && loaded === null,
    loading: classroomId !== null && loaded?.key !== key,
  }
}

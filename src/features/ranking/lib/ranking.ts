import type { NameFormat } from '@/data/settings'
import type { Student, StudentStat } from '@/data/types'
import { compareStudents, getDisplayName, getFullName } from '@/features/students/lib/names'
import { addDays, formatDateTime, startOfDay } from '@/lib/date'
import type { Cell } from '@/lib/spreadsheet'

export const RANKING_PERIODS = ['today', 'week', 'month', 'all'] as const
export type RankingPeriod = (typeof RANKING_PERIODS)[number]

export const RANKING_PERIOD_LABELS: Record<RankingPeriod, string> = {
  today: 'วันนี้',
  week: 'สัปดาห์นี้',
  month: 'เดือนนี้',
  all: 'ทั้งหมด',
}

/** Start of the period in local time; null for "all". Weeks start on Monday, like a school week. */
export function periodStart(period: RankingPeriod, now: Date = new Date()): Date | null {
  const today = startOfDay(now)
  switch (period) {
    case 'today':
      return today
    case 'week':
      // getDay(): Sunday = 0 … Saturday = 6 → days since Monday.
      return addDays(today, -((today.getDay() + 6) % 7))
    case 'month':
      return new Date(today.getFullYear(), today.getMonth(), 1)
    case 'all':
      return null
  }
}

export interface StudentTotals {
  student: Student
  stars: number
  picks: number
  lastPickedAt: string | null
}

export interface RankingEntry extends StudentTotals {
  /** Competition ranking by stars: equal stars share a place and the next place is skipped (1, 1, 3). */
  rank: number
}

export interface Ranking {
  /** Students with at least one star, most stars first. */
  leaders: RankingEntry[]
  /** Every student of the roster with their totals, in roll-number order. */
  everyone: StudentTotals[]
  /** Students of the roster who were not picked in the period. */
  notPicked: Student[]
  totalStars: number
  totalPicks: number
}

/**
 * Turn per-student totals into the ranking of a classroom. Totals of students who are no longer on
 * the roster are left out; students without totals count as not picked.
 */
export function buildRanking(stats: readonly StudentStat[], roster: readonly Student[]): Ranking {
  const byId = new Map(stats.map((stat) => [stat.studentId, stat]))
  const entries: StudentTotals[] = [...roster]
    .sort((a, b) => compareStudents(a, b))
    .map((student) => {
      const stat = byId.get(student.id)
      return { student, stars: stat?.stars ?? 0, picks: stat?.picks ?? 0, lastPickedAt: stat?.lastPickedAt ?? null }
    })

  const starred = entries
    .filter((entry) => entry.stars > 0)
    .sort((a, b) => b.stars - a.stars || compareStudents(a.student, b.student))
  let rank = 0
  const leaders = starred.map((entry, position) => {
    const previous = starred[position - 1]
    if (!previous || previous.stars !== entry.stars) rank = position + 1
    return { ...entry, rank }
  })

  return {
    leaders,
    everyone: entries,
    notPicked: entries.filter((entry) => entry.picks === 0).map((entry) => entry.student),
    totalStars: entries.reduce((sum, entry) => sum + entry.stars, 0),
    totalPicks: entries.reduce((sum, entry) => sum + entry.picks, 0),
  }
}

export const RANKING_HEADERS = [
  'อันดับ',
  'เลขที่',
  'ชื่อ-นามสกุล',
  'ชื่อที่ใช้',
  'ดาว',
  'ถูกเลือก (ครั้ง)',
  'ถูกเลือกล่าสุด',
] as const
export const RANKING_WIDTHS = [8, 8, 28, 14, 8, 14, 22] as const

/** Spreadsheet rows: ranked students first, then the rest of the roster in roll-number order. */
export function rankingToSheet(ranking: Ranking, nameFormat: NameFormat): Cell[][] {
  const ranked = new Set(ranking.leaders.map((entry) => entry.student.id))
  const row = (entry: StudentTotals, rank: number | ''): Cell[] => [
    rank,
    entry.student.number,
    getFullName(entry.student),
    getDisplayName(entry.student, nameFormat),
    entry.stars,
    entry.picks,
    entry.lastPickedAt ? formatDateTime(entry.lastPickedAt) : '',
  ]
  return [
    [...RANKING_HEADERS],
    ...ranking.leaders.map((entry) => row(entry, entry.rank)),
    ...ranking.everyone.filter((entry) => !ranked.has(entry.student.id)).map((entry) => row(entry, '')),
  ]
}

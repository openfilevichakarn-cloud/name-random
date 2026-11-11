import type { HistoryQuery, ID, RandomResult, RandomSession, ResultMode } from '@/data/types'
import { addDays, formatDate, formatTime, startOfDay } from '@/lib/date'
import type { Cell } from '@/lib/spreadsheet'

import { drawKey } from './stats'

export const HISTORY_PERIODS = ['today', '7d', '30d', 'all'] as const
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number]

export const PERIOD_LABELS: Record<HistoryPeriod, string> = {
  today: 'วันนี้',
  '7d': '7 วัน',
  '30d': '30 วัน',
  all: 'ทั้งหมด',
}

export interface HistoryFilters {
  period: HistoryPeriod
  classroomId: ID | null
  mode: ResultMode | null
  search: string
}

/** Everything, newest first — narrowing is the user's choice. */
export const DEFAULT_FILTERS: HistoryFilters = { period: 'all', classroomId: null, mode: null, search: '' }

/** Translate the filter bar into a repository query. */
export function toHistoryQuery(filters: HistoryFilters, now: Date = new Date()): HistoryQuery {
  const today = startOfDay(now)
  const from =
    filters.period === 'today'
      ? today
      : filters.period === '7d'
        ? addDays(today, -6)
        : filters.period === '30d'
          ? addDays(today, -29)
          : null
  return {
    from: from ? from.toISOString() : null,
    classroomId: filters.classroomId,
    mode: filters.mode,
    search: filters.search.trim(),
  }
}

const MODE_NAMES: Record<ResultMode, string> = {
  wheel: 'Lucky Wheel',
  slot: 'Mystery Slot',
  card: 'Mystery Card',
  countdown: 'Countdown',
  gacha: 'Gacha',
  team: 'Team Random',
}

const DRAW_TYPE_NAMES = { single: 'ทีละคน', multiple: 'หลายคน', team: 'แบ่งทีม' } as const

export const REPORT_HEADERS = [
  'วันที่',
  'เวลา',
  'ห้องเรียน',
  'รูปแบบ',
  'ประเภท',
  'ชื่อ',
  'เลขที่',
  'ทีม',
  'ลำดับในครั้ง',
  'ดาว',
  'ภารกิจ',
  'รางวัลเซอร์ไพรส์',
  'ผลการตอบ',
  'Lucky Streak',
] as const

export const REPORT_WIDTHS = [14, 8, 22, 14, 10, 28, 8, 10, 12, 6, 30, 26, 10, 12] as const

const QUIZ_NAMES = { correct: 'ตอบถูก', wrong: 'ตอบผิด' } as const

/** Rows of the exported report, header first, in the order the results are given. */
export function resultsToReport(
  results: readonly RandomResult[],
  sessions: ReadonlyMap<ID, RandomSession>,
): Cell[][] {
  return [
    [...REPORT_HEADERS],
    ...results.map((result) => [
      formatDate(result.createdAt),
      formatTime(result.createdAt),
      sessions.get(result.sessionId)?.classroomName ?? '',
      MODE_NAMES[result.mode],
      DRAW_TYPE_NAMES[result.drawType],
      result.displayName,
      result.studentNumber ?? '',
      result.meta?.teamName ?? (result.teamIndex !== null ? `ทีม ${result.teamIndex + 1}` : ''),
      result.pickIndex,
      result.points,
      result.meta?.challenge ?? '',
      result.meta?.reward ?? '',
      result.meta?.quiz ? QUIZ_NAMES[result.meta.quiz] : '',
      result.meta?.streak ?? '',
    ]),
  ]
}

export interface SessionGroup {
  sessionId: ID
  /** Newest result first, as loaded. */
  results: RandomResult[]
  draws: number
  latestAt: string
}

/** Group loaded results by round, keeping the newest round first. */
export function groupBySession(results: readonly RandomResult[]): SessionGroup[] {
  const groups = new Map<ID, SessionGroup & { keys: Set<string> }>()
  for (const result of results) {
    let group = groups.get(result.sessionId)
    if (!group) {
      group = { sessionId: result.sessionId, results: [], draws: 0, latestAt: result.createdAt, keys: new Set() }
      groups.set(result.sessionId, group)
    }
    group.results.push(result)
    group.keys.add(drawKey(result))
    if (result.createdAt > group.latestAt) group.latestAt = result.createdAt
  }
  return [...groups.values()]
    .map(({ keys, ...group }) => ({ ...group, draws: keys.size }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

import type { Classroom, RandomResult, ResultMode, Student } from '@/data/types'
import { addDays, startOfDay, toDateKey } from '@/lib/date'

/** Identity of one draw: several results (multiple / team draws) can belong to the same draw. */
export function drawKey(result: Pick<RandomResult, 'sessionId' | 'drawIndex'>): string {
  return `${result.sessionId}#${result.drawIndex}`
}

/** Number of distinct draws in a list of results. */
export function countDraws(results: readonly RandomResult[]): number {
  return new Set(results.map(drawKey)).size
}

export function filterSince(results: readonly RandomResult[], since: Date): RandomResult[] {
  const iso = since.toISOString()
  return results.filter((result) => result.createdAt >= iso)
}

export interface DayCount {
  /** Local `YYYY-MM-DD`. */
  key: string
  date: Date
  /** Distinct draws made that day. */
  draws: number
  /** People/numbers picked that day (team members are not counted as picks). */
  picks: number
}

/** Draw counts for each of the last `days` local days, oldest first, ending today. */
export function countByDay(results: readonly RandomResult[], days: number, now: Date = new Date()): DayCount[] {
  const today = startOfDay(now)
  const buckets = new Map<string, { draws: Set<string>; picks: number }>()
  const series: DayCount[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    const key = toDateKey(date)
    buckets.set(key, { draws: new Set(), picks: 0 })
    series.push({ key, date, draws: 0, picks: 0 })
  }
  for (const result of results) {
    const bucket = buckets.get(toDateKey(result.createdAt))
    if (!bucket) continue
    bucket.draws.add(drawKey(result))
    if (result.drawType !== 'team') bucket.picks += 1
  }
  for (const day of series) {
    const bucket = buckets.get(day.key)
    if (bucket) {
      day.draws = bucket.draws.size
      day.picks = bucket.picks
    }
  }
  return series
}

export interface ModeCount {
  mode: ResultMode
  draws: number
}

/** Distinct draws per mode, most used first. Modes that were never used are left out. */
export function countByMode(results: readonly RandomResult[]): ModeCount[] {
  const draws = new Map<ResultMode, Set<string>>()
  for (const result of results) {
    const set = draws.get(result.mode) ?? new Set<string>()
    set.add(drawKey(result))
    draws.set(result.mode, set)
  }
  return [...draws.entries()]
    .map(([mode, set]) => ({ mode, draws: set.size }))
    .sort((a, b) => b.draws - a.draws || a.mode.localeCompare(b.mode))
}

export type ActivityKind = 'classroom' | 'students' | 'draw'

export interface Activity {
  id: string
  kind: ActivityKind
  at: string
  title: string
  detail: string
}

/**
 * Recent activity derived from data the app already stores (no separate log table):
 * classrooms created, students added (grouped per classroom and day) and draws made.
 */
export function buildActivityFeed(
  classrooms: readonly Classroom[],
  students: readonly Student[],
  results: readonly RandomResult[],
  limit = 8,
): Activity[] {
  const names = new Map(classrooms.map((classroom) => [classroom.id, classroom.name]))
  const activities: Activity[] = []

  for (const classroom of classrooms) {
    activities.push({
      id: `classroom:${classroom.id}`,
      kind: 'classroom',
      at: classroom.createdAt,
      title: `สร้างห้อง ${classroom.name}`,
      detail: classroom.isDemo ? 'ข้อมูลตัวอย่าง' : classroom.gradeLevel,
    })
  }

  const additions = new Map<string, { classroomId: string; at: string; count: number }>()
  for (const student of students) {
    const key = `${student.classroomId}|${toDateKey(student.createdAt)}`
    const group = additions.get(key)
    if (group) {
      group.count += 1
      if (student.createdAt > group.at) group.at = student.createdAt
    } else {
      additions.set(key, { classroomId: student.classroomId, at: student.createdAt, count: 1 })
    }
  }
  for (const [key, group] of additions) {
    activities.push({
      id: `students:${key}`,
      kind: 'students',
      at: group.at,
      title: `เพิ่มนักเรียน ${group.count} คน`,
      detail: names.get(group.classroomId) ?? '',
    })
  }

  const draws = new Map<string, { at: string; mode: ResultMode; names: string[]; teams: Set<number>; classroomId: string | null }>()
  for (const result of results) {
    const key = drawKey(result)
    const draw = draws.get(key)
    if (draw) {
      draw.names.push(result.displayName)
      if (result.teamIndex !== null) draw.teams.add(result.teamIndex)
    } else {
      draws.set(key, {
        at: result.createdAt,
        mode: result.mode,
        names: [result.displayName],
        teams: new Set(result.teamIndex !== null ? [result.teamIndex] : []),
        classroomId: result.classroomId,
      })
    }
  }
  for (const [key, draw] of draws) {
    const title =
      draw.mode === 'team'
        ? `แบ่ง ${draw.names.length} คนเป็น ${draw.teams.size} ทีม`
        : draw.names.length === 1
          ? `สุ่มได้ ${draw.names[0]}`
          : `สุ่มได้ ${draw.names.length} คน`
    activities.push({
      id: `draw:${key}`,
      kind: 'draw',
      at: draw.at,
      title,
      detail: (draw.classroomId && names.get(draw.classroomId)) || '',
    })
  }

  return activities.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

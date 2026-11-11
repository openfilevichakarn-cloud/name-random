import type { RandomResult, StudentStat } from './types'

type StatSource = Pick<RandomResult, 'studentId' | 'points' | 'drawType' | 'createdAt'>

/**
 * Sum results into per-student totals (the local twin of the `classroom_student_stats` SQL function).
 * Rows without a student — bare numbers, deleted students — are skipped.
 */
export function aggregateStudentStats(rows: Iterable<StatSource>): StudentStat[] {
  const totals = new Map<string, StudentStat>()
  for (const row of rows) {
    if (!row.studentId) continue
    let stat = totals.get(row.studentId)
    if (!stat) {
      stat = { studentId: row.studentId, stars: 0, picks: 0, lastPickedAt: null }
      totals.set(row.studentId, stat)
    }
    stat.stars += row.points
    if (row.drawType !== 'team') {
      stat.picks += 1
      if (stat.lastPickedAt === null || row.createdAt > stat.lastPickedAt) stat.lastPickedAt = row.createdAt
    }
  }
  return [...totals.values()]
}

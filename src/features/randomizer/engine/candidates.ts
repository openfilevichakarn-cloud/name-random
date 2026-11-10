import { LIMITS, type NameFormat } from '@/data/settings'
import type { Student } from '@/data/types'
import { compareStudents, getDisplayName, getFullName } from '@/features/students/lib/names'

import type { Candidate } from './types'

/** Build the pool for a classroom roster, ordered by roll number. */
export function buildStudentCandidates(students: readonly Student[], format: NameFormat): Candidate[] {
  return [...students]
    .sort((a, b) => compareStudents(a, b))
    .map((student) => {
      const label = getDisplayName(student, format)
      const fullName = getFullName(student)
      return {
        id: student.id,
        label,
        detail: fullName === label ? '' : fullName,
        number: student.number,
        avatar: student.avatar || `bot:${student.id}`,
        studentId: student.id,
      }
    })
}

export function numberCandidateId(value: number): string {
  return `n:${value}`
}

/**
 * Build the pool for a number draw (`min`..`max`, inclusive).
 * When a roster is given, each number is linked to the student with that roll number, so the
 * reveal can show who the number belongs to.
 */
export function buildNumberCandidates(
  min: number,
  max: number,
  students: readonly Student[] = [],
  format: NameFormat = 'nickname',
): Candidate[] {
  const low = Math.floor(Math.min(min, max))
  const high = Math.min(Math.floor(Math.max(min, max)), low + LIMITS.numberSpan - 1)
  const byNumber = new Map<number, Student>()
  for (const student of students) {
    if (!byNumber.has(student.number)) byNumber.set(student.number, student)
  }

  const candidates: Candidate[] = []
  for (let value = low; value <= high; value += 1) {
    const student = byNumber.get(value)
    candidates.push({
      id: numberCandidateId(value),
      label: String(value),
      detail: student ? getDisplayName(student, format) : '',
      number: value,
      avatar: student ? student.avatar || `bot:${student.id}` : null,
      studentId: student?.id ?? null,
    })
  }
  return candidates
}

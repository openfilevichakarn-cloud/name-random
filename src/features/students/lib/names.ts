import type { NameFormat } from '@/data/settings'
import type { Student } from '@/data/types'

import { compareText, foldText } from './text'

type NameParts = Pick<Student, 'firstName' | 'lastName' | 'nickname'>

/** "ชื่อ นามสกุล" without stray spaces when the last name is empty. */
export function getFullName(student: NameParts): string {
  return `${student.firstName} ${student.lastName}`.trim()
}

/** The label shown big on the stage, according to Settings → General → name format. */
export function getDisplayName(student: NameParts, format: NameFormat): string {
  switch (format) {
    case 'nickname':
      return student.nickname || student.firstName
    case 'first':
      return student.firstName
    case 'full':
      return getFullName(student)
  }
}

/** True when `query` matches the student's number, code or any of their names. */
export function matchesStudent(student: Student, query: string): boolean {
  const needle = foldText(query)
  if (!needle) return true
  const haystack = [
    String(student.number),
    student.studentCode,
    student.firstName,
    student.lastName,
    student.nickname,
    getFullName(student),
  ]
  return haystack.some((value) => foldText(value).includes(needle))
}

export type StudentSortKey = 'number' | 'name' | 'nickname' | 'studentCode'

export function compareStudents(a: Student, b: Student, key: StudentSortKey = 'number'): number {
  switch (key) {
    case 'number':
      return a.number - b.number || compareText(a.firstName, b.firstName)
    case 'name':
      return compareText(getFullName(a), getFullName(b)) || a.number - b.number
    case 'nickname':
      // Students without a nickname sort last.
      if (!a.nickname !== !b.nickname) return a.nickname ? -1 : 1
      return compareText(a.nickname, b.nickname) || a.number - b.number
    case 'studentCode':
      if (!a.studentCode !== !b.studentCode) return a.studentCode ? -1 : 1
      return compareText(a.studentCode, b.studentCode) || a.number - b.number
  }
}

/** Smallest positive integer not used as a roll number yet. */
export function nextFreeNumber(used: Iterable<number>): number {
  const taken = new Set(used)
  let candidate = 1
  while (taken.has(candidate)) candidate += 1
  return candidate
}

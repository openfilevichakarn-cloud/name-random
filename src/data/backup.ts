import { isValidAvatar } from '@/features/students/lib/avatar'
import { cleanText } from '@/features/students/lib/text'
import { isUuid } from '@/lib/id'

import type { DataSnapshot } from './repository'
import { sanitizeSettings, type AppSettings } from './settings'
import {
  CLASSROOM_COLORS,
  RANDOM_MODES,
  type Classroom,
  type ClassroomColor,
  type DrawType,
  type RandomResult,
  type RandomSession,
  type ResultMeta,
  type ResultMode,
  type Student,
} from './types'

export const BACKUP_FORMAT = 'ngsr-backup'
export const BACKUP_VERSION = 1

/** Upper bounds for a restored file. Far above any real classroom use; a guard against junk input. */
const LIMITS = { classrooms: 500, students: 30_000, sessions: 50_000, results: 300_000 } as const

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: DataSnapshot
  settings: AppSettings
}

export function createBackup(data: DataSnapshot, settings: AppSettings, now: Date = new Date()): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data, settings }
}

type Row = Record<string, unknown>

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rows(value: unknown, limit: number): Row[] {
  return Array.isArray(value) ? value.filter(isRow).slice(0, limit) : []
}

function text(value: unknown, maxLength: number): string {
  return cleanText(typeof value === 'string' || typeof value === 'number' ? value : '').slice(0, maxLength)
}

function isoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const time = Date.parse(value)
  return Number.isNaN(time) ? fallback : new Date(time).toISOString()
}

function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null
}

function sanitizeMeta(value: unknown): ResultMeta | null {
  if (!isRow(value)) return null
  const meta: ResultMeta = {}
  if (typeof value.teamName === 'string') meta.teamName = text(value.teamName, 60)
  if (typeof value.challenge === 'string') meta.challenge = text(value.challenge, 120)
  if (typeof value.reward === 'string') meta.reward = text(value.reward, 120)
  const streak = integer(value.streak, 0, 9999)
  if (streak !== null) meta.streak = streak
  if (value.quiz === 'correct' || value.quiz === 'wrong') meta.quiz = value.quiz
  return Object.keys(meta).length > 0 ? meta : null
}

const RESULT_MODES: readonly ResultMode[] = [...RANDOM_MODES, 'team']
const DRAW_TYPES: readonly DrawType[] = ['single', 'multiple', 'team']

/**
 * Rebuild a snapshot from untrusted input (a backup file chosen by the user).
 * Rows with a missing or malformed identity are dropped, as are rows that point at a
 * classroom or session that is not in the file; every remaining field is coerced into range.
 */
export function sanitizeSnapshot(input: unknown): DataSnapshot {
  const source = isRow(input) ? input : {}
  const now = new Date().toISOString()

  const classrooms: Classroom[] = []
  const classroomIds = new Set<string>()
  for (const row of rows(source.classrooms, LIMITS.classrooms)) {
    const name = text(row.name, 40)
    if (!isUuid(row.id) || classroomIds.has(row.id) || !name) continue
    classroomIds.add(row.id)
    const createdAt = isoDate(row.createdAt, now)
    classrooms.push({
      id: row.id,
      schoolId: null,
      ownerId: null,
      name,
      gradeLevel: text(row.gradeLevel, 40),
      academicYear: /^\d{4}$/.test(String(row.academicYear ?? '')) ? String(row.academicYear) : '',
      color: CLASSROOM_COLORS.includes(row.color as ClassroomColor) ? (row.color as ClassroomColor) : 'violet',
      isDemo: row.isDemo === true,
      createdAt,
      updatedAt: isoDate(row.updatedAt, createdAt),
    })
  }

  const students: Student[] = []
  const studentIds = new Set<string>()
  for (const row of rows(source.students, LIMITS.students)) {
    const firstName = text(row.firstName, 60)
    const number = integer(row.number, 1, 999)
    if (!isUuid(row.id) || studentIds.has(row.id) || !firstName || number === null) continue
    if (!isUuid(row.classroomId) || !classroomIds.has(row.classroomId)) continue
    studentIds.add(row.id)
    const createdAt = isoDate(row.createdAt, now)
    students.push({
      id: row.id,
      schoolId: null,
      classroomId: row.classroomId,
      studentCode: /^[0-9A-Za-z][0-9A-Za-z._/-]*$/.test(String(row.studentCode ?? ''))
        ? String(row.studentCode).slice(0, 20)
        : '',
      number,
      firstName,
      lastName: text(row.lastName, 60),
      nickname: text(row.nickname, 30),
      avatar: isValidAvatar(row.avatar) ? row.avatar : '',
      createdAt,
      updatedAt: isoDate(row.updatedAt, createdAt),
    })
  }

  const sessions: RandomSession[] = []
  const sessionIds = new Set<string>()
  for (const row of rows(source.sessions, LIMITS.sessions)) {
    if (!isUuid(row.id) || sessionIds.has(row.id)) continue
    sessionIds.add(row.id)
    const rules = isRow(row.rules) ? row.rules : {}
    const numberMin = integer(rules.numberMin, 0, 9999)
    const numberMax = integer(rules.numberMax, 0, 9999)
    sessions.push({
      id: row.id,
      schoolId: null,
      userId: null,
      // A session may outlive its classroom; keep the link only when the classroom is in the file.
      classroomId: isUuid(row.classroomId) && classroomIds.has(row.classroomId) ? row.classroomId : null,
      classroomName: text(row.classroomName, 80),
      source: row.source === 'numbers' ? 'numbers' : 'students',
      rules: {
        repeatPolicy: rules.repeatPolicy === 'allow-repeat' ? 'allow-repeat' : 'no-repeat',
        ...(numberMin !== null && numberMax !== null ? { numberMin, numberMax } : {}),
      },
      startedAt: isoDate(row.startedAt, now),
      endedAt: row.endedAt === null || row.endedAt === undefined ? null : isoDate(row.endedAt, now),
    })
  }

  const results: RandomResult[] = []
  const resultIds = new Set<string>()
  for (const row of rows(source.results, LIMITS.results)) {
    if (!isUuid(row.id) || resultIds.has(row.id)) continue
    if (!isUuid(row.sessionId) || !sessionIds.has(row.sessionId)) continue
    const mode = RESULT_MODES.includes(row.mode as ResultMode) ? (row.mode as ResultMode) : null
    const drawType = DRAW_TYPES.includes(row.drawType as DrawType) ? (row.drawType as DrawType) : null
    const displayName = text(row.displayName, 200)
    if (!mode || !drawType || !displayName) continue
    resultIds.add(row.id)
    results.push({
      id: row.id,
      schoolId: null,
      userId: null,
      sessionId: row.sessionId,
      classroomId: isUuid(row.classroomId) && classroomIds.has(row.classroomId) ? row.classroomId : null,
      studentId: isUuid(row.studentId) && studentIds.has(row.studentId) ? row.studentId : null,
      displayName,
      studentNumber: integer(row.studentNumber, 0, 9999),
      avatar: isValidAvatar(row.avatar) && row.avatar !== '' ? row.avatar : null,
      mode,
      drawType,
      drawIndex: integer(row.drawIndex, 1, 1_000_000) ?? 1,
      pickIndex: integer(row.pickIndex, 1, 10_000) ?? 1,
      teamIndex: integer(row.teamIndex, 0, 999),
      points: integer(row.points, 0, 9999) ?? 0,
      meta: sanitizeMeta(row.meta),
      createdAt: isoDate(row.createdAt, now),
    })
  }

  return { classrooms, students, sessions, results }
}

export type BackupParseResult =
  | { ok: true; data: DataSnapshot; settings: AppSettings | null; exportedAt: string | null }
  | { ok: false; error: string }

/** Parse and validate the text of a backup file. */
export function parseBackup(content: string): BackupParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลที่ถูกต้อง (อ่าน JSON ไม่ได้)' }
  }
  if (!isRow(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ NEXT-GEN STUDENT RANDOMIZER' }
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    return { ok: false, error: 'ไฟล์สำรองนี้สร้างจากเวอร์ชันที่ใหม่กว่า กรุณาอัปเดตแอปก่อนกู้คืน' }
  }
  const optional = (value: unknown): string | null => (typeof value === 'string' ? isoDate(value, '') || null : null)
  return {
    ok: true,
    data: sanitizeSnapshot(parsed.data),
    settings: isRow(parsed.settings) ? sanitizeSettings(parsed.settings) : null,
    exportedAt: optional(parsed.exportedAt),
  }
}

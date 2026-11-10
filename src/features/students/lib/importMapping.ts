import type { Student } from '@/data/types'

import { nextFreeNumber } from './names'
import { cleanText, foldText, graphemeLength } from './text'
import { STUDENT_LIMITS, type StudentFields } from './validation'

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const IMPORT_FIELDS = [
  'ignore',
  'number',
  'studentCode',
  'prefix',
  'firstName',
  'lastName',
  'fullName',
  'nickname',
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  ignore: 'ไม่ใช้คอลัมน์นี้',
  number: 'เลขที่',
  studentCode: 'รหัสนักเรียน',
  prefix: 'คำนำหน้า',
  firstName: 'ชื่อ',
  lastName: 'นามสกุล',
  fullName: 'ชื่อ-นามสกุล',
  nickname: 'ชื่อเล่น',
}

/** Rows of cleaned cell text. */
export type Table = string[][]

const HEADER_ALIASES: Record<Exclude<ImportField, 'ignore'>, readonly string[]> = {
  number: ['เลขที่', 'ลำดับ', 'ลำดับที่', 'ที่', 'เลข', 'no', 'number', 'num', '#'],
  studentCode: [
    'รหัสนักเรียน',
    'รหัส',
    'เลขประจำตัว',
    'เลขประจำตัวนักเรียน',
    'รหัสประจำตัว',
    'รหัสประจำตัวนักเรียน',
    'studentid',
    'studentcode',
    'studentno',
    'id',
    'code',
  ],
  prefix: ['คำนำหน้า', 'คำนำหน้าชื่อ', 'คำนำหน้านาม', 'prefix', 'title'],
  firstName: ['ชื่อ', 'ชื่อจริง', 'ชื่อตัว', 'firstname', 'first', 'name', 'givenname'],
  lastName: ['นามสกุล', 'สกุล', 'lastname', 'last', 'surname', 'familyname'],
  fullName: [
    'ชื่อนามสกุล',
    'ชื่อสกุล',
    'ชื่อและนามสกุล',
    'ชื่อและสกุล',
    'ชื่อนักเรียน',
    'ชื่อเต็ม',
    'รายชื่อ',
    'รายชื่อนักเรียน',
    'fullname',
    'studentname',
  ],
  nickname: ['ชื่อเล่น', 'nickname', 'nick'],
}

/** "ชื่อ - นามสกุล" → "ชื่อนามสกุล": compare headers without spaces and punctuation. */
function headerKey(value: string): string {
  return foldText(value).replace(/[\s._\-–—/\\()[\]:*]/g, '')
}

const HEADER_LOOKUP: ReadonlyMap<string, ImportField> = new Map(
  (Object.entries(HEADER_ALIASES) as [ImportField, readonly string[]][]).flatMap(([field, aliases]) =>
    aliases.map((alias) => [headerKey(alias), field] as const),
  ),
)

/** Map a header cell to a field, or null when it is not recognised. */
export function guessField(header: string): ImportField | null {
  return HEADER_LOOKUP.get(headerKey(header)) ?? null
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/** Clean every cell, drop empty rows and pad rows to the same width. */
export function normalizeTable(rows: readonly (readonly unknown[])[]): Table {
  const cleaned = rows
    .map((row) => row.map((cell) => cleanText(cell)))
    .filter((row) => row.some((cell) => cell !== ''))
  let width = 0
  for (const row of cleaned) {
    for (let i = row.length - 1; i >= 0; i -= 1) {
      if (row[i] !== '') {
        width = Math.max(width, i + 1)
        break
      }
    }
  }
  return cleaned.map((row) => Array.from({ length: width }, (_unused, i) => row[i] ?? ''))
}

/** Split pasted text (from Excel or a plain list) into a table. */
export function parsePastedText(text: string): Table {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const hasTabs = lines.some((line) => line.includes('\t'))
  const hasCommas = !hasTabs && lines.some((line) => line.includes(','))
  const separator = hasTabs ? '\t' : hasCommas ? ',' : null
  return normalizeTable(lines.map((line) => (separator ? line.split(separator) : [line])))
}

const HEADER_SCAN_ROWS = 10

/** Index of the header row, or -1 when the table starts straight with data. */
export function detectHeaderRow(table: Table): number {
  const limit = Math.min(table.length, HEADER_SCAN_ROWS)
  for (let i = 0; i < limit; i += 1) {
    const fields = (table[i] ?? []).map(guessField).filter((field) => field !== null)
    const hasName = fields.some((field) => field === 'firstName' || field === 'fullName')
    if (hasName || fields.length >= 2) return i
  }
  return -1
}

function isRollNumber(value: string): boolean {
  return /^\d{1,3}\.?$/.test(value)
}

function isCodeLike(value: string): boolean {
  return /^[0-9A-Za-z][0-9A-Za-z._/-]{3,}$/.test(value) && /\d/.test(value)
}

function share(values: string[], predicate: (value: string) => boolean): number {
  const filled = values.filter((value) => value !== '')
  if (filled.length === 0) return 0
  return filled.filter(predicate).length / filled.length
}

/** Guess which field each column holds, from the header row when there is one, else from the data. */
export function guessMapping(table: Table, headerIndex: number): ImportField[] {
  const width = table[0]?.length ?? 0
  const mapping: ImportField[] = Array.from({ length: width }, () => 'ignore')
  const used = new Set<ImportField>()
  const assign = (column: number, field: ImportField) => {
    if (field === 'ignore' || used.has(field)) return
    mapping[column] = field
    used.add(field)
  }

  if (headerIndex >= 0) {
    const header = table[headerIndex] ?? []
    header.forEach((cell, column) => {
      const field = guessField(cell)
      if (field) assign(column, field)
    })
    // "ชื่อสกุล" next to a separate "ชื่อ" column means the family name, not the full name.
    if (used.has('firstName') && used.has('fullName') && !used.has('lastName')) {
      const column = mapping.indexOf('fullName')
      if (headerKey(header[column] ?? '') === 'ชื่อสกุล') {
        mapping[column] = 'lastName'
        used.delete('fullName')
        used.add('lastName')
      }
    }
    if (used.has('firstName') || used.has('fullName')) return mapping
  }

  // No usable header: look at the data.
  const body = table.slice(headerIndex + 1, headerIndex + 31)
  const textColumns: number[] = []
  for (let column = 0; column < width; column += 1) {
    if (mapping[column] !== 'ignore') continue
    const values = body.map((row) => row[column] ?? '')
    if (share(values, isRollNumber) >= 0.8) assign(column, 'number')
    else if (share(values, isCodeLike) >= 0.8) assign(column, 'studentCode')
    else if (values.some((value) => value !== '')) textColumns.push(column)
  }

  const [first, second, third] = textColumns
  if (first !== undefined) {
    const values = body.map((row) => row[first] ?? '')
    const looksFull = second === undefined || share(values, (value) => value.includes(' ')) >= 0.5
    if (looksFull && !used.has('firstName')) {
      assign(first, 'fullName')
      if (second !== undefined) assign(second, 'nickname')
    } else {
      assign(first, 'firstName')
      if (second !== undefined) assign(second, 'lastName')
      if (third !== undefined) assign(third, 'nickname')
    }
  }
  return mapping
}

// ---------------------------------------------------------------------------
// Name prefixes
// ---------------------------------------------------------------------------

// Longest first, so "นางสาว" wins over "นาง".
const THAI_PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นางสาว', 'ด.ช.', 'ด.ญ.', 'น.ส.', 'ดช.', 'ดญ.', 'นส.', 'ด.ช', 'ด.ญ', 'น.ส', 'นาย', 'นาง']
const LATIN_PREFIXES = ['master', 'miss', 'mrs', 'mr', 'ms']
/** A Thai name can only start with a consonant or a leading vowel — never with a mark that sits on a consonant. */
const THAI_NAME_START = /^[ก-ฮเแโใไ]/

/** Remove a title such as "ด.ช." or "นางสาว" from the start of a name. */
export function stripNamePrefix(name: string): string {
  const value = cleanText(name)
  for (const prefix of THAI_PREFIXES) {
    if (!value.startsWith(prefix)) continue
    const rest = value.slice(prefix.length).trimStart()
    // "นายิกา" starts with "นาย" but is a given name: what follows must be able to start a word.
    if (rest.length >= 2 && (THAI_NAME_START.test(rest) || /^[A-Za-z]/.test(rest))) return rest
    return value
  }
  const lower = value.toLowerCase()
  for (const prefix of LATIN_PREFIXES) {
    if (!lower.startsWith(prefix)) continue
    const rest = value.slice(prefix.length)
    const match = /^(\.\s*|\s+)(\S.*)$/.exec(rest)
    if (match?.[2]) return match[2].trim()
  }
  return value
}

/** "ชื่อ นามสกุล ณ อยุธยา" → ["ชื่อ", "นามสกุล ณ อยุธยา"]. */
export function splitFullName(fullName: string): [firstName: string, lastName: string] {
  const value = cleanText(fullName)
  const space = value.indexOf(' ')
  if (space === -1) return [value, '']
  return [value.slice(0, space), value.slice(space + 1).trim()]
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

export interface ParseOptions {
  /** Index of the header row; data starts on the next row. -1 when there is no header. */
  headerIndex: number
  mapping: readonly ImportField[]
  stripPrefix: boolean
  /** Students already in the classroom (pass an empty list when the import replaces the roster). */
  existing: readonly Student[]
}

export interface ParsedRow {
  /** 1-based row number in the source table, for messages. */
  rowNumber: number
  status: 'ok' | 'skip'
  student: StudentFields | null
  /** Adjustments made to the row (still imported). */
  notes: string[]
  /** Why the row is skipped. */
  reason: string | null
}

export interface ParseResult {
  rows: ParsedRow[]
  ready: StudentFields[]
  skipped: number
  adjusted: number
}

const CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._/-]*$/

function parseRollNumber(value: string): number | null {
  const match = /^(\d{1,4})(?:\.0*)?\.?$/.exec(value)
  if (!match) return null
  const number = Number(match[1])
  const { min, max } = STUDENT_LIMITS.number
  return number >= min && number <= max ? number : null
}

function nameKey(firstName: string, lastName: string): string {
  return `${foldText(firstName)}|${foldText(lastName)}`
}

/** Turn table rows into validated student records, explaining every skip and adjustment. */
export function parseStudentRows(table: Table, options: ParseOptions): ParseResult {
  const { headerIndex, mapping, stripPrefix, existing } = options
  const columnOf = (field: ImportField): number[] =>
    mapping.flatMap((mapped, column) => (mapped === field ? [column] : []))
  const read = (row: readonly string[], field: ImportField): string => {
    for (const column of columnOf(field)) {
      const value = row[column] ?? ''
      if (value) return value
    }
    return ''
  }

  const takenNumbers = new Set(existing.map((student) => student.number))
  const takenCodes = new Set(existing.filter((s) => s.studentCode).map((s) => foldText(s.studentCode)))
  const takenNames = new Set(existing.map((s) => nameKey(s.firstName, s.lastName)))
  let capacity = STUDENT_LIMITS.perClassroom - existing.length

  const rows: ParsedRow[] = []
  /** Rows whose number has to be assigned once all explicit numbers are known. */
  const needsNumber: { row: ParsedRow; requested: string }[] = []

  for (let index = headerIndex + 1; index < table.length; index += 1) {
    const cells = table[index] ?? []
    const parsed: ParsedRow = { rowNumber: index + 1, status: 'ok', student: null, notes: [], reason: null }
    rows.push(parsed)
    const skip = (reason: string) => {
      parsed.status = 'skip'
      parsed.reason = reason
    }

    let firstName = read(cells, 'firstName')
    let lastName = read(cells, 'lastName')
    const fullName = read(cells, 'fullName')
    if (!firstName && fullName) {
      const source = stripPrefix ? stripNamePrefix(fullName) : fullName
      const [first, last] = splitFullName(source)
      firstName = first
      if (!lastName) lastName = last
    } else if (stripPrefix) {
      firstName = stripNamePrefix(firstName)
    }
    const nickname = read(cells, 'nickname')

    if (!firstName) {
      skip('ไม่มีชื่อ')
      continue
    }
    if (graphemeLength(firstName) > STUDENT_LIMITS.name || graphemeLength(lastName) > STUDENT_LIMITS.name) {
      skip(`ชื่อหรือนามสกุลยาวเกิน ${STUDENT_LIMITS.name} ตัวอักษร`)
      continue
    }

    let studentCode = read(cells, 'studentCode').replace(/\s+/g, '')
    if (studentCode && (!CODE_PATTERN.test(studentCode) || studentCode.length > STUDENT_LIMITS.studentCode)) {
      parsed.notes.push('รหัสนักเรียนไม่ถูกรูปแบบ จึงเว้นว่างไว้')
      studentCode = ''
    }
    if (studentCode && takenCodes.has(foldText(studentCode))) {
      skip(`รหัสนักเรียน ${studentCode} มีอยู่แล้ว`)
      continue
    }
    const key = nameKey(firstName, lastName)
    if (takenNames.has(key)) {
      skip('มีชื่อนี้อยู่แล้ว')
      continue
    }
    if (capacity <= 0) {
      skip(`เกินจำนวนสูงสุด ${STUDENT_LIMITS.perClassroom} คนต่อห้อง`)
      continue
    }

    capacity -= 1
    takenNames.add(key)
    if (studentCode) takenCodes.add(foldText(studentCode))

    const trimmedNickname =
      graphemeLength(nickname) > STUDENT_LIMITS.nickname ? '' : nickname
    if (nickname && !trimmedNickname) parsed.notes.push('ชื่อเล่นยาวเกินไป จึงเว้นว่างไว้')

    parsed.student = { studentCode, number: 0, firstName, lastName, nickname: trimmedNickname }

    const requested = read(cells, 'number')
    const number = parseRollNumber(requested)
    if (number !== null && !takenNumbers.has(number)) {
      parsed.student.number = number
      takenNumbers.add(number)
    } else {
      needsNumber.push({ row: parsed, requested })
    }
  }

  for (const { row, requested } of needsNumber) {
    if (!row.student) continue
    const number = nextFreeNumber(takenNumbers)
    if (number > STUDENT_LIMITS.number.max) {
      row.status = 'skip'
      row.student = null
      row.reason = 'ไม่มีเลขที่ว่างเหลือ'
      continue
    }
    row.student.number = number
    takenNumbers.add(number)
    if (requested) row.notes.push(`เลขที่ "${requested}" ซ้ำหรือไม่ถูกต้อง จึงใช้เลขที่ ${number}`)
  }

  const ready = rows.flatMap((row) => (row.status === 'ok' && row.student ? [row.student] : []))
  return {
    rows,
    ready,
    skipped: rows.filter((row) => row.status === 'skip').length,
    adjusted: rows.filter((row) => row.status === 'ok' && row.notes.length > 0).length,
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Column headers of exported files. They are also recognised by `guessField`, so exports re-import cleanly. */
export const EXPORT_HEADERS = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น'] as const

export function studentsToRows(students: readonly Student[]): (string | number)[][] {
  return [
    [...EXPORT_HEADERS],
    ...students.map((student) => [
      student.number,
      student.studentCode,
      student.firstName,
      student.lastName,
      student.nickname,
    ]),
  ]
}

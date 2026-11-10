import { describe, expect, it } from 'vitest'

import type { Student } from '@/data/types'

import {
  detectHeaderRow,
  guessField,
  guessMapping,
  normalizeTable,
  parsePastedText,
  parseStudentRows,
  splitFullName,
  stripNamePrefix,
  studentsToRows,
  type ImportField,
} from './importMapping'
import { STUDENT_LIMITS } from './validation'

function student(partial: Partial<Student>): Student {
  return {
    id: partial.id ?? `id-${partial.number ?? 0}`,
    schoolId: null,
    classroomId: 'c1',
    studentCode: '',
    number: 1,
    firstName: 'ทดสอบ',
    lastName: '',
    nickname: '',
    avatar: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('guessField', () => {
  it.each<[string, ImportField | null]>([
    ['เลขที่', 'number'],
    ['ลำดับที่', 'number'],
    ['No.', 'number'],
    ['รหัสนักเรียน', 'studentCode'],
    ['เลขประจำตัวนักเรียน', 'studentCode'],
    ['Student ID', 'studentCode'],
    ['คำนำหน้า', 'prefix'],
    ['ชื่อ', 'firstName'],
    ['First Name', 'firstName'],
    ['นามสกุล', 'lastName'],
    ['ชื่อ - นามสกุล', 'fullName'],
    ['ชื่อ-สกุล', 'fullName'],
    ['ชื่อเล่น', 'nickname'],
    ['Nickname', 'nickname'],
    ['หมายเหตุ', null],
    ['', null],
  ])('maps %j to %j', (header, expected) => {
    expect(guessField(header)).toBe(expected)
  })
})

describe('normalizeTable', () => {
  it('cleans cells, drops empty rows and squares the table', () => {
    const table = normalizeTable([
      ['  ก  ', null, ''],
      ['', '', ''],
      ['ข​', 2],
      [],
    ])
    expect(table).toEqual([
      ['ก', ''],
      ['ข', '2'],
    ])
  })
})

describe('parsePastedText', () => {
  it('reads one name per line', () => {
    expect(parsePastedText('สมชาย ใจดี\n\nสมหญิง รักเรียน\r\n')).toEqual([['สมชาย ใจดี'], ['สมหญิง รักเรียน']])
  })

  it('splits tab-separated cells copied from Excel', () => {
    expect(parsePastedText('1\tสมชาย\tใจดี\n2\tสมหญิง\tรักเรียน')).toEqual([
      ['1', 'สมชาย', 'ใจดี'],
      ['2', 'สมหญิง', 'รักเรียน'],
    ])
  })

  it('falls back to commas when there are no tabs', () => {
    expect(parsePastedText('1,สมชาย\n2,สมหญิง')).toEqual([
      ['1', 'สมชาย'],
      ['2', 'สมหญิง'],
    ])
  })
})

describe('detectHeaderRow', () => {
  it('finds the header below title rows', () => {
    const table = normalizeTable([
      ['รายชื่อนักเรียนชั้น ป.5/1', '', ''],
      ['เลขที่', 'ชื่อ', 'นามสกุล'],
      ['1', 'สมชาย', 'ใจดี'],
    ])
    expect(detectHeaderRow(table)).toBe(1)
  })

  it('returns -1 for a bare list of names', () => {
    expect(detectHeaderRow(normalizeTable([['สมชาย ใจดี'], ['สมหญิง รักเรียน']]))).toBe(-1)
  })
})

describe('guessMapping', () => {
  it('uses the header row', () => {
    const table = normalizeTable([
      ['เลขที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'หมายเหตุ'],
      ['1', '10001', 'สมชาย', 'ใจดี', 'ชาย', ''],
    ])
    expect(guessMapping(table, 0)).toEqual(['number', 'studentCode', 'firstName', 'lastName', 'nickname', 'ignore'])
  })

  it('treats "ชื่อสกุล" beside "ชื่อ" as the last name', () => {
    const table = normalizeTable([
      ['ชื่อ', 'ชื่อสกุล'],
      ['สมชาย', 'ใจดี'],
    ])
    expect(guessMapping(table, 0)).toEqual(['firstName', 'lastName'])
  })

  it('infers columns from the data when there is no header', () => {
    const table = normalizeTable([
      ['1', '10231', 'สมชาย ใจดี'],
      ['2', '10232', 'สมหญิง รักเรียน'],
      ['3', '10233', 'มานะ อดทน'],
    ])
    expect(guessMapping(table, -1)).toEqual(['number', 'studentCode', 'fullName'])
  })

  it('maps a single text column to the full name', () => {
    expect(guessMapping(normalizeTable([['สมชาย'], ['สมหญิง']]), -1)).toEqual(['fullName'])
  })

  it('maps separate first/last name columns when cells hold single words', () => {
    const table = normalizeTable([
      ['สมชาย', 'ใจดี', 'ชาย'],
      ['สมหญิง', 'รักเรียน', 'หญิง'],
    ])
    expect(guessMapping(table, -1)).toEqual(['firstName', 'lastName', 'nickname'])
  })
})

describe('stripNamePrefix', () => {
  it.each([
    ['เด็กชายกิตติพงษ์', 'กิตติพงษ์'],
    ['เด็กหญิง กานดา', 'กานดา'],
    ['ด.ช.ธนกร', 'ธนกร'],
    ['ด.ญ. พิมพ์ชนก', 'พิมพ์ชนก'],
    ['นางสาวสมหญิง', 'สมหญิง'],
    ['นายสมชาย', 'สมชาย'],
    ['น.ส.อรุณี', 'อรุณี'],
    ['Mr. John', 'John'],
    ['Miss Jane', 'Jane'],
  ])('strips %j → %j', (input, expected) => {
    expect(stripNamePrefix(input)).toBe(expected)
  })

  it.each(['นายิกา', 'สมชาย', 'Mrinal', 'Missy', 'นาย'])('leaves %j untouched', (name) => {
    expect(stripNamePrefix(name)).toBe(name)
  })
})

describe('splitFullName', () => {
  it('splits on the first space only', () => {
    expect(splitFullName('ปวีณา ณ อยุธยา')).toEqual(['ปวีณา', 'ณ อยุธยา'])
    expect(splitFullName('มานี')).toEqual(['มานี', ''])
  })
})

describe('parseStudentRows', () => {
  const header = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชื่อเล่น']
  const mapping: ImportField[] = ['number', 'studentCode', 'fullName', 'nickname']

  it('parses a typical Thai roster', () => {
    const table = normalizeTable([
      header,
      ['1', '00123', 'เด็กชายกิตติพงษ์ ใจดี', 'กิต'],
      ['2', '00124', 'เด็กหญิงกานดา รักเรียน', 'ดา'],
    ])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing: [] })
    expect(result.ready).toEqual([
      { number: 1, studentCode: '00123', firstName: 'กิตติพงษ์', lastName: 'ใจดี', nickname: 'กิต' },
      { number: 2, studentCode: '00124', firstName: 'กานดา', lastName: 'รักเรียน', nickname: 'ดา' },
    ])
    expect(result.skipped).toBe(0)
    expect(result.adjusted).toBe(0)
  })

  it('keeps the prefix when stripping is off', () => {
    const table = normalizeTable([header, ['1', '', 'เด็กชายกิตติพงษ์ ใจดี', '']])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: false, existing: [] })
    expect(result.ready[0]?.firstName).toBe('เด็กชายกิตติพงษ์')
  })

  it('skips rows without a name and reports why', () => {
    const table = normalizeTable([header, ['1', '111', '', 'x'], ['2', '112', 'มานะ อดทน', '']])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing: [] })
    expect(result.ready).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ rowNumber: 2, status: 'skip', reason: 'ไม่มีชื่อ' })
  })

  it('assigns free roll numbers when they are missing, invalid or taken', () => {
    const table = normalizeTable([
      header,
      ['2', '', 'หนึ่ง ก', ''],
      ['', '', 'สอง ข', ''],
      ['2', '', 'สาม ค', ''],
      ['abc', '', 'สี่ ง', ''],
    ])
    const existing = [student({ number: 1, firstName: 'เดิม' })]
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing })
    expect(result.ready.map((row) => row.number)).toEqual([2, 3, 4, 5])
    // A missing number is filled silently; a conflicting one is reported.
    expect(result.rows[1]?.notes).toEqual([])
    expect(result.rows[2]?.notes[0]).toContain('เลขที่ "2"')
    expect(result.adjusted).toBe(2)
  })

  it('never produces duplicate roll numbers', () => {
    const rows = Array.from({ length: 30 }, (_unused, index) => [String((index % 5) + 1), '', `คน${index} ก`, ''])
    const result = parseStudentRows(normalizeTable([header, ...rows]), {
      headerIndex: 0,
      mapping,
      stripPrefix: true,
      existing: [],
    })
    const numbers = result.ready.map((row) => row.number)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('skips students that are already in the classroom', () => {
    const existing = [
      student({ number: 1, studentCode: 'A100', firstName: 'มานี', lastName: 'มีตา' }),
      student({ number: 2, firstName: 'ปิติ', lastName: 'พอใจ' }),
    ]
    const table = normalizeTable([
      header,
      ['5', 'a100', 'ชื่อใหม่ สกุลใหม่', ''],
      ['6', '', 'ปิติ พอใจ', ''],
      ['7', '', 'ชูใจ เลิศล้ำ', ''],
    ])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing })
    expect(result.ready.map((row) => row.firstName)).toEqual(['ชูใจ'])
    expect(result.rows[0]?.reason).toContain('รหัสนักเรียน')
    expect(result.rows[1]?.reason).toBe('มีชื่อนี้อยู่แล้ว')
  })

  it('skips duplicates inside the same file', () => {
    const table = normalizeTable([header, ['1', '', 'มานะ อดทน', ''], ['2', '', 'มานะ อดทน', '']])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing: [] })
    expect(result.ready).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('blanks an invalid student code but still imports the row', () => {
    const table = normalizeTable([header, ['1', 'รหัส ๑๒๓', 'มานะ อดทน', '']])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing: [] })
    expect(result.ready[0]?.studentCode).toBe('')
    expect(result.rows[0]?.notes[0]).toContain('รหัสนักเรียน')
  })

  it('enforces the classroom capacity', () => {
    const existing = Array.from({ length: STUDENT_LIMITS.perClassroom - 1 }, (_unused, index) =>
      student({ id: `s${index}`, number: index + 1, firstName: `เดิม${index}` }),
    )
    const table = normalizeTable([header, ['', '', 'ใหม่หนึ่ง ก', ''], ['', '', 'ใหม่สอง ข', '']])
    const result = parseStudentRows(table, { headerIndex: 0, mapping, stripPrefix: true, existing })
    expect(result.ready).toHaveLength(1)
    expect(result.rows[1]?.reason).toContain('เกินจำนวนสูงสุด')
  })

  it('reads separate first and last name columns', () => {
    const table = normalizeTable([
      ['ชื่อ', 'นามสกุล'],
      ['ด.ช.ธนกร', 'ใจดี'],
    ])
    const result = parseStudentRows(table, {
      headerIndex: 0,
      mapping: ['firstName', 'lastName'],
      stripPrefix: true,
      existing: [],
    })
    expect(result.ready[0]).toMatchObject({ firstName: 'ธนกร', lastName: 'ใจดี', number: 1 })
  })
})

describe('studentsToRows', () => {
  it('produces rows that import back to the same students', () => {
    const students = [
      student({ number: 1, studentCode: '00123', firstName: 'กิตติพงษ์', lastName: 'ใจดี', nickname: 'กิต' }),
      student({ number: 2, firstName: 'กานดา', lastName: 'ณ อยุธยา' }),
    ]
    const table = normalizeTable(studentsToRows(students))
    const headerIndex = detectHeaderRow(table)
    const result = parseStudentRows(table, {
      headerIndex,
      mapping: guessMapping(table, headerIndex),
      stripPrefix: true,
      existing: [],
    })
    expect(result.ready).toEqual(
      students.map(({ number, studentCode, firstName, lastName, nickname }) => ({
        number,
        studentCode,
        firstName,
        lastName,
        nickname,
      })),
    )
  })
})

import { describe, expect, it } from 'vitest'

import type { Classroom, Student } from '@/data/types'

import { STUDENT_LIMITS, validateClassroom, validateStudent } from './validation'

const classroom: Classroom = {
  id: 'c1',
  schoolId: null,
  ownerId: null,
  name: 'ป.5/1',
  gradeLevel: '',
  academicYear: '2569',
  color: 'violet',
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function student(partial: Partial<Student>): Student {
  return {
    id: 's1',
    schoolId: null,
    classroomId: 'c1',
    studentCode: '',
    number: 1,
    firstName: 'มานี',
    lastName: 'มีตา',
    nickname: '',
    avatar: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('validateClassroom', () => {
  it('trims and accepts valid input', () => {
    const result = validateClassroom({ name: '  ป.6/2  ', gradeLevel: ' ป.6 ', academicYear: '2569', color: 'cyan' }, [])
    expect(result).toEqual({
      ok: true,
      value: { name: 'ป.6/2', gradeLevel: 'ป.6', academicYear: '2569', color: 'cyan', isDemo: undefined },
    })
  })

  it('requires a name', () => {
    const result = validateClassroom({ name: '   ', gradeLevel: '', academicYear: '', color: 'cyan' }, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.name).toBeTruthy()
  })

  it('rejects a duplicate name in the same academic year, ignoring case and spacing', () => {
    const result = validateClassroom({ name: ' ป.5/1 ', gradeLevel: '', academicYear: '2569', color: 'pink' }, [classroom])
    expect(result.ok).toBe(false)
  })

  it('allows the same name in another year, and editing a classroom without renaming it', () => {
    expect(
      validateClassroom({ name: 'ป.5/1', gradeLevel: '', academicYear: '2570', color: 'pink' }, [classroom]).ok,
    ).toBe(true)
    expect(
      validateClassroom({ name: 'ป.5/1', gradeLevel: '', academicYear: '2569', color: 'pink' }, [classroom], 'c1').ok,
    ).toBe(true)
  })

  it('validates the academic year and name length', () => {
    const year = validateClassroom({ name: 'ก', gradeLevel: '', academicYear: '69', color: 'cyan' }, [])
    expect(year.ok).toBe(false)
    const long = validateClassroom(
      { name: 'ก'.repeat(STUDENT_LIMITS.classroomName + 1), gradeLevel: '', academicYear: '', color: 'cyan' },
      [],
    )
    expect(long.ok).toBe(false)
  })

  it('counts Thai combining marks as part of one character', () => {
    // 40 graphemes, 80 code units — must still fit the limit.
    const name = 'กี่'.repeat(STUDENT_LIMITS.classroomName / 2) + 'ก'.repeat(STUDENT_LIMITS.classroomName / 2)
    expect(validateClassroom({ name, gradeLevel: '', academicYear: '', color: 'cyan' }, []).ok).toBe(true)
  })
})

describe('validateStudent', () => {
  const base = { studentCode: '', number: 2, firstName: 'ปิติ', lastName: 'พอใจ', nickname: 'ติ' }

  it('accepts and normalises valid input', () => {
    const result = validateStudent({ ...base, firstName: '  ปิติ ', studentCode: ' A-102 ' }, [student({})])
    expect(result).toEqual({ ok: true, value: { ...base, studentCode: 'A-102' } })
  })

  it('requires a first name', () => {
    const result = validateStudent({ ...base, firstName: '' }, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.firstName).toBeTruthy()
  })

  it('rejects a roll number that is taken, out of range or not an integer', () => {
    expect(validateStudent({ ...base, number: 1 }, [student({ number: 1 })]).ok).toBe(false)
    expect(validateStudent({ ...base, number: 0 }, []).ok).toBe(false)
    expect(validateStudent({ ...base, number: 1000 }, []).ok).toBe(false)
    expect(validateStudent({ ...base, number: 1.5 }, []).ok).toBe(false)
    expect(validateStudent({ ...base, number: Number.NaN }, []).ok).toBe(false)
  })

  it('lets a student keep their own number and code when edited', () => {
    const self = student({ id: 'me', number: 7, studentCode: 'X1' })
    const result = validateStudent({ ...base, number: 7, studentCode: 'X1' }, [self], 'me')
    expect(result.ok).toBe(true)
  })

  it('rejects duplicate or malformed student codes', () => {
    expect(validateStudent({ ...base, studentCode: 'x1' }, [student({ studentCode: 'X1' })]).ok).toBe(false)
    expect(validateStudent({ ...base, studentCode: 'รหัส 1' }, []).ok).toBe(false)
    expect(validateStudent({ ...base, studentCode: '1'.repeat(STUDENT_LIMITS.studentCode + 1) }, []).ok).toBe(false)
  })

  it('reports every invalid field at once', () => {
    const result = validateStudent({ studentCode: '!!', number: -1, firstName: '', lastName: '', nickname: '' }, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['firstName', 'number', 'studentCode'])
  })
})

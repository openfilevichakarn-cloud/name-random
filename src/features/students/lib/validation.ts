import {
  CLASSROOM_COLORS,
  type Classroom,
  type ClassroomInput,
  type ID,
  type Student,
  type StudentInput,
} from '@/data/types'

import { cleanText, foldText, graphemeLength } from './text'

export const STUDENT_LIMITS = {
  name: 60,
  nickname: 30,
  studentCode: 20,
  number: { min: 1, max: 999 },
  classroomName: 40,
  gradeLevel: 40,
  /** Hard cap per classroom — keeps the wheel readable and imports sane. */
  perClassroom: 200,
} as const

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors<T> }

// ---------------------------------------------------------------------------
// Classroom
// ---------------------------------------------------------------------------

export function validateClassroom(
  input: ClassroomInput,
  existing: readonly Classroom[],
  /** Id of the classroom being edited, so it does not collide with itself. */
  selfId?: ID,
): ValidationResult<ClassroomInput> {
  const errors: FieldErrors<ClassroomInput> = {}
  const name = cleanText(input.name)
  const gradeLevel = cleanText(input.gradeLevel)
  const academicYear = cleanText(input.academicYear)

  if (!name) errors.name = 'กรุณากรอกชื่อห้องเรียน'
  else if (graphemeLength(name) > STUDENT_LIMITS.classroomName) {
    errors.name = `ชื่อห้องเรียนยาวได้ไม่เกิน ${STUDENT_LIMITS.classroomName} ตัวอักษร`
  } else {
    const duplicate = existing.some(
      (classroom) =>
        classroom.id !== selfId &&
        foldText(classroom.name) === foldText(name) &&
        cleanText(classroom.academicYear) === academicYear,
    )
    if (duplicate) errors.name = 'มีห้องเรียนชื่อนี้ในปีการศึกษาเดียวกันอยู่แล้ว'
  }

  if (graphemeLength(gradeLevel) > STUDENT_LIMITS.gradeLevel) {
    errors.gradeLevel = `ระดับชั้นยาวได้ไม่เกิน ${STUDENT_LIMITS.gradeLevel} ตัวอักษร`
  }

  if (academicYear && !/^\d{4}$/.test(academicYear)) {
    errors.academicYear = 'ปีการศึกษาต้องเป็นตัวเลข 4 หลัก เช่น 2569'
  }

  if (!CLASSROOM_COLORS.includes(input.color)) errors.color = 'กรุณาเลือกสีของห้องเรียน'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { name, gradeLevel, academicYear, color: input.color, isDemo: input.isDemo } }
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

const STUDENT_CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._/-]*$/

/** Editable student fields (the classroom and avatar are handled separately). */
export type StudentFields = Pick<StudentInput, 'studentCode' | 'number' | 'firstName' | 'lastName' | 'nickname'>

export function validateStudent(
  input: StudentFields,
  /** Other students in the same classroom, used for the uniqueness checks. */
  classmates: readonly Student[],
  selfId?: ID,
): ValidationResult<StudentFields> {
  const errors: FieldErrors<StudentFields> = {}
  const firstName = cleanText(input.firstName)
  const lastName = cleanText(input.lastName)
  const nickname = cleanText(input.nickname)
  const studentCode = cleanText(input.studentCode)
  const others = classmates.filter((student) => student.id !== selfId)

  if (!firstName) errors.firstName = 'กรุณากรอกชื่อ'
  else if (graphemeLength(firstName) > STUDENT_LIMITS.name) {
    errors.firstName = `ชื่อยาวได้ไม่เกิน ${STUDENT_LIMITS.name} ตัวอักษร`
  }

  if (graphemeLength(lastName) > STUDENT_LIMITS.name) {
    errors.lastName = `นามสกุลยาวได้ไม่เกิน ${STUDENT_LIMITS.name} ตัวอักษร`
  }

  if (graphemeLength(nickname) > STUDENT_LIMITS.nickname) {
    errors.nickname = `ชื่อเล่นยาวได้ไม่เกิน ${STUDENT_LIMITS.nickname} ตัวอักษร`
  }

  if (studentCode) {
    if (studentCode.length > STUDENT_LIMITS.studentCode) {
      errors.studentCode = `รหัสนักเรียนยาวได้ไม่เกิน ${STUDENT_LIMITS.studentCode} ตัวอักษร`
    } else if (!STUDENT_CODE_PATTERN.test(studentCode)) {
      errors.studentCode = 'รหัสนักเรียนใช้ได้เฉพาะตัวเลข ตัวอักษรอังกฤษ และ . - _ /'
    } else if (others.some((student) => foldText(student.studentCode) === foldText(studentCode))) {
      errors.studentCode = 'รหัสนักเรียนนี้มีอยู่ในห้องแล้ว'
    }
  }

  const { min, max } = STUDENT_LIMITS.number
  if (!Number.isInteger(input.number)) errors.number = 'เลขที่ต้องเป็นจำนวนเต็ม'
  else if (input.number < min || input.number > max) errors.number = `เลขที่ต้องอยู่ระหว่าง ${min}–${max}`
  else if (others.some((student) => student.number === input.number)) {
    errors.number = `เลขที่ ${input.number} ถูกใช้แล้ว`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { studentCode, number: input.number, firstName, lastName, nickname } }
}

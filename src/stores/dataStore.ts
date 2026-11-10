import { useMemo } from 'react'
import { create } from 'zustand'

import { getRepository } from '@/data'
import { describeError } from '@/data/repository'
import type { Classroom, ClassroomInput, ID, Student, StudentInput, StudentPatch } from '@/data/types'
import { compareStudents } from '@/features/students/lib/names'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface DataState {
  status: LoadStatus
  error: string | null
  classrooms: Classroom[]
  students: Student[]

  /** Load classrooms and students once. Safe to call from every page. */
  load: () => Promise<void>
  /** Drop the cache and load again (after switching repository or restoring a backup). */
  reload: () => Promise<void>

  createClassroom: (input: ClassroomInput) => Promise<Classroom>
  updateClassroom: (id: ID, patch: Partial<ClassroomInput>) => Promise<Classroom>
  deleteClassroom: (id: ID) => Promise<void>

  addStudents: (inputs: StudentInput[]) => Promise<Student[]>
  updateStudent: (id: ID, patch: StudentPatch) => Promise<Student>
  deleteStudents: (ids: ID[]) => Promise<void>
  /** Replace a classroom's whole roster (import with "replace"). */
  replaceStudents: (classroomId: ID, inputs: StudentInput[]) => Promise<Student[]>
}

let inflight: Promise<void> | null = null

/**
 * Classrooms and students. Writes go to the repository first and only then into the cache,
 * so the UI never shows data that failed to save.
 */
export const useDataStore = create<DataState>()((set, get) => {
  const fetchAll = async () => {
    set({ status: 'loading', error: null })
    try {
      const repository = getRepository()
      const [classrooms, students] = await Promise.all([repository.listClassrooms(), repository.listStudents()])
      set({ status: 'ready', classrooms, students, error: null })
    } catch (error) {
      set({ status: 'error', error: describeError(error, 'โหลดข้อมูลไม่สำเร็จ') })
    }
  }

  return {
    status: 'idle',
    error: null,
    classrooms: [],
    students: [],

    load: () => {
      if (get().status === 'ready') return Promise.resolve()
      inflight ??= fetchAll().finally(() => {
        inflight = null
      })
      return inflight
    },

    reload: () => {
      inflight = fetchAll().finally(() => {
        inflight = null
      })
      return inflight
    },

    createClassroom: async (input) => {
      const classroom = await getRepository().createClassroom(input)
      set((state) => ({ classrooms: [...state.classrooms, classroom] }))
      return classroom
    },

    updateClassroom: async (id, patch) => {
      const classroom = await getRepository().updateClassroom(id, patch)
      set((state) => ({ classrooms: state.classrooms.map((item) => (item.id === id ? classroom : item)) }))
      return classroom
    },

    deleteClassroom: async (id) => {
      await getRepository().deleteClassroom(id)
      set((state) => ({
        classrooms: state.classrooms.filter((item) => item.id !== id),
        students: state.students.filter((student) => student.classroomId !== id),
      }))
    },

    addStudents: async (inputs) => {
      const created = await getRepository().createStudents(inputs)
      set((state) => ({ students: [...state.students, ...created] }))
      return created
    },

    updateStudent: async (id, patch) => {
      const student = await getRepository().updateStudent(id, patch)
      set((state) => ({ students: state.students.map((item) => (item.id === id ? student : item)) }))
      return student
    },

    deleteStudents: async (ids) => {
      await getRepository().deleteStudents(ids)
      const removed = new Set(ids)
      set((state) => ({ students: state.students.filter((student) => !removed.has(student.id)) }))
    },

    replaceStudents: async (classroomId, inputs) => {
      const repository = getRepository()
      const previous = get().students.filter((student) => student.classroomId === classroomId)
      // Create first: if this fails the old roster is still intact.
      const created = await repository.createStudents(inputs)
      await repository.deleteStudents(previous.map((student) => student.id))
      const removed = new Set(previous.map((student) => student.id))
      set((state) => ({ students: [...state.students.filter((student) => !removed.has(student.id)), ...created] }))
      return created
    },
  }
})

/** One classroom by id (undefined while loading or when it does not exist). */
export function useClassroom(id: ID | null | undefined): Classroom | undefined {
  return useDataStore((state) => (id ? state.classrooms.find((classroom) => classroom.id === id) : undefined))
}

/** A classroom's students ordered by roll number. */
export function useClassroomStudents(classroomId: ID | null | undefined): Student[] {
  const students = useDataStore((state) => state.students)
  return useMemo(
    () =>
      classroomId
        ? students.filter((student) => student.classroomId === classroomId).sort((a, b) => compareStudents(a, b))
        : [],
    [students, classroomId],
  )
}

/** Number of students per classroom id. */
export function useStudentCounts(): ReadonlyMap<ID, number> {
  const students = useDataStore((state) => state.students)
  return useMemo(() => {
    const counts = new Map<ID, number>()
    for (const student of students) counts.set(student.classroomId, (counts.get(student.classroomId) ?? 0) + 1)
    return counts
  }, [students])
}

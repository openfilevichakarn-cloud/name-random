import { LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ID, Student } from '@/data/types'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { fieldAria } from '@/lib/fieldAria'
import { useClassroomStudents, useDataStore } from '@/stores/dataStore'

import { randomBotAvatar } from '../lib/avatar'
import { nextFreeNumber } from '../lib/names'
import { STUDENT_LIMITS, validateStudent, type FieldErrors, type StudentFields } from '../lib/validation'
import { AvatarPicker } from './AvatarPicker'

interface StudentFormProps {
  classroomId: ID
  student?: Student
  onClose: () => void
  /** Called after "save and add another" so the dialog can mount a fresh form. */
  onAddAnother: () => void
}

function StudentForm({ classroomId, student, onClose, onAddAnother }: StudentFormProps) {
  const classmates = useClassroomStudents(classroomId)
  const addStudents = useDataStore((state) => state.addStudents)
  const updateStudent = useDataStore((state) => state.updateStudent)
  const { run, pending } = useAsyncAction()
  const submitMode = useRef<'close' | 'another'>('close')
  const formRef = useRef<HTMLFormElement>(null)
  const firstNameRef = useRef<HTMLInputElement>(null)

  // Typing a roster starts with the name: focus it when the form mounts (dialog open or "add another").
  useEffect(() => {
    firstNameRef.current?.focus()
  }, [])

  const suggestedNumber = useMemo(
    () => nextFreeNumber(classmates.map((classmate) => classmate.number)),
    [classmates],
  )
  const [avatar, setAvatar] = useState(() => student?.avatar || randomBotAvatar())
  const [number, setNumber] = useState(String(student?.number ?? suggestedNumber))
  const [studentCode, setStudentCode] = useState(student?.studentCode ?? '')
  const [firstName, setFirstName] = useState(student?.firstName ?? '')
  const [lastName, setLastName] = useState(student?.lastName ?? '')
  const [nickname, setNickname] = useState(student?.nickname ?? '')
  const [errors, setErrors] = useState<FieldErrors<StudentFields>>({})

  const isFull = !student && classmates.length >= STUDENT_LIMITS.perClassroom

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsedNumber = /^\d+$/.test(number.trim()) ? Number(number.trim()) : Number.NaN
    const result = validateStudent(
      { studentCode, number: parsedNumber, firstName, lastName, nickname },
      classmates,
      student?.id,
    )
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    const mode = submitMode.current
    void run(
      async () => {
        if (student) await updateStudent(student.id, { ...result.value, avatar })
        else await addStudents([{ classroomId, ...result.value, avatar }])
        if (mode === 'another') onAddAnother()
        else onClose()
      },
      { success: student ? 'บันทึกข้อมูลนักเรียนแล้ว' : `เพิ่ม ${result.value.firstName} แล้ว` },
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="flex items-start gap-4">
        <AvatarPicker value={avatar} seed={student?.id ?? 'new'} onChange={setAvatar} />
        <div className="grid flex-1 grid-cols-[6rem_1fr] gap-3">
          <FormField label="เลขที่" htmlFor="student-number" error={errors.number} required>
            <Input
              {...fieldAria('student-number', errors.number)}
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="numeric"
              maxLength={3}
              autoComplete="off"
              required
            />
          </FormField>
          <FormField label="รหัสนักเรียน" htmlFor="student-code" error={errors.studentCode}>
            <Input
              {...fieldAria('student-code', errors.studentCode)}
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value)}
              maxLength={STUDENT_LIMITS.studentCode}
              autoComplete="off"
              placeholder="ไม่บังคับ"
            />
          </FormField>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="ชื่อ" htmlFor="student-first-name" error={errors.firstName} required>
          <Input
            {...fieldAria('student-first-name', errors.firstName)}
            ref={firstNameRef}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="off"
            required
          />
        </FormField>
        <FormField label="นามสกุล" htmlFor="student-last-name" error={errors.lastName}>
          <Input
            {...fieldAria('student-last-name', errors.lastName)}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="off"
          />
        </FormField>
      </div>
      <FormField
        label="ชื่อเล่น"
        htmlFor="student-nickname"
        error={errors.nickname}
        hint="ใช้แสดงบนเวทีสุ่ม หากเว้นว่างจะใช้ชื่อจริง"
      >
        <Input
          {...fieldAria('student-nickname', errors.nickname, 'hint')}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="off"
        />
      </FormField>

      {isFull ? (
        <p role="alert" className="rounded-xl border border-neon-gold/40 bg-neon-gold/10 px-3 py-2 text-sm text-neon-gold">
          ห้องนี้มีนักเรียนครบ {STUDENT_LIMITS.perClassroom} คนแล้ว ไม่สามารถเพิ่มได้อีก
        </p>
      ) : null}

      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          ยกเลิก
        </Button>
        {student ? null : (
          // Not a submit button on purpose: the only submit button below is what Enter triggers.
          <Button
            type="button"
            variant="secondary"
            disabled={pending || isFull}
            onClick={() => {
              submitMode.current = 'close'
              formRef.current?.requestSubmit()
            }}
          >
            บันทึกและปิด
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending || isFull}
          onClick={() => {
            submitMode.current = student ? 'close' : 'another'
          }}
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {student ? 'บันทึก' : 'บันทึกและเพิ่มคนถัดไป'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface StudentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classroomId: ID
  /** Pass a student to edit; omit to add a new one. */
  student?: Student
}

export function StudentFormDialog({ open, onOpenChange, classroomId, student }: StudentFormDialogProps) {
  // Bumping the key remounts the form: empty fields, next free number, focus back on the name.
  const [formKey, setFormKey] = useState(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form focuses its own name field, so Radix must not move focus to the first control. */}
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{student ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'}</DialogTitle>
          <DialogDescription>
            {student ? 'แก้ไขแล้วกดบันทึก' : 'กด Enter เพื่อบันทึกแล้วกรอกคนถัดไปได้ทันที'}
          </DialogDescription>
        </DialogHeader>
        <StudentForm
          key={formKey}
          classroomId={classroomId}
          student={student}
          onClose={() => onOpenChange(false)}
          onAddAnother={() => setFormKey((key) => key + 1)}
        />
      </DialogContent>
    </Dialog>
  )
}

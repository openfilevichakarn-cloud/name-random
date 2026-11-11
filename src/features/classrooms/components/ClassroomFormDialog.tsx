import { Check, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CLASSROOM_COLORS, type Classroom, type ClassroomColor, type ClassroomInput } from '@/data/types'
import { validateClassroom, type FieldErrors } from '@/features/students/lib/validation'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { fieldAria } from '@/lib/fieldAria'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'

import { CLASSROOM_COLOR_META, currentAcademicYear } from '../lib/colors'

interface ClassroomFormProps {
  classroom?: Classroom
  onDone: (classroom: Classroom) => void
  onCancel: () => void
}

function ClassroomForm({ classroom, onDone, onCancel }: ClassroomFormProps) {
  const classrooms = useDataStore((state) => state.classrooms)
  const createClassroom = useDataStore((state) => state.createClassroom)
  const updateClassroom = useDataStore((state) => state.updateClassroom)
  const { run, pending } = useAsyncAction()

  const [name, setName] = useState(classroom?.name ?? '')
  const [gradeLevel, setGradeLevel] = useState(classroom?.gradeLevel ?? '')
  const [academicYear, setAcademicYear] = useState(classroom?.academicYear ?? currentAcademicYear())
  const [color, setColor] = useState<ClassroomColor>(
    classroom?.color ?? CLASSROOM_COLORS[classrooms.length % CLASSROOM_COLORS.length] ?? 'violet',
  )
  const [errors, setErrors] = useState<FieldErrors<ClassroomInput>>({})

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateClassroom({ name, gradeLevel, academicYear, color }, classrooms, classroom?.id)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    void run(
      async () => {
        const saved = classroom
          ? await updateClassroom(classroom.id, result.value)
          : await createClassroom(result.value)
        onDone(saved)
      },
      { success: classroom ? 'บันทึกห้องเรียนแล้ว' : `สร้างห้อง ${result.value.name} แล้ว` },
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <FormField label="ชื่อห้องเรียน" htmlFor="classroom-name" error={errors.name} required>
        <Input
          {...fieldAria('classroom-name', errors.name)}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="เช่น ป.5/1"
          autoComplete="off"
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <FormField label="ระดับชั้น" htmlFor="classroom-grade" error={errors.gradeLevel}>
          <Input
            {...fieldAria('classroom-grade', errors.gradeLevel)}
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
            placeholder="เช่น ประถมศึกษาปีที่ 5"
            autoComplete="off"
          />
        </FormField>
        <FormField label="ปีการศึกษา" htmlFor="classroom-year" error={errors.academicYear}>
          <Input
            {...fieldAria('classroom-year', errors.academicYear)}
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            inputMode="numeric"
            maxLength={4}
            placeholder="2569"
            autoComplete="off"
          />
        </FormField>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground/90">สีประจำห้อง</legend>
        <div className="flex flex-wrap gap-3">
          {CLASSROOM_COLORS.map((option) => {
            const meta = CLASSROOM_COLOR_META[option]
            const selected = option === color
            return (
              <label key={option} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="classroom-color"
                  value={option}
                  checked={selected}
                  onChange={() => setColor(option)}
                  className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                />
                <span
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-popover',
                    selected ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ backgroundColor: meta.hex, boxShadow: `0 0 18px -4px ${meta.hex}` }}
                >
                  {selected ? <Check className="size-5 text-ink" strokeWidth={3} aria-hidden /> : null}
                </span>
                <span className="sr-only">{meta.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {classroom ? 'บันทึก' : 'สร้างห้องเรียน'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface ClassroomFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass a classroom to edit it; omit to create a new one. */
  classroom?: Classroom
  onSaved?: (classroom: Classroom) => void
}

export function ClassroomFormDialog({ open, onOpenChange, classroom, onSaved }: ClassroomFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{classroom ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}</DialogTitle>
          <DialogDescription>
            {classroom ? 'ปรับชื่อ ระดับชั้น หรือสีประจำห้อง' : 'สร้างห้องก่อน แล้วค่อยเพิ่มรายชื่อนักเรียนในขั้นถัดไป'}
          </DialogDescription>
        </DialogHeader>
        {/* The form lives inside the content, so its state resets every time the dialog opens. */}
        <ClassroomForm
          classroom={classroom}
          onCancel={() => onOpenChange(false)}
          onDone={(saved) => {
            onOpenChange(false)
            onSaved?.(saved)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

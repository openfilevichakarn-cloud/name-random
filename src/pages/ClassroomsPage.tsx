import { FlaskConical, GraduationCap, LoaderCircle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataBoundary } from '@/components/common/DataBoundary'
import { EmptyState } from '@/components/common/EmptyState'
import { GlassCard } from '@/components/common/GlassCard'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { createDemoStudents, DEMO_CLASSROOM } from '@/data/demo'
import type { Classroom, ID, Student } from '@/data/types'
import { ClassroomCard } from '@/features/classrooms/components/ClassroomCard'
import { ClassroomFormDialog } from '@/features/classrooms/components/ClassroomFormDialog'
import { compareStudents } from '@/features/students/lib/names'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useDataStore } from '@/stores/dataStore'

function ClassroomsContent() {
  const navigate = useNavigate()
  const classrooms = useDataStore((state) => state.classrooms)
  const students = useDataStore((state) => state.students)
  const createClassroom = useDataStore((state) => state.createClassroom)
  const addStudents = useDataStore((state) => state.addStudents)
  const deleteClassroom = useDataStore((state) => state.deleteClassroom)
  const { run: runDemo, pending: demoPending } = useAsyncAction()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Classroom | undefined>(undefined)
  const [deleting, setDeleting] = useState<Classroom | null>(null)

  const studentsByClassroom = useMemo(() => {
    const groups = new Map<ID, Student[]>()
    for (const student of students) {
      const group = groups.get(student.classroomId)
      if (group) group.push(student)
      else groups.set(student.classroomId, [student])
    }
    for (const group of groups.values()) group.sort((a, b) => compareStudents(a, b))
    return groups
  }, [students])

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const loadDemo = () =>
    runDemo(
      async () => {
        const classroom = await createClassroom(DEMO_CLASSROOM)
        await addStudents(createDemoStudents(classroom.id))
        void navigate(`/classrooms/${classroom.id}`)
      },
      { success: 'สร้างห้องตัวอย่างแล้ว', error: 'สร้างข้อมูลตัวอย่างไม่สำเร็จ' },
    )

  const deletingCount = deleting ? (studentsByClassroom.get(deleting.id)?.length ?? 0) : 0

  return (
    <>
      <PageHeader
        eyebrow="Student Management"
        title="ห้องเรียน"
        description="สร้างห้องเรียน เพิ่มรายชื่อนักเรียน แล้วนำไปใช้ในสตูดิโอสุ่มได้ทันที"
        actions={
          classrooms.length > 0 ? (
            <Button onClick={openCreate}>
              <Plus aria-hidden />
              เพิ่มห้องเรียน
            </Button>
          ) : null
        }
      />

      {classrooms.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={GraduationCap}
            title="ยังไม่มีห้องเรียน"
            description="เริ่มจากสร้างห้องแรกของคุณ หรือทดลองระบบด้วยห้องตัวอย่างที่มีรายชื่อสมมติ 24 คน (ลบทิ้งได้ทุกเมื่อ)"
          >
            <Button size="lg" onClick={openCreate}>
              <Plus aria-hidden />
              เพิ่มห้องเรียนแรก
            </Button>
            <Button size="lg" variant="secondary" onClick={() => void loadDemo()} disabled={demoPending}>
              {demoPending ? <LoaderCircle className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
              ลองด้วยข้อมูลตัวอย่าง
            </Button>
          </EmptyState>
        </GlassCard>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((classroom) => (
            <li key={classroom.id}>
              <ClassroomCard
                classroom={classroom}
                students={studentsByClassroom.get(classroom.id) ?? []}
                onEdit={(target) => {
                  setEditing(target)
                  setFormOpen(true)
                }}
                onDelete={setDeleting}
              />
            </li>
          ))}
        </ul>
      )}

      <ClassroomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classroom={editing}
        onSaved={(saved) => {
          // A brand-new classroom has no students yet: go straight to its roster.
          if (!editing) void navigate(`/classrooms/${saved.id}`)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`ลบห้อง ${deleting?.name ?? ''}?`}
        description={
          <>
            ห้องเรียนและรายชื่อนักเรียน {deletingCount} คนจะถูกลบถาวร
            ประวัติการสุ่มที่ผ่านมาจะยังคงอยู่ การกระทำนี้ย้อนกลับไม่ได้
          </>
        }
        confirmLabel="ลบห้องเรียน"
        tone="destructive"
        successMessage="ลบห้องเรียนแล้ว"
        onConfirm={async () => {
          if (deleting) await deleteClassroom(deleting.id)
        }}
      />
    </>
  )
}

export default function ClassroomsPage() {
  return (
    <DataBoundary>
      <ClassroomsContent />
    </DataBoundary>
  )
}

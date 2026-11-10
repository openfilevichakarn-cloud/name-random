import {
  ArrowLeft,
  Dices,
  EllipsisVertical,
  FlaskConical,
  Pencil,
  SearchX,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataBoundary } from '@/components/common/DataBoundary'
import { EmptyState } from '@/components/common/EmptyState'
import { GlassCard } from '@/components/common/GlassCard'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Classroom, ID, Student } from '@/data/types'
import { ClassroomFormDialog } from '@/features/classrooms/components/ClassroomFormDialog'
import { toneStyle } from '@/features/classrooms/lib/colors'
import { ExportMenu } from '@/features/students/components/ExportMenu'
import { ImportDialog } from '@/features/students/components/ImportDialog'
import { StudentFormDialog } from '@/features/students/components/StudentFormDialog'
import { StudentTable, type StudentSort } from '@/features/students/components/StudentTable'
import { compareStudents, getFullName, matchesStudent } from '@/features/students/lib/names'
import { useClassroom, useClassroomStudents, useDataStore } from '@/stores/dataStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { poolKey, useStudioStore } from '@/stores/studioStore'

type PendingDelete =
  | { kind: 'student'; student: Student }
  | { kind: 'selection'; ids: ID[] }
  | { kind: 'classroom' }
  | null

interface ClassroomDetailProps {
  classroom: Classroom
}

function ClassroomDetail({ classroom }: ClassroomDetailProps) {
  const navigate = useNavigate()
  const students = useClassroomStudents(classroom.id)
  const deleteStudents = useDataStore((state) => state.deleteStudents)
  const deleteClassroom = useDataStore((state) => state.deleteClassroom)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<StudentSort>({ key: 'number', direction: 'asc' })
  const [selected, setSelected] = useState<ReadonlySet<ID>>(() => new Set())
  const [studentFormOpen, setStudentFormOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)
  const [classroomFormOpen, setClassroomFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)

  const visible = useMemo(() => {
    const filtered = students.filter((student) => matchesStudent(student, query))
    const direction = sort.direction === 'asc' ? 1 : -1
    return filtered.sort((a, b) => compareStudents(a, b, sort.key) * direction)
  }, [students, query, sort])

  // Selection only ever refers to students that still exist.
  const selectedStudents = useMemo(() => students.filter((student) => selected.has(student.id)), [students, selected])

  const toggle = (id: ID, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const student of visible) {
        if (checked) next.add(student.id)
        else next.delete(student.id)
      }
      return next
    })
  }

  const openAdd = () => {
    setEditingStudent(undefined)
    setStudentFormOpen(true)
  }

  /** Open the studio on this classroom. With `onlyIds`, everyone else is taken out of the pool. */
  const openStudio = (onlyIds?: ID[]) => {
    const studio = useStudioStore.getState()
    studio.setClassroom(classroom.id)
    studio.setSource('students')
    if (onlyIds) {
      const { numberMin, numberMax } = useSettingsStore.getState().settings.rules
      const key = poolKey(classroom.id, 'students', numberMin, numberMax)
      studio.restrictTo(
        key,
        students.map((student) => student.id),
        onlyIds,
      )
    }
    void navigate('/studio')
  }

  const meta = [
    classroom.gradeLevel,
    classroom.academicYear ? `ปีการศึกษา ${classroom.academicYear}` : '',
    `นักเรียน ${students.length} คน`,
  ]
    .filter(Boolean)
    .join(' · ')

  const confirmCopy = (() => {
    if (!pendingDelete) return null
    if (pendingDelete.kind === 'student') {
      return {
        title: `ลบ ${getFullName(pendingDelete.student)}?`,
        description: 'นักเรียนคนนี้จะถูกลบออกจากห้อง ประวัติการสุ่มที่ผ่านมาจะยังคงอยู่',
        label: 'ลบนักเรียน',
        success: 'ลบนักเรียนแล้ว',
      }
    }
    if (pendingDelete.kind === 'selection') {
      return {
        title: `ลบนักเรียนที่เลือก ${pendingDelete.ids.length} คน?`,
        description: 'นักเรียนที่เลือกจะถูกลบออกจากห้อง ประวัติการสุ่มที่ผ่านมาจะยังคงอยู่',
        label: `ลบ ${pendingDelete.ids.length} คน`,
        success: `ลบนักเรียน ${pendingDelete.ids.length} คนแล้ว`,
      }
    }
    return {
      title: `ลบห้อง ${classroom.name}?`,
      description: `ห้องเรียนและรายชื่อนักเรียน ${students.length} คนจะถูกลบถาวร ประวัติการสุ่มที่ผ่านมาจะยังคงอยู่ การกระทำนี้ย้อนกลับไม่ได้`,
      label: 'ลบห้องเรียน',
      success: 'ลบห้องเรียนแล้ว',
    }
  })()

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'student') {
      await deleteStudents([pendingDelete.student.id])
    } else if (pendingDelete.kind === 'selection') {
      await deleteStudents(pendingDelete.ids)
      setSelected(new Set())
    } else {
      await deleteClassroom(classroom.id)
      void navigate('/classrooms', { replace: true })
    }
  }

  return (
    <div style={toneStyle(classroom.color)}>
      <Link
        to="/classrooms"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        ห้องเรียนทั้งหมด
      </Link>

      <PageHeader
        eyebrow="Classroom"
        title={
          <span className="flex items-center gap-3">
            <span aria-hidden className="size-4 shrink-0 rounded-full bg-(--tone) shadow-[0_0_14px_var(--tone)]" />
            <span className="min-w-0 break-words">{classroom.name}</span>
          </span>
        }
        description={meta}
        actions={
          <>
            <Button variant="neon" onClick={() => openStudio()} disabled={students.length === 0}>
              <Dices aria-hidden />
              สุ่มห้องนี้
            </Button>
            <Button onClick={openAdd}>
              <UserPlus aria-hidden />
              เพิ่มนักเรียน
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden />
              นำเข้า
            </Button>
            <ExportMenu classroom={classroom} students={students} selected={selectedStudents} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="ตัวเลือกของห้องเรียน">
                  <EllipsisVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setClassroomFormOpen(true)}>
                  <Pencil aria-hidden />
                  แก้ไขห้องเรียน
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete({ kind: 'classroom' })}>
                  <Trash2 aria-hidden />
                  ลบห้องเรียน
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {classroom.isDemo ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-gold/40 bg-neon-gold/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-neon-gold">
            <FlaskConical className="size-5 shrink-0" aria-hidden />
            นี่คือข้อมูลตัวอย่าง รายชื่อทั้งหมดเป็นชื่อสมมติ ไม่ใช่นักเรียนจริง
          </p>
          <Button variant="outline" size="sm" onClick={() => setPendingDelete({ kind: 'classroom' })}>
            <Trash2 aria-hidden />
            ลบข้อมูลตัวอย่าง
          </Button>
        </div>
      ) : null}

      <GlassCard className="p-0 sm:p-0">
        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="ยังไม่มีนักเรียนในห้องนี้"
            description="เพิ่มทีละคน หรือนำเข้าทั้งห้องจากไฟล์ Excel/CSV ได้ในครั้งเดียว"
          >
            <Button size="lg" onClick={openAdd}>
              <UserPlus aria-hidden />
              เพิ่มนักเรียน
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden />
              นำเข้าจาก Excel
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <SearchInput
                value={query}
                onChange={setQuery}
                label="ค้นหานักเรียน"
                placeholder="ค้นหาชื่อ ชื่อเล่น เลขที่ หรือรหัส"
                className="sm:max-w-sm"
              />
              {selectedStudents.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 py-1.5 pr-1.5 pl-3"
                  role="status"
                >
                  <span className="text-sm font-semibold text-neon-cyan">เลือก {selectedStudents.length} คน</span>
                  <Button size="sm" onClick={() => openStudio(selectedStudents.map((student) => student.id))}>
                    <Dices aria-hidden />
                    สุ่มเฉพาะกลุ่มนี้
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingDelete({ kind: 'selection', ids: selectedStudents.map((s) => s.id) })}
                  >
                    <Trash2 aria-hidden />
                    ลบที่เลือก
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelected(new Set())} aria-label="ยกเลิกการเลือก">
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {query ? `พบ ${visible.length} จาก ${students.length} คน` : `ทั้งหมด ${students.length} คน`}
                </p>
              )}
            </div>
            <StudentTable
              students={visible}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              sort={sort}
              onSortChange={setSort}
              onEdit={(student) => {
                setEditingStudent(student)
                setStudentFormOpen(true)
              }}
              onDelete={(student) => setPendingDelete({ kind: 'student', student })}
              emptyState={
                <EmptyState icon={SearchX} title="ไม่พบนักเรียนที่ค้นหา" description={`ไม่มีรายชื่อที่ตรงกับ “${query}”`}>
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    ล้างคำค้นหา
                  </Button>
                </EmptyState>
              }
            />
          </>
        )}
      </GlassCard>

      <StudentFormDialog
        open={studentFormOpen}
        onOpenChange={setStudentFormOpen}
        classroomId={classroom.id}
        student={editingStudent}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} classroom={classroom} existing={students} />
      <ClassroomFormDialog open={classroomFormOpen} onOpenChange={setClassroomFormOpen} classroom={classroom} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={confirmCopy?.title ?? ''}
        description={confirmCopy?.description ?? ''}
        confirmLabel={confirmCopy?.label ?? 'ลบ'}
        tone="destructive"
        successMessage={confirmCopy?.success}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

function ClassroomDetailRoute() {
  const { classroomId } = useParams()
  const classroom = useClassroom(classroomId)

  if (!classroom) {
    return (
      <GlassCard className="mx-auto max-w-xl">
        <EmptyState icon={SearchX} title="ไม่พบห้องเรียนนี้" description="ห้องเรียนอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง">
          <Button asChild>
            <Link to="/classrooms">กลับไปหน้าห้องเรียน</Link>
          </Button>
        </EmptyState>
      </GlassCard>
    )
  }

  // Keyed by id so search, sort and selection reset when switching classrooms.
  return <ClassroomDetail key={classroom.id} classroom={classroom} />
}

export default function ClassroomDetailPage() {
  return (
    <DataBoundary>
      <ClassroomDetailRoute />
    </DataBoundary>
  )
}

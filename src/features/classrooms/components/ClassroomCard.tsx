import { ArrowRight, EllipsisVertical, FlaskConical, Pencil, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router'

import { GlassCard } from '@/components/common/GlassCard'
import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Classroom, Student } from '@/data/types'

import { toneStyle } from '../lib/colors'

const PREVIEW_COUNT = 6

interface ClassroomCardProps {
  classroom: Classroom
  /** The classroom's students, ordered by roll number. */
  students: readonly Student[]
  onEdit: (classroom: Classroom) => void
  onDelete: (classroom: Classroom) => void
}

export function ClassroomCard({ classroom, students, onEdit, onDelete }: ClassroomCardProps) {
  const preview = students.slice(0, PREVIEW_COUNT)
  const rest = students.length - preview.length
  const meta = [classroom.gradeLevel, classroom.academicYear ? `ปีการศึกษา ${classroom.academicYear}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <GlassCard
      interactive
      style={toneStyle(classroom.color)}
      className="group relative flex h-full flex-col gap-4 overflow-hidden"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-(--tone) shadow-[0_0_18px_var(--tone)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold">
            {/* The stretched link makes the whole card clickable while the menu stays reachable. */}
            <Link
              to={`/classrooms/${classroom.id}`}
              className="rounded-md outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {classroom.name}
            </Link>
          </h3>
          {meta ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta}</p> : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10 -mt-1 -mr-2 shrink-0"
              aria-label={`ตัวเลือกของห้อง ${classroom.name}`}
            >
              <EllipsisVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(classroom)}>
              <Pencil aria-hidden />
              แก้ไขห้องเรียน
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(classroom)}>
              <Trash2 aria-hidden />
              ลบห้องเรียน
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {classroom.isDemo ? (
        <Badge variant="gold">
          <FlaskConical aria-hidden />
          ข้อมูลตัวอย่าง
        </Badge>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 text-(--tone)" aria-hidden />
            นักเรียน
          </p>
          <p className="tabular text-4xl leading-tight font-extrabold text-(--tone)">{students.length}</p>
        </div>
        {preview.length > 0 ? (
          <div className="flex items-center" aria-hidden>
            {preview.map((student) => (
              <StudentAvatar
                key={student.id}
                avatar={student.avatar}
                seed={student.id}
                className="-ml-2 size-9 ring-2 ring-surface first:ml-0"
              />
            ))}
            {rest > 0 ? (
              <span className="tabular -ml-2 flex h-9 min-w-9 items-center justify-center rounded-[28%] bg-muted px-1.5 text-xs font-semibold ring-2 ring-surface">
                +{rest}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">ยังไม่มีรายชื่อ</span>
        )}
      </div>

      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--tone)">
        เปิดรายชื่อ
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </GlassCard>
  )
}

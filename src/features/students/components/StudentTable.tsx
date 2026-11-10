import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Hint } from '@/components/ui/tooltip'
import type { ID, Student } from '@/data/types'
import { cn } from '@/lib/utils'

import { getFullName, type StudentSortKey } from '../lib/names'

export interface StudentSort {
  key: StudentSortKey
  direction: 'asc' | 'desc'
}

interface SortHeaderProps {
  label: string
  sortKey: StudentSortKey
  sort: StudentSort
  onSortChange: (sort: StudentSort) => void
  className?: string
}

function SortHeader({ label, sortKey, sort, onSortChange, className }: SortHeaderProps) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() =>
          onSortChange({ key: sortKey, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })
        }
        className={cn(
          'hud-label -mx-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 outline-none transition-colors',
          'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-neon-cyan',
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  )
}

interface StudentTableProps {
  students: readonly Student[]
  selected: ReadonlySet<ID>
  onToggle: (id: ID, checked: boolean) => void
  /** Select or clear every student currently shown. */
  onToggleAll: (checked: boolean) => void
  sort: StudentSort
  onSortChange: (sort: StudentSort) => void
  onEdit: (student: Student) => void
  onDelete: (student: Student) => void
  /** Rendered instead of the rows when `students` is empty. */
  emptyState?: ReactNode
}

export function StudentTable({
  students,
  selected,
  onToggle,
  onToggleAll,
  sort,
  onSortChange,
  onEdit,
  onDelete,
  emptyState,
}: StudentTableProps) {
  const selectedHere = students.filter((student) => selected.has(student.id)).length
  const allSelected = students.length > 0 && selectedHere === students.length
  const headerState = allSelected ? true : selectedHere > 0 ? 'indeterminate' : false

  if (students.length === 0) return emptyState ?? null

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-4 sm:w-12 sm:pl-6">
            <Checkbox
              checked={headerState}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
              aria-label="เลือกนักเรียนทั้งหมดที่แสดง"
            />
          </TableHead>
          <SortHeader label="เลขที่" sortKey="number" sort={sort} onSortChange={onSortChange} className="w-14 sm:w-20" />
          <SortHeader label="ชื่อ-นามสกุล" sortKey="name" sort={sort} onSortChange={onSortChange} />
          <SortHeader
            label="ชื่อเล่น"
            sortKey="nickname"
            sort={sort}
            onSortChange={onSortChange}
            className="hidden sm:table-cell"
          />
          <SortHeader
            label="รหัสนักเรียน"
            sortKey="studentCode"
            sort={sort}
            onSortChange={onSortChange}
            className="hidden md:table-cell"
          />
          <TableHead className="w-20 pr-3 text-right sm:w-24 sm:pr-5">
            <span className="sr-only">การจัดการ</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => {
          const fullName = getFullName(student)
          const isSelected = selected.has(student.id)
          return (
            <TableRow key={student.id} data-state={isSelected ? 'selected' : undefined}>
              <TableCell className="pl-4 sm:pl-6">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onToggle(student.id, checked === true)}
                  aria-label={`เลือก ${fullName}`}
                />
              </TableCell>
              <TableCell className="tabular text-lg font-bold text-neon-cyan">{student.number}</TableCell>
              {/* `w-full max-w-0` lets the name column absorb the free space and truncate instead of overflowing. */}
              <TableCell className="w-full max-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <StudentAvatar avatar={student.avatar} seed={student.id} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{fullName}</p>
                    {student.nickname ? (
                      <p className="truncate text-sm text-muted-foreground sm:hidden">{student.nickname}</p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {student.nickname || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="tabular hidden text-muted-foreground md:table-cell">
                {student.studentCode || '—'}
              </TableCell>
              <TableCell className="pr-3 sm:pr-5">
                <div className="flex justify-end gap-0.5">
                  <Hint label="แก้ไข">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(student)} aria-label={`แก้ไข ${fullName}`}>
                      <Pencil aria-hidden />
                    </Button>
                  </Hint>
                  <Hint label="ลบ">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:bg-destructive/15 hover:text-destructive"
                      onClick={() => onDelete(student)}
                      aria-label={`ลบ ${fullName}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </Hint>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

import { Download, FileSpreadsheet, FileText, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Classroom, Student } from '@/data/types'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { fileTimestamp } from '@/lib/date'
import { safeFileName } from '@/lib/download'
import { downloadTable, type SpreadsheetFormat } from '@/lib/spreadsheet'

import { EXPORT_HEADERS, studentsToRows } from '../lib/importMapping'

const COLUMN_WIDTHS = [8, 16, 22, 24, 14] as const

interface ExportMenuProps {
  classroom: Classroom
  /** All students of the classroom, ordered by roll number. */
  students: readonly Student[]
  /** When some rows are selected, the menu also offers to export only those. */
  selected: readonly Student[]
}

export function ExportMenu({ classroom, students, selected }: ExportMenuProps) {
  const { run, pending } = useAsyncAction()

  const exportStudents = (rows: readonly Student[], format: SpreadsheetFormat, suffix = '') =>
    run(
      () =>
        downloadTable(studentsToRows(rows), {
          filename: safeFileName(`รายชื่อ ${classroom.name}${suffix} ${fileTimestamp()}`),
          format,
          sheetName: classroom.name,
          widths: COLUMN_WIDTHS,
        }),
      { success: `ส่งออก ${rows.length} รายชื่อแล้ว`, error: 'ส่งออกไม่สำเร็จ' },
    )

  const downloadTemplate = () =>
    run(
      () =>
        downloadTable([[...EXPORT_HEADERS]], {
          filename: 'แบบฟอร์มรายชื่อนักเรียน',
          format: 'xlsx',
          sheetName: 'รายชื่อ',
          widths: COLUMN_WIDTHS,
        }),
      { success: 'ดาวน์โหลดแบบฟอร์มแล้ว', error: 'ดาวน์โหลดไม่สำเร็จ' },
    )

  const empty = students.length === 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          ส่งออก
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>ทั้งห้อง ({students.length} คน)</DropdownMenuLabel>
        <DropdownMenuItem disabled={empty} onSelect={() => void exportStudents(students, 'xlsx')}>
          <FileSpreadsheet aria-hidden />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem disabled={empty} onSelect={() => void exportStudents(students, 'csv')}>
          <FileText aria-hidden />
          CSV (.csv)
        </DropdownMenuItem>
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>เฉพาะที่เลือก ({selected.length} คน)</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void exportStudents(selected, 'xlsx', ' (ที่เลือก)')}>
              <FileSpreadsheet aria-hidden />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportStudents(selected, 'csv', ' (ที่เลือก)')}>
              <FileText aria-hidden />
              CSV (.csv)
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void downloadTemplate()}>
          <Download aria-hidden />
          ดาวน์โหลดแบบฟอร์มนำเข้า
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { ArrowLeft, ClipboardPaste, FileUp, LoaderCircle, TriangleAlert, Upload } from 'lucide-react'
import { useId, useMemo, useState, type DragEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/toggle-group'
import type { Classroom, Student } from '@/data/types'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { readTable, SPREADSHEET_ACCEPT, SpreadsheetError } from '@/lib/spreadsheet'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'

import { randomBotAvatar } from '../lib/avatar'
import {
  detectHeaderRow,
  guessMapping,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  normalizeTable,
  parsePastedText,
  parseStudentRows,
  type ImportField,
  type Table,
} from '../lib/importMapping'

type ImportMode = 'append' | 'replace'

const PREVIEW_ROWS = 5
const ISSUE_ROWS = 40

interface Draft {
  table: Table
  sourceName: string
  /** Header row found by auto-detection (-1 = none). */
  detectedHeader: number
}

// ---------------------------------------------------------------------------
// Step 1 — choose a file or paste text
// ---------------------------------------------------------------------------

interface SourceStepProps {
  onLoaded: (draft: Draft) => void
}

function SourceStep({ onLoaded }: SourceStepProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')

  const accept = (table: Table, sourceName: string) => {
    if (table.length === 0) {
      setError('ไม่พบข้อมูลในไฟล์หรือข้อความนี้')
      return
    }
    setError(null)
    onLoaded({ table, sourceName, detectedHeader: detectHeaderRow(table) })
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      accept(normalizeTable(await readTable(file)), file.name)
    } catch (cause) {
      setError(cause instanceof SpreadsheetError ? cause.message : 'อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  return (
    <div className="grid gap-5">
      {/* Drag and drop is an optional shortcut; the file input inside the label is the keyboard path. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          'focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/30 hover:border-neon-cyan/70',
          dragging ? 'border-neon-cyan bg-neon-cyan/10' : 'border-input bg-ink/40',
        )}
      >
        {loading ? (
          <LoaderCircle className="size-9 animate-spin text-neon-cyan" aria-hidden />
        ) : (
          <FileUp className="size-9 text-neon-cyan" aria-hidden />
        )}
        <span className="font-semibold">{loading ? 'กำลังอ่านไฟล์…' : 'ลากไฟล์มาวาง หรือแตะเพื่อเลือกไฟล์'}</span>
        <span className="text-sm text-muted-foreground">รองรับ Excel (.xlsx, .xls) และ CSV ขนาดไม่เกิน 5 MB</span>
        <input
          id={inputId}
          type="file"
          accept={SPREADSHEET_ACCEPT}
          className="sr-only"
          disabled={loading}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        หรือ
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        <label htmlFor={`${inputId}-paste`} className="text-sm font-medium">
          วางรายชื่อ (คัดลอกจาก Excel หรือพิมพ์บรรทัดละ 1 คน)
        </label>
        <Textarea
          id={`${inputId}-paste`}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          rows={4}
          placeholder={'สมชาย ใจดี\nสมหญิง รักเรียน'}
        />
        <Button
          variant="secondary"
          className="justify-self-start"
          disabled={pasted.trim() === ''}
          onClick={() => accept(parsePastedText(pasted), 'ข้อความที่วาง')}
        >
          <ClipboardPaste aria-hidden />
          ใช้รายชื่อที่วาง
        </Button>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — map columns, review, import
// ---------------------------------------------------------------------------

interface ReviewStepProps {
  draft: Draft
  classroom: Classroom
  existing: readonly Student[]
  onBack: () => void
  onDone: () => void
}

function ReviewStep({ draft, classroom, existing, onBack, onDone }: ReviewStepProps) {
  const { table, detectedHeader } = draft
  const addStudents = useDataStore((state) => state.addStudents)
  const replaceStudents = useDataStore((state) => state.replaceStudents)
  const { run, pending } = useAsyncAction()

  const [hasHeader, setHasHeader] = useState(detectedHeader >= 0)
  const headerIndex = hasHeader ? Math.max(detectedHeader, 0) : -1
  const [mapping, setMapping] = useState<ImportField[]>(() => guessMapping(table, detectedHeader))
  const [stripPrefix, setStripPrefix] = useState(true)
  const [mode, setMode] = useState<ImportMode>('append')

  const result = useMemo(
    () =>
      parseStudentRows(table, {
        headerIndex,
        mapping,
        stripPrefix,
        existing: mode === 'replace' ? [] : existing,
      }),
    [table, headerIndex, mapping, stripPrefix, mode, existing],
  )

  const hasNameColumn = mapping.includes('firstName') || mapping.includes('fullName')
  const headerRow = headerIndex >= 0 ? table[headerIndex] : undefined
  const previewRows = table.slice(headerIndex + 1, headerIndex + 1 + PREVIEW_ROWS)
  const issues = result.rows.filter((row) => row.status === 'skip' || row.notes.length > 0)
  const width = table[0]?.length ?? 0

  const setColumn = (column: number, field: ImportField) => {
    setMapping((current) =>
      current.map((existingField, index) => {
        if (index === column) return field
        // A field can only come from one column: taking it here releases it elsewhere.
        return field !== 'ignore' && existingField === field ? 'ignore' : existingField
      }),
    )
  }

  const toggleHeader = (next: boolean) => {
    setHasHeader(next)
    setMapping(guessMapping(table, next ? Math.max(detectedHeader, 0) : -1))
  }

  const handleImport = () => {
    const inputs = result.ready.map((student) => ({
      classroomId: classroom.id,
      ...student,
      avatar: randomBotAvatar(),
    }))
    void run(async () => {
      if (mode === 'replace') await replaceStudents(classroom.id, inputs)
      else await addStudents(inputs)
      toast.success(`นำเข้า ${inputs.length} คนเข้าห้อง ${classroom.name} แล้ว`)
      onDone()
    })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-2xl border border-border bg-ink/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="import-header" className="text-sm font-medium">
            แถวแรกเป็นหัวตาราง
          </label>
          <Switch id="import-header" checked={hasHeader} onCheckedChange={toggleHeader} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="import-prefix" className="text-sm font-medium">
            ตัดคำนำหน้าชื่อออก
            <span className="block text-xs font-normal text-muted-foreground">เช่น ด.ช. ด.ญ. เด็กชาย นาย นางสาว</span>
          </label>
          <Switch id="import-prefix" checked={stripPrefix} onCheckedChange={setStripPrefix} />
        </div>
        {existing.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">ห้องนี้มีนักเรียนอยู่แล้ว {existing.length} คน</p>
            <SegmentedControl<ImportMode>
              label="วิธีนำเข้า"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'append', label: 'เพิ่มต่อจากเดิม' },
                { value: 'replace', label: 'แทนที่ทั้งหมด' },
              ]}
            />
            {mode === 'replace' ? (
              <p className="flex items-center gap-2 text-sm text-neon-gold">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                รายชื่อเดิมทั้ง {existing.length} คนจะถูกลบและแทนที่ด้วยรายชื่อใหม่
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">จับคู่คอลัมน์</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-ink/50">
                {Array.from({ length: width }, (_unused, column) => (
                  <th key={column} scope="col" className="min-w-40 p-2 text-left font-normal">
                    <Select value={mapping[column] ?? 'ignore'} onValueChange={(v) => setColumn(column, v as ImportField)}>
                      <SelectTrigger
                        className="h-10"
                        aria-label={`ข้อมูลในคอลัมน์ ${column + 1}${headerRow?.[column] ? ` (${headerRow[column]})` : ''}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {headerRow ? (
                      <span className="mt-1 block truncate px-1 text-xs text-muted-foreground">
                        {headerRow[column] || '—'}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                // oxlint-disable-next-line react/no-array-index-key -- preview rows have no identity besides position
                <tr key={rowIndex} className="border-b border-border/60 last:border-0">
                  {Array.from({ length: width }, (_unused, column) => (
                    <td
                      key={column}
                      className={cn(
                        'max-w-56 truncate px-3 py-2',
                        mapping[column] === 'ignore' && 'text-muted-foreground/60',
                      )}
                    >
                      {row[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          แสดงตัวอย่าง {previewRows.length} แถวแรก จากทั้งหมด {Math.max(0, table.length - headerIndex - 1)} แถว
        </p>
      </div>

      <div className="grid gap-2" aria-live="polite">
        <div className="flex flex-wrap gap-2">
          <Badge variant="lime">พร้อมนำเข้า {result.ready.length} คน</Badge>
          {result.skipped > 0 ? <Badge variant="destructive">ข้าม {result.skipped} แถว</Badge> : null}
          {result.adjusted > 0 ? <Badge variant="gold">ปรับแก้ {result.adjusted} แถว</Badge> : null}
        </div>
        {hasNameColumn ? null : (
          <p role="alert" className="flex items-center gap-2 text-sm text-neon-gold">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            กรุณาเลือกคอลัมน์ที่เป็น “ชื่อ” หรือ “ชื่อ-นามสกุล”
          </p>
        )}
        {issues.length > 0 ? (
          <details className="rounded-2xl border border-border bg-ink/40 px-4 py-2 text-sm">
            <summary className="cursor-pointer py-1 font-medium">ดูรายละเอียดแถวที่ถูกข้ามหรือปรับแก้</summary>
            <ul className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto pb-2">
              {issues.slice(0, ISSUE_ROWS).map((row) => (
                <li key={row.rowNumber} className="flex gap-2">
                  <span className="tabular shrink-0 text-muted-foreground">แถว {row.rowNumber}</span>
                  <span className={row.status === 'skip' ? 'text-destructive' : 'text-neon-gold'}>
                    {row.status === 'skip' ? `ข้าม — ${row.reason}` : row.notes.join(' · ')}
                  </span>
                </li>
              ))}
              {issues.length > ISSUE_ROWS ? (
                <li className="text-muted-foreground">และอีก {issues.length - ISSUE_ROWS} แถว</li>
              ) : null}
            </ul>
          </details>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onBack} disabled={pending}>
          <ArrowLeft aria-hidden />
          เลือกไฟล์ใหม่
        </Button>
        <Button onClick={handleImport} disabled={pending || result.ready.length === 0}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          นำเข้า {result.ready.length} คน
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

interface ImportBodyProps {
  classroom: Classroom
  existing: readonly Student[]
  onDone: () => void
}

function ImportBody({ classroom, existing, onDone }: ImportBodyProps) {
  const [draft, setDraft] = useState<Draft | null>(null)

  return (
    <>
      <DialogHeader>
        <DialogTitle>นำเข้ารายชื่อนักเรียน</DialogTitle>
        <DialogDescription>
          {draft
            ? `ตรวจสอบข้อมูลจาก “${draft.sourceName}” ก่อนนำเข้าห้อง ${classroom.name}`
            : `เพิ่มนักเรียนเข้าห้อง ${classroom.name} จากไฟล์ Excel/CSV หรือวางรายชื่อ`}
        </DialogDescription>
      </DialogHeader>
      {draft ? (
        <ReviewStep
          // A new file gets a fresh review step, so no mapping state leaks between files.
          key={draft.sourceName + draft.table.length}
          draft={draft}
          classroom={classroom}
          existing={existing}
          onBack={() => setDraft(null)}
          onDone={onDone}
        />
      ) : (
        <SourceStep onLoaded={setDraft} />
      )}
    </>
  )
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classroom: Classroom
  /** Students currently in the classroom. */
  existing: readonly Student[]
}

export function ImportDialog({ open, onOpenChange, classroom, existing }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <ImportBody classroom={classroom} existing={existing} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

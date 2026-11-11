import { Dices, Download, FileSpreadsheet, FileText, History, LoaderCircle, SearchX, Trash2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataBoundary } from '@/components/common/DataBoundary'
import { EmptyState } from '@/components/common/EmptyState'
import { GlassCard } from '@/components/common/GlassCard'
import { PageHeader } from '@/components/common/PageHeader'
import { PageLoader } from '@/components/common/PageLoader'
import { SearchInput } from '@/components/common/SearchInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { getRepository } from '@/data'
import type { RandomResult, ResultMode } from '@/data/types'
import { HistoryTable } from '@/features/history/components/HistoryTable'
import { SessionGroups } from '@/features/history/components/SessionGroups'
import { useHistoryQuery } from '@/features/history/hooks/useHistoryQuery'
import {
  DEFAULT_FILTERS,
  groupBySession,
  HISTORY_PERIODS,
  PERIOD_LABELS,
  REPORT_WIDTHS,
  resultsToReport,
  toHistoryQuery,
  type HistoryFilters,
  type HistoryPeriod,
} from '@/features/history/lib/report'
import { RESULT_MODE_META } from '@/features/randomizer/lib/modes'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fileTimestamp } from '@/lib/date'
import { downloadTable, type SpreadsheetFormat } from '@/lib/spreadsheet'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useStudioStore } from '@/stores/studioStore'

const PAGE_SIZE = 100
/** Upper bound of rows written to one exported report. */
const EXPORT_LIMIT = 20_000
const ALL = 'all'
const MODES = Object.keys(RESULT_MODE_META) as ResultMode[]

type ViewMode = 'list' | 'rounds'

function HistoryContent() {
  const classrooms = useDataStore((state) => state.classrooms)
  const deleteResults = useHistoryStore((state) => state.deleteResults)
  const clearHistory = useHistoryStore((state) => state.clear)
  const { run: runExport, pending: exporting } = useAsyncAction()

  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS)
  const [view, setView] = useState<ViewMode>('list')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [deleting, setDeleting] = useState<RandomResult | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const search = useDebouncedValue(filters.search)
  const activeFilters = useMemo(() => ({ ...filters, search }), [filters, search])
  const { rows, total, sessions, error, initial, loading } = useHistoryQuery(activeFilters, limit)
  const groups = useMemo(() => groupBySession(rows), [rows])

  const patchFilters = (patch: Partial<HistoryFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setLimit(PAGE_SIZE)
  }

  const filtered =
    filters.period !== 'all' || filters.classroomId !== null || filters.mode !== null || search.trim() !== ''

  const exportReport = (format: SpreadsheetFormat) =>
    runExport(
      async () => {
        const repository = getRepository()
        const page = await repository.queryResults({ ...toHistoryQuery(activeFilters), limit: EXPORT_LIMIT })
        const meta = await repository.listSessions([...new Set(page.rows.map((row) => row.sessionId))])
        await downloadTable(resultsToReport(page.rows, new Map(meta.map((session) => [session.id, session]))), {
          filename: `รายงานการสุ่ม ${fileTimestamp()}`,
          format,
          sheetName: 'ประวัติการสุ่ม',
          widths: REPORT_WIDTHS,
        })
      },
      { success: 'ส่งออกรายงานแล้ว', error: 'ส่งออกรายงานไม่สำเร็จ' },
    )

  return (
    <>
      <PageHeader
        eyebrow="Random History"
        title="ประวัติการสุ่ม"
        description="ผลการสุ่มทุกครั้งถูกบันทึกพร้อมวันเวลา ห้องเรียน และรูปแบบที่ใช้ ดูย้อนหลังได้ทั้งรายครั้งและรายรอบ"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" disabled={exporting || total === 0}>
                  {exporting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                  ส่งออกรายงาน
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuLabel>ตามตัวกรองปัจจุบัน ({total} รายการ)</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void exportReport('xlsx')}>
                  <FileSpreadsheet aria-hidden />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportReport('csv')}>
                  <FileText aria-hidden />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="destructive" onClick={() => setConfirmClear(true)} disabled={total === 0 && !filtered}>
              <Trash2 aria-hidden />
              ล้างประวัติ
            </Button>
          </>
        }
      />

      {/* Filters sit in one row above everything they scope; the date range comes first. */}
      <div className="mb-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-[auto_14rem_14rem_minmax(0,1fr)]">
        <SegmentedControl<HistoryPeriod>
          label="ช่วงเวลา"
          value={filters.period}
          onValueChange={(period) => patchFilters({ period })}
          options={HISTORY_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
          className="xl:w-[21rem]"
        />
        <Select
          value={filters.classroomId ?? ALL}
          onValueChange={(value) => patchFilters({ classroomId: value === ALL ? null : value })}
        >
          <SelectTrigger aria-label="กรองตามห้องเรียน">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกห้องเรียน</SelectItem>
            {classrooms.map((classroom) => (
              <SelectItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.mode ?? ALL}
          onValueChange={(value) => patchFilters({ mode: value === ALL ? null : (value as ResultMode) })}
        >
          <SelectTrigger aria-label="กรองตามรูปแบบการสุ่ม">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกรูปแบบ</SelectItem>
            {MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {RESULT_MODE_META[mode].english}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={filters.search}
          onChange={(value) => patchFilters({ search: value })}
          label="ค้นหาชื่อในประวัติ"
          placeholder="ค้นหาชื่อ"
        />
      </div>

      <GlassCard className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {initial ? 'กำลังโหลด…' : `พบ ${total.toLocaleString('th-TH')} รายการ`}
            {rows.length < total ? ` (แสดง ${rows.length.toLocaleString('th-TH')})` : ''}
          </p>
          <SegmentedControl<ViewMode>
            label="มุมมอง"
            size="sm"
            value={view}
            onValueChange={setView}
            className="w-auto"
            options={[
              { value: 'list', label: 'รายการ' },
              { value: 'rounds', label: 'รายรอบ' },
            ]}
          />
        </div>

        {error ? (
          <p role="alert" className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm text-destructive sm:px-6">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {initial ? (
          <PageLoader className="min-h-64" />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="ไม่พบประวัติที่ตรงกับตัวกรอง" description="ลองขยายช่วงเวลาหรือล้างตัวกรอง">
              <Button variant="secondary" onClick={() => patchFilters(DEFAULT_FILTERS)}>
                ดูทั้งหมด
              </Button>
            </EmptyState>
          ) : (
            <EmptyState icon={History} title="ยังไม่มีประวัติการสุ่ม" description="เมื่อเริ่มสุ่มในสตูดิโอ ผลลัพธ์จะปรากฏที่นี่โดยอัตโนมัติ">
              <Button asChild>
                <Link to="/studio">
                  <Dices aria-hidden />
                  ไปที่สตูดิโอ
                </Link>
              </Button>
            </EmptyState>
          )
        ) : (
          // While a refetch is in flight the previous rows stay on screen, dimmed.
          <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            {view === 'list' ? (
              <HistoryTable rows={rows} sessions={sessions} onDelete={setDeleting} />
            ) : (
              <SessionGroups groups={groups} sessions={sessions} />
            )}
            {rows.length < total ? (
              <div className="flex justify-center border-t border-border p-4">
                <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE_SIZE)} disabled={loading}>
                  {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  โหลดเพิ่มอีก {Math.min(PAGE_SIZE, total - rows.length)} รายการ
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="ลบรายการนี้?"
        description={`ผลการสุ่ม “${deleting?.displayName ?? ''}” จะถูกลบออกจากประวัติ`}
        confirmLabel="ลบรายการ"
        tone="destructive"
        successMessage="ลบรายการแล้ว"
        onConfirm={async () => {
          if (deleting) await deleteResults([deleting.id])
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="ล้างประวัติการสุ่มทั้งหมด?"
        description="ประวัติทุกรายการและทุกรอบจะถูกลบถาวร รายชื่อนักเรียนและห้องเรียนไม่ได้รับผลกระทบ การกระทำนี้ย้อนกลับไม่ได้"
        confirmLabel="ล้างประวัติทั้งหมด"
        tone="destructive"
        successMessage="ล้างประวัติแล้ว"
        onConfirm={async () => {
          await clearHistory()
          // Open rounds pointed at sessions that no longer exist.
          useStudioStore.getState().detachSessions()
        }}
      />
    </>
  )
}

export default function HistoryPage() {
  return (
    <DataBoundary>
      <HistoryContent />
    </DataBoundary>
  )
}

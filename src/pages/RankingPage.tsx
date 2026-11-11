import {
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LoaderCircle,
  Maximize,
  Minimize,
  Settings,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  UserRoundSearch,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { DataBoundary } from '@/components/common/DataBoundary'
import { EmptyState } from '@/components/common/EmptyState'
import { GlassCard } from '@/components/common/GlassCard'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import { Hint } from '@/components/ui/tooltip'
import type { ID } from '@/data/types'
import { StatTile } from '@/features/dashboard/components/StatTile'
import { Leaderboard } from '@/features/ranking/components/Leaderboard'
import { NotPickedPanel } from '@/features/ranking/components/NotPickedPanel'
import { Podium } from '@/features/ranking/components/Podium'
import { useStudentStats } from '@/features/ranking/hooks/useStudentStats'
import {
  buildRanking,
  RANKING_PERIOD_LABELS,
  RANKING_PERIODS,
  RANKING_WIDTHS,
  rankingToSheet,
  type RankingPeriod,
} from '@/features/ranking/lib/ranking'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useBigScreen } from '@/hooks/useBigScreen'
import { fileTimestamp } from '@/lib/date'
import { downloadTable, type SpreadsheetFormat } from '@/lib/spreadsheet'
import { useClassroomStudents, useDataStore } from '@/stores/dataStore'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'
import { poolKey, useStudioStore } from '@/stores/studioStore'

function Ranking() {
  const classrooms = useDataStore((state) => state.classrooms)
  const general = useSettings('general')
  const features = useSettings('features')
  const animation = useSettings('animation')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { immersive, toggle: toggleBigScreen } = useBigScreen()
  const { run: runExport, pending: exporting } = useAsyncAction()

  // Start on the classroom asked for in the link, else the one the studio is using.
  const [selected, setSelected] = useState<ID | null>(
    () => searchParams.get('classroom') ?? useStudioStore.getState().classroomId,
  )
  const [period, setPeriod] = useState<RankingPeriod>('week')
  const classroom = classrooms.find((item) => item.id === selected) ?? classrooms[0] ?? null
  const classroomId = classroom?.id ?? null
  const roster = useClassroomStudents(classroomId)
  const { stats, error, initial, loading } = useStudentStats(classroomId, period)
  const ranking = useMemo(() => buildRanking(stats, roster), [stats, roster])
  const periodLabel = RANKING_PERIOD_LABELS[period]
  const reduced = animation.level === 'low'

  const drawFromNotPicked = () => {
    if (!classroom) return
    const studio = useStudioStore.getState()
    const { numberMin, numberMax } = useSettingsStore.getState().settings.rules
    studio.setClassroom(classroom.id)
    studio.setSource('students')
    if (studio.drawType === 'team') studio.setDrawType('single')
    studio.restrictTo(
      poolKey(classroom.id, 'students', numberMin, numberMax),
      roster.map((student) => student.id),
      ranking.notPicked.map((student) => student.id),
    )
    void navigate('/studio')
  }

  const exportRanking = (format: SpreadsheetFormat) =>
    runExport(
      async () => {
        if (!classroom) return
        await downloadTable(rankingToSheet(ranking, general.nameFormat), {
          filename: `อันดับดาว ${classroom.name} ${periodLabel} ${fileTimestamp()}`,
          format,
          sheetName: 'อันดับดาว',
          widths: RANKING_WIDTHS,
        })
      },
      { success: 'ส่งออกอันดับแล้ว', error: 'ส่งออกอันดับไม่สำเร็จ' },
    )

  if (!classroom) {
    return (
      <>
        <PageHeader eyebrow="Class Ranking" title="อันดับดาว" />
        <EmptyState
          icon={GraduationCap}
          title="ยังไม่มีห้องเรียน"
          description="สร้างห้องเรียนและเพิ่มรายชื่อนักเรียนก่อน แล้วให้ดาวบนหน้าผู้ชนะในสตูดิโอ"
        >
          <Button asChild variant="neon">
            <Link to="/classrooms">
              <GraduationCap aria-hidden />
              ไปที่ห้องเรียน
            </Link>
          </Button>
        </EmptyState>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-5 immersive:min-h-dvh immersive:p-4 sm:immersive:p-6">
      <PageHeader
        eyebrow="Class Ranking"
        title={immersive ? `อันดับดาว · ${classroom.name}` : 'อันดับดาว'}
        description={
          immersive
            ? periodLabel
            : 'ดาวจากหน้าผู้ชนะ Quiz Mode และ Team Battle รวมเป็นอันดับของแต่ละห้อง พร้อมรายชื่อคนที่ยังไม่ได้ถูกเลือก'
        }
        className="mb-0 sm:mb-0"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" disabled={exporting || roster.length === 0}>
                  {exporting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                  ส่งออก
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuLabel>
                  {classroom.name} · {periodLabel}
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void exportRanking('xlsx')}>
                  <FileSpreadsheet aria-hidden />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportRanking('csv')}>
                  <FileText aria-hidden />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Hint label={immersive ? 'ออกจากโหมดจอใหญ่' : 'นำเสนอบนจอใหญ่'}>
              <Button variant={immersive ? 'secondary' : 'outline'} onClick={toggleBigScreen} aria-pressed={immersive}>
                {immersive ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
                {immersive ? 'ออกจากจอใหญ่' : 'จอใหญ่'}
              </Button>
            </Hint>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Select value={classroom.id} onValueChange={setSelected}>
          <SelectTrigger className="md:w-64" aria-label="ห้องเรียน">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classrooms.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedControl<RankingPeriod>
          label="ช่วงเวลา"
          value={period}
          onValueChange={setPeriod}
          className="md:w-auto"
          options={RANKING_PERIODS.map((value) => ({ value, label: RANKING_PERIOD_LABELS[value] }))}
        />
        {loading && !initial ? (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label="กำลังโหลด" />
        ) : null}
      </div>

      {features.stars ? null : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-neon-gold/35 bg-neon-gold/8 px-4 py-3 text-sm">
          <Star className="size-4 text-neon-gold" aria-hidden />
          การให้ดาวบนหน้าผู้ชนะปิดอยู่ ดาวเดิมยังนับรวมในอันดับ
          <Button asChild variant="ghost" size="sm" className="-my-1">
            <Link to="/settings?tab=features">
              <Settings aria-hidden />
              เปิดการให้ดาว
            </Link>
          </Button>
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {roster.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="ห้องนี้ยังไม่มีนักเรียน"
          description="เพิ่มรายชื่อนักเรียนก่อน อันดับดาวจะแสดงที่นี่เมื่อครูให้ดาวบนหน้าผู้ชนะ"
        >
          <Button asChild variant="neon">
            <Link to={`/classrooms/${classroom.id}`}>
              <UserPlus aria-hidden />
              เพิ่มรายชื่อ
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Phones get the totals as one line; the tiles would push the podium below the fold. */}
          <p className="flex flex-wrap gap-2 sm:hidden immersive:hidden">
            <Badge variant="gold" className="tabular">
              ดาว {ranking.totalStars}
            </Badge>
            <Badge variant="default" className="tabular">
              ถูกเลือก {ranking.totalPicks} ครั้ง
            </Badge>
            <Badge variant="cyan" className="tabular">
              ยังไม่ถูกเลือก {ranking.notPicked.length} คน
            </Badge>
          </p>
          <div className="hidden grid-cols-3 gap-3 sm:grid immersive:hidden">
            <StatTile label={`ดาวทั้งหมด${periodLabel}`} value={ranking.totalStars} icon={Star} tone="text-neon-gold" />
            <StatTile
              label={`ถูกเลือก${periodLabel} (ครั้ง)`}
              value={ranking.totalPicks}
              icon={Sparkles}
              tone="text-neon-violet"
            />
            <StatTile
              label="ยังไม่ถูกเลือก (คน)"
              value={ranking.notPicked.length}
              icon={UserRoundSearch}
              tone="text-neon-cyan"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] immersive:xl:grid-cols-[minmax(0,1fr)_26rem]">
            <GlassCard className="flex min-w-0 flex-col gap-6 p-4 sm:p-6" aria-busy={initial}>
              {initial ? (
                <div className="flex h-64 items-center justify-center">
                  <LoaderCircle className="size-8 animate-spin text-muted-foreground" aria-label="กำลังโหลดอันดับ" />
                </div>
              ) : ranking.leaders.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title={`ยังไม่มีดาว${periodLabel}`}
                  description="ให้ดาวได้บนหน้าผู้ชนะในสตูดิโอ ตอบถูกใน Quiz Mode หรือชนะ Team Battle"
                  className="py-10"
                >
                  <Button asChild variant="neon">
                    <Link to="/studio">
                      <Sparkles aria-hidden />
                      ไปที่สตูดิโอ
                    </Link>
                  </Button>
                </EmptyState>
              ) : (
                <>
                  <div className="pt-6">
                    <Podium leaders={ranking.leaders} nameFormat={general.nameFormat} reduced={reduced} />
                  </div>
                  <Leaderboard leaders={ranking.leaders} nameFormat={general.nameFormat} />
                </>
              )}
            </GlassCard>

            <NotPickedPanel
              students={ranking.notPicked}
              periodLabel={periodLabel}
              nameFormat={general.nameFormat}
              onDrawThem={drawFromNotPicked}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default function RankingPage() {
  return (
    <DataBoundary>
      <Ranking />
    </DataBoundary>
  )
}

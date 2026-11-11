import {
  ArrowRight,
  CalendarDays,
  Dices,
  GraduationCap,
  Settings,
  Swords,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'

import { DataBoundary } from '@/components/common/DataBoundary'
import { GlassCard } from '@/components/common/GlassCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityFeed } from '@/features/dashboard/components/ActivityFeed'
import { ModeUsage } from '@/features/dashboard/components/ModeUsage'
import { QuickStart } from '@/features/dashboard/components/QuickStart'
import { RecentResults } from '@/features/dashboard/components/RecentResults'
import { StatTile } from '@/features/dashboard/components/StatTile'
import { buildActivityFeed, countByDay, countByMode, countDraws, filterSince } from '@/features/history/lib/stats'
import { addDays, startOfDay } from '@/lib/date'
import { useAuthStore } from '@/stores/authStore'
import { useBattleStore } from '@/stores/battleStore'
import { useDataStore } from '@/stores/dataStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSettings } from '@/stores/settingsStore'
import { useStudioStore } from '@/stores/studioStore'

// Recharts is only needed once there is something to plot.
const DrawsChart = lazy(() => import('@/features/dashboard/components/DrawsChart'))

const CHART_DAYS = 7
const RECENT_RESULTS = 6

interface Step {
  to: string
  icon: LucideIcon
  title: string
  description: string
  tone: string
}

const STEPS: readonly Step[] = [
  {
    to: '/classrooms',
    icon: GraduationCap,
    title: 'เพิ่มห้องเรียน',
    description: 'สร้างห้องและเพิ่มรายชื่อนักเรียน หรือนำเข้าจาก Excel',
    tone: 'text-neon-cyan',
  },
  {
    to: '/studio',
    icon: Dices,
    title: 'เปิดสตูดิโอสุ่ม',
    description: 'เลือกโหมดเกมแล้วกดสุ่ม ใช้ตัวเลขได้ทันทีแม้ยังไม่มีรายชื่อ',
    tone: 'text-neon-pink',
  },
  {
    to: '/settings',
    icon: Settings,
    title: 'ปรับแต่งระบบ',
    description: 'ธีมสี ระดับแอนิเมชัน และการแสดงผลบนจอใหญ่',
    tone: 'text-neon-gold',
  },
]

interface PanelProps {
  title: string
  /** Optional link shown at the right of the title. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

function Panel({ title, action, className, children }: PanelProps) {
  return (
    <GlassCard className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </GlassCard>
  )
}

function Dashboard() {
  const classrooms = useDataStore((state) => state.classrooms)
  const students = useDataStore((state) => state.students)
  const recent = useHistoryStore((state) => state.recent)
  const historyStatus = useHistoryStore((state) => state.status)
  const loadHistory = useHistoryStore((state) => state.load)
  const lastClassroomId = useStudioStore((state) => state.classroomId)
  const general = useSettings('general')
  const accountName = useAuthStore((state) => state.profile?.displayName ?? '')
  const animationLevel = useSettings('animation').level

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const stats = useMemo(() => {
    const today = startOfDay()
    const todayResults = filterSince(recent, today)
    const yesterdayResults = filterSince(recent, addDays(today, -1)).filter(
      (result) => result.createdAt < today.toISOString(),
    )
    return {
      drawsToday: countDraws(todayResults),
      drawsYesterday: countDraws(yesterdayResults),
      days: countByDay(recent, CHART_DAYS),
      // A team split writes one row per member; it belongs in the activity feed, not in this list.
      latestPicks: recent.filter((result) => result.drawType !== 'team').slice(0, RECENT_RESULTS),
      modes: countByMode(recent),
      activities: buildActivityFeed(classrooms, students, recent),
    }
  }, [recent, classrooms, students])

  const battle = useBattleStore((state) => state.battle)
  const drawsThisWeek = stats.days.reduce((sum, day) => sum + day.draws, 0)
  const isNew = classrooms.length === 0 && recent.length === 0 && historyStatus === 'ready'
  const name = general.teacherName || accountName
  const greeting = name ? `สวัสดี ${name}` : 'พร้อมสุ่มหรือยัง?'

  return (
    <div className="flex flex-col gap-5">
      <GlassCard highlighted className="relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-16 size-72 rounded-full bg-neon-pink/25 blur-3xl anim-low:hidden"
        />
        <div className="relative">
          <p className="hud-label text-neon-cyan">Next-Gen Student Randomizer</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            {greeting} <span className="text-gradient">สุ่มชื่อให้สนุกเหมือนเล่นเกม</span>
          </h1>
          <div className="mt-6">
            <QuickStart classrooms={classrooms} initialClassroomId={lastClassroomId} />
          </div>
        </div>
      </GlassCard>

      {battle && battle.finishedAt === null ? (
        <GlassCard className="flex flex-col gap-3 border-neon-pink/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neon-pink/15 text-neon-pink">
              <Swords className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-bold">Team Battle กำลังแข่งขัน</p>
              <p className="truncate text-sm text-muted-foreground">
                {battle.title} · {battle.teams.map((team) => `${team.name} ${team.score}`).join(' · ')}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link to="/battle">
              กลับไปที่กระดานคะแนน
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </GlassCard>
      ) : null}

      {isNew ? (
        <section aria-labelledby="getting-started">
          <h2 id="getting-started" className="mb-3 text-xl font-bold">
            เริ่มต้นใช้งาน
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.to}>
                <Link
                  to={step.to}
                  className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <GlassCard interactive className="flex h-full flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <step.icon className={`size-8 ${step.tone}`} aria-hidden />
                      <span className="text-3xl font-extrabold text-foreground/15">0{index + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-neon-cyan">
                      ไปที่หน้านี้
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </GlassCard>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <section aria-label="ภาพรวมระบบ" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="ห้องเรียน" value={classrooms.length} icon={GraduationCap} tone="text-neon-cyan" />
            <StatTile label="นักเรียน" value={students.length} icon={Users} tone="text-neon-lime" />
            <StatTile
              label="สุ่มวันนี้"
              value={stats.drawsToday}
              icon={Zap}
              tone="text-neon-pink"
              delta={{ value: stats.drawsToday - stats.drawsYesterday, period: 'เมื่อวาน' }}
            />
            <StatTile label={`สุ่มใน ${CHART_DAYS} วัน`} value={drawsThisWeek} icon={CalendarDays} tone="text-neon-gold" />
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title={`จำนวนครั้งที่สุ่มใน ${CHART_DAYS} วันล่าสุด`}>
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <DrawsChart days={stats.days} animate={animationLevel !== 'low'} />
              </Suspense>
            </Panel>
            <Panel title="โหมดที่ใช้บ่อย (30 วัน)">
              <ModeUsage counts={stats.modes} />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="ผู้ถูกสุ่มล่าสุด"
              action={
                <Button variant="link" asChild>
                  <Link to="/history">
                    ดูทั้งหมด
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            >
              <RecentResults results={stats.latestPicks} />
            </Panel>
            <Panel title="กิจกรรมล่าสุด">
              <ActivityFeed activities={stats.activities} />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DataBoundary>
      <Dashboard />
    </DataBoundary>
  )
}

import { AnimatePresence } from 'framer-motion'
import {
  Check,
  ClipboardCopy,
  Maximize,
  Minimize,
  PartyPopper,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataBoundary } from '@/components/common/DataBoundary'
import { GlassCard } from '@/components/common/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SegmentedControl } from '@/components/ui/toggle-group'
import { Hint } from '@/components/ui/tooltip'
import { RANDOM_MODES, type DrawSource, type DrawType, type RandomMode, type SessionInput } from '@/data/types'
import { Confetti } from '@/features/randomizer/components/Confetti'
import { DrawSummary } from '@/features/randomizer/components/DrawSummary'
import { ModeTabs } from '@/features/randomizer/components/ModeTabs'
import { ParticipantsPanel } from '@/features/randomizer/components/ParticipantsPanel'
import { ReadyBanner } from '@/features/randomizer/components/ReadyBanner'
import { RulesPanel } from '@/features/randomizer/components/RulesPanel'
import { StudioStage } from '@/features/randomizer/components/StudioStage'
import { WinnerReveal } from '@/features/randomizer/components/WinnerReveal'
import { buildNumberCandidates, buildStudentCandidates } from '@/features/randomizer/engine/candidates'
import { getActive, getEligible, resolveTeamCount } from '@/features/randomizer/engine/engine'
import type { Candidate, PoolState } from '@/features/randomizer/engine/types'
import { useBigScreen } from '@/features/randomizer/hooks/useBigScreen'
import { useDrawController } from '@/features/randomizer/hooks/useDrawController'
import { DRAW_TYPE_LABELS, MODE_META } from '@/features/randomizer/lib/modes'
import { getCardCapacity } from '@/features/randomizer/stages/card/cardLayout'
import type { StageMode, StagePhase } from '@/features/randomizer/stages/types'
import { useElementSize } from '@/hooks/useElementSize'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getAnimationProfile, getDurationScale } from '@/lib/animation/levels'
import { soundManager } from '@/lib/audio/soundManager'
import { cn } from '@/lib/utils'
import { useClassroomStudents, useDataStore } from '@/stores/dataStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSettings, useSettingsStore } from '@/stores/settingsStore'
import { EMPTY_POOL, poolKey, useStudioStore } from '@/stores/studioStore'

const NO_CLASSROOM = 'none'
const DRAW_TYPES: readonly DrawType[] = ['single', 'multiple', 'team']
const SKIPPABLE: readonly StagePhase[] = ['ready', 'dealing', 'running', 'suspense']
/** Phases during which the tension loop plays. */
const MUSIC_PHASES: readonly StagePhase[] = ['ready', 'dealing', 'running', 'suspense']

/** The default mode / classroom preferences apply once per app load, not on every visit. */
let bootstrapped = false

function Studio() {
  const classrooms = useDataStore((state) => state.classrooms)
  const general = useSettings('general')
  const rules = useSettings('rules')
  const animation = useSettings('animation')
  const display = useSettings('display')
  const updateSettings = useSettingsStore((state) => state.update)

  const storedClassroomId = useStudioStore((state) => state.classroomId)
  const mode = useStudioStore((state) => state.mode)
  const storedSource = useStudioStore((state) => state.source)
  const drawType = useStudioStore((state) => state.drawType)
  const pools = useStudioStore((state) => state.pools)
  const setClassroom = useStudioStore((state) => state.setClassroom)
  const setMode = useStudioStore((state) => state.setMode)
  const setSource = useStudioStore((state) => state.setSource)
  const setDrawType = useStudioStore((state) => state.setDrawType)

  const recent = useHistoryStore((state) => state.recent)
  const loadHistory = useHistoryStore((state) => state.load)

  const [searchParams, setSearchParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmNewRound, setConfirmNewRound] = useState(false)
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>()
  const { immersive, toggle: toggleBigScreen, exit: exitBigScreen } = useBigScreen()
  // Matches Tailwind's `xl` breakpoint: the side panel sits beside the stage, otherwise it opens as a sheet.
  // Big Screen Mode always gives the whole window to the stage.
  const wide = useMediaQuery('(min-width: 80rem)') && !immersive
  // On large screens Big Screen Mode pins everything into one viewport; phones keep scrolling.
  const pinned = useMediaQuery('(min-width: 64rem)') && immersive

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // Apply launch preferences and deep links (?classroom=…&mode=…) once.
  useEffect(() => {
    const studio = useStudioStore.getState()
    const known = (id: string | null) => id !== null && classrooms.some((classroom) => classroom.id === id)
    if (!bootstrapped) {
      bootstrapped = true
      studio.setMode(general.defaultMode)
      if (!general.rememberLastClassroom || !known(studio.classroomId)) {
        studio.setClassroom(classrooms[0]?.id ?? null)
      }
    }
    const requestedClassroom = searchParams.get('classroom')
    const requestedMode = searchParams.get('mode')
    if (known(requestedClassroom)) {
      studio.setClassroom(requestedClassroom)
      studio.setSource('students')
    } else if (requestedClassroom === NO_CLASSROOM) {
      // "สุ่มตัวเลข" quick start: no roster, numbers only.
      studio.setClassroom(null)
    }
    if (requestedMode && RANDOM_MODES.includes(requestedMode as RandomMode)) studio.setMode(requestedMode as RandomMode)
    if (requestedClassroom || requestedMode) setSearchParams({}, { replace: true })
    // oxlint-disable-next-line react/exhaustive-deps -- runs once when the studio opens
  }, [])

  // ---- Pool ---------------------------------------------------------------

  const classroom = classrooms.find((item) => item.id === storedClassroomId) ?? null
  const classroomId = classroom?.id ?? null
  const roster = useClassroomStudents(classroomId)
  const rosterAvailable = roster.length > 0
  const source: DrawSource = storedSource === 'students' && !rosterAvailable ? 'numbers' : storedSource

  const candidates = useMemo(
    () =>
      source === 'students'
        ? buildStudentCandidates(roster, general.nameFormat)
        : buildNumberCandidates(rules.numberMin, rules.numberMax, roster, general.nameFormat),
    [source, roster, general.nameFormat, rules.numberMin, rules.numberMax],
  )

  const key = poolKey(classroomId, source, rules.numberMin, rules.numberMax)
  const record = pools[key] ?? EMPTY_POOL
  const policy = rules.repeatPolicy
  const poolState: PoolState = useMemo(
    () => ({ drawnIds: record.drawnIds, excludedIds: Object.keys(record.excluded) }),
    [record.drawnIds, record.excluded],
  )
  const active = useMemo(() => getActive(candidates, poolState), [candidates, poolState])
  const eligible = useMemo(() => getEligible(candidates, poolState, policy), [candidates, poolState, policy])

  const stageMode: StageMode = drawType === 'team' ? 'team' : mode
  const roundComplete = policy === 'no-repeat' && drawType !== 'team' && eligible.length === 0 && active.length > 0
  const profile = getAnimationProfile(animation.level)
  const timeScale = getDurationScale(animation.level, animation.pace)
  const cardSlots = getCardCapacity(stageSize.width, stageSize.height)
  const sourceLabel = source === 'numbers' ? `ตัวเลข ${rules.numberMin}–${rules.numberMax}` : (classroom?.name ?? '')

  const session: SessionInput = useMemo(
    () => ({
      classroomId,
      classroomName: classroom ? (source === 'numbers' ? `${classroom.name} (${sourceLabel})` : classroom.name) : sourceLabel,
      source,
      rules:
        source === 'numbers'
          ? { repeatPolicy: policy, numberMin: rules.numberMin, numberMax: rules.numberMax }
          : { repeatPolicy: policy },
    }),
    [classroomId, classroom, source, sourceLabel, policy, rules.numberMin, rules.numberMax],
  )

  const controller = useDrawController({
    mode,
    drawType,
    policy,
    candidates,
    pool: poolState,
    multipleCount: rules.multipleCount,
    teamSplit: rules.teamSplit,
    teamCount: rules.teamCount,
    teamSize: rules.teamSize,
    cardSlots,
    timeScale,
    poolKey: key,
    session,
  })
  const { state, busy } = controller
  const { phase, plan } = state

  // Music: the tension loop while a draw is in flight, the calm loop otherwise (subject to the settings).
  useEffect(() => {
    soundManager.setMusic(MUSIC_PHASES.includes(phase) ? 'draw' : 'idle')
  }, [phase])
  useEffect(() => () => soundManager.setMusic(null), [])

  // Draw counts of the current round, for the participants list.
  const pickCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!record.sessionId) return counts
    for (const result of recent) {
      if (result.sessionId !== record.sessionId || result.drawType === 'team' || !result.studentId) continue
      counts.set(result.studentId, (counts.get(result.studentId) ?? 0) + 1)
    }
    return counts
  }, [recent, record.sessionId])

  // ---- Actions ------------------------------------------------------------

  const { start: startDraw, skip, close, again, advance, dismissError } = controller

  const handleStart = useCallback(() => {
    if (roundComplete) {
      setConfirmNewRound(true)
      return
    }
    startDraw()
  }, [roundComplete, startDraw])

  useEffect(() => {
    if (!state.error) return
    toast.error(state.error.message)
    dismissError()
  }, [state.error, dismissError])

  const startNewRound = () => {
    const endedSession = useStudioStore.getState().resetRound(key)
    if (endedSession) void useHistoryStore.getState().closeSession(endedSession)
    toast.success('เริ่มรอบใหม่แล้ว ทุกคนกลับเข้ากองสุ่ม')
  }

  const setExcluded = (ids: string[], excluded: boolean) =>
    useStudioStore.getState().setExclusion(key, ids, excluded ? 'manual' : null)

  const excludeWinner = (winner: Candidate) => {
    useStudioStore.getState().setExclusion(key, [winner.id], 'picked')
    toast.success(`ตัด ${winner.label} ออกจากกองสุ่มแล้ว`, {
      action: { label: 'เลิกทำ', onClick: () => useStudioStore.getState().setExclusion(key, [winner.id], null) },
    })
    close()
  }

  const putWinnerBack = (winner: Candidate) => {
    useStudioStore.getState().restoreDrawn(key, winner.id)
    toast.success(`ใส่ ${winner.label} กลับเข้ากองสุ่มแล้ว`)
    close()
  }

  const copyTeams = async () => {
    if (!plan) return
    const text = plan.teams
      .map(
        (team) =>
          `${team.name} (${team.members.length} คน)\n${team.members
            .map((member, index) => `${index + 1}. ${member.label}${member.detail ? ` (${member.detail})` : ''}`)
            .join('\n')}`,
      )
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('คัดลอกรายชื่อทีมแล้ว')
    } catch {
      toast.error('คัดลอกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด')
    }
  }

  // Keyboard: Space/Enter runs the main action, Escape skips or closes. Works with presenter remotes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) {
        return
      }
      if (event.key === 'Escape') {
        if (phase === 'reveal' || phase === 'summary') close()
        else if (SKIPPABLE.includes(phase)) skip()
        else if (phase === 'idle' && immersive) exitBigScreen()
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        toggleBigScreen()
        return
      }
      if (event.key !== ' ' && event.key !== 'Enter') return
      // A focused control handles its own activation.
      if (target?.closest('button, a, [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="combobox"]')) return
      if (phase === 'idle') {
        event.preventDefault()
        handleStart()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, close, skip, handleStart, immersive, exitBigScreen, toggleBigScreen])

  // ---- Derived UI state ----------------------------------------------------

  const current = state.revealed[state.revealed.length - 1]
  const teamPreview = {
    members: active.length,
    teams:
      active.length >= 2
        ? resolveTeamCount(active.length, rules.teamSplit, rules.teamSplit === 'count' ? rules.teamCount : rules.teamSize)
        : 0,
  }
  const actionLabel =
    drawType === 'team'
      ? 'แบ่งทีมเลย!'
      : drawType === 'multiple'
        ? `สุ่ม ${Math.max(1, Math.min(rules.multipleCount, eligible.length))} คน!`
        : MODE_META[mode].action
  const canStart = drawType === 'team' ? active.length >= 2 : eligible.length > 0
  // After this result there is still someone left to draw.
  const canDrawAgain = plan ? !plan.roundComplete : canStart
  const statusText: Partial<Record<StagePhase, string>> = {
    ready: 'เตรียมตัว…',
    dealing: 'กำลังแจกการ์ด…',
    picking:
      plan && plan.picks > 1
        ? `แตะเลือกการ์ดใบที่ ${state.revealed.length + 1} จาก ${plan.picks}`
        : 'แตะเลือกการ์ด 1 ใบ',
    running: 'กำลังสุ่ม…',
    suspense: 'ลุ้น…',
  }
  const teamSummary = phase === 'summary' && state.mode === 'team'
  // Confetti: a full celebration for a single winner or a finished draw, a smaller one per step.
  const confettiBudget = animation.confetti ? profile.confetti : 0
  const celebration =
    plan && phase === 'reveal'
      ? { key: `${plan.id}:${state.revealed.length}`, count: plan.picks > 1 ? Math.round(confettiBudget / 3) : confettiBudget }
      : plan && phase === 'summary'
        ? { key: `${plan.id}:summary`, count: confettiBudget }
        : null

  const sidePanel = (
    <Tabs defaultValue="participants" className="min-h-0 flex-1 gap-4">
      <TabsList>
        <TabsTrigger value="participants">
          <Users aria-hidden />
          ผู้เข้าร่วม
        </TabsTrigger>
        <TabsTrigger value="rules">
          <SlidersHorizontal aria-hidden />
          กติกา
        </TabsTrigger>
      </TabsList>
      <TabsContent value="participants" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        <ParticipantsPanel
          candidates={candidates}
          pool={record}
          policy={policy}
          source={source}
          disabled={busy}
          pickCounts={pickCounts}
          onSetExcluded={setExcluded}
          onRestoreDrawn={(id) => useStudioStore.getState().restoreDrawn(key, id)}
        />
      </TabsContent>
      <TabsContent value="rules" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        <RulesPanel
          rules={rules}
          onRulesChange={(patch) => updateSettings('rules', patch)}
          source={source}
          onSourceChange={setSource}
          rosterAvailable={rosterAvailable}
          drawType={drawType}
          drawCount={record.drawCount}
          disabled={busy}
          onNewRound={() => setConfirmNewRound(true)}
        />
      </TabsContent>
    </Tabs>
  )

  return (
    <div className={cn('flex flex-col gap-4 immersive:min-h-dvh immersive:gap-3 immersive:p-3 sm:immersive:p-4', pinned && 'h-dvh')}>
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between immersive:xl:items-center">
        <div className="immersive:hidden">
          <p className="hud-label text-neon-cyan">Randomizer Studio</p>
          <h1 className="mt-1 text-3xl font-extrabold">สตูดิโอสุ่ม</h1>
        </div>
        <h1 className="sr-only hidden immersive:block">สตูดิโอสุ่ม — โหมดจอใหญ่</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center immersive:w-full">
          <Select
            value={classroomId ?? NO_CLASSROOM}
            onValueChange={(value) => setClassroom(value === NO_CLASSROOM ? null : value)}
            disabled={busy}
          >
            <SelectTrigger className="md:w-60" aria-label="ห้องเรียน">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
              {classrooms.length > 0 ? <SelectSeparator /> : null}
              <SelectItem value={NO_CLASSROOM}>ไม่ใช้รายชื่อ (สุ่มตัวเลข)</SelectItem>
            </SelectContent>
          </Select>
          <ModeTabs value={mode} onValueChange={setMode} disabled={busy || drawType === 'team'} />
          <Hint label={immersive ? 'ออกจากโหมดจอใหญ่ (Esc)' : 'โหมดจอใหญ่ (F)'}>
            <Button
              variant={immersive ? 'secondary' : 'outline'}
              onClick={toggleBigScreen}
              aria-pressed={immersive}
              className="shrink-0 immersive:md:ml-auto"
            >
              {immersive ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {immersive ? 'ออกจากจอใหญ่' : 'จอใหญ่'}
            </Button>
          </Hint>
        </div>
      </header>

      {/* On wide screens the stage and the side panel share one viewport-high row, so nothing scrolls. */}
      <div
        className={cn(
          'grid gap-4',
          pinned && 'min-h-0 flex-1',
          wide && 'h-[max(35rem,calc(100dvh-10.5rem))] grid-cols-[minmax(0,1fr)_23rem]',
        )}
      >
        <GlassCard highlighted className="flex min-h-0 min-w-0 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="gold">{stageMode === 'team' ? 'Team Random' : MODE_META[mode].english}</Badge>
              {sourceLabel ? <Badge variant="muted">{sourceLabel}</Badge> : null}
              <Badge variant={policy === 'no-repeat' ? 'cyan' : 'pink'}>{policy === 'no-repeat' ? 'ไม่ซ้ำ' : 'ซ้ำได้'}</Badge>
              <Badge variant="lime" data-testid="pool-count">
                {policy === 'no-repeat' && drawType !== 'team'
                  ? `เหลือ ${eligible.length} / ${active.length}`
                  : `ผู้เข้าร่วม ${active.length}`}
              </Badge>
            </div>
            {wide ? null : (
              <Button variant="secondary" size="sm" onClick={() => setPanelOpen(true)}>
                <SlidersHorizontal aria-hidden />
                ผู้เข้าร่วมและกติกา
              </Button>
            )}
          </div>

          <div
            ref={stageRef}
            data-testid="stage"
            data-phase={phase}
            className={cn(
              'relative overflow-hidden rounded-2xl [container-type:size]',
              // Beside the panel or pinned in Big Screen Mode the stage fills the card;
              // otherwise it gets a fixed share of the viewport (a larger one in Big Screen Mode).
              wide || pinned
                ? 'min-h-0 flex-1'
                : immersive
                  ? 'h-[min(74dvh,38rem)]'
                  : 'h-[min(62dvh,27rem)] sm:h-[clamp(22rem,calc(100dvh-25.5rem),46rem)]',
              phase === 'reveal' && profile.shake && 'animate-shake',
            )}
          >
            <StudioStage
              controller={controller}
              mode={stageMode}
              eligible={eligible}
              poolKey={key}
              timeScale={timeScale}
              ambient={profile.ambient}
              countdownSeconds={animation.countdownSeconds}
              cardSlots={cardSlots}
              teamPreview={teamPreview}
            />

            {phase === 'idle' && candidates.length === 0 ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/85 p-6 text-center">
                <Users className="size-10 text-neon-cyan" aria-hidden />
                <p className="text-xl font-bold">ยังไม่มีผู้เข้าร่วม</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  เพิ่มรายชื่อนักเรียนในห้องนี้ หรือสลับไปสุ่มจากตัวเลขในแท็บ “กติกา”
                </p>
                {classroom ? (
                  <Button asChild>
                    <Link to={`/classrooms/${classroom.id}`}>
                      <UserPlus aria-hidden />
                      เพิ่มรายชื่อ
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {phase === 'idle' && roundComplete ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/85 p-6 text-center" role="status">
                <PartyPopper className="size-12 text-neon-gold" aria-hidden />
                <p className="text-[clamp(1.4rem,6cqmin,2.6rem)] font-extrabold">สุ่มครบทุกคนแล้ว!</p>
                <p className="text-muted-foreground">ทั้ง {active.length} คนถูกสุ่มครบในรอบนี้</p>
              </div>
            ) : null}

            {/* One overlay at a time: the previous one finishes leaving before the next one enters. */}
            <AnimatePresence mode="wait">
              {phase === 'ready' ? <ReadyBanner key="ready" reduced={animation.level === 'low'} /> : null}
              {phase === 'reveal' && current && plan ? (
                <WinnerReveal
                  key={`reveal-${current.id}-${state.revealed.length}`}
                  winner={current}
                  index={state.revealed.length - 1}
                  total={plan.picks}
                  policy={plan.policy}
                  display={display}
                  rays={profile.rays}
                  reduced={animation.level === 'low'}
                  againLabel="สุ่มต่อ"
                  canDrawAgain={canDrawAgain}
                  onAgain={again}
                  onClose={close}
                  onNext={advance}
                  onExclude={() => excludeWinner(current)}
                  onPutBack={() => putWinnerBack(current)}
                />
              ) : null}
              {phase === 'summary' && plan && state.mode !== 'team' ? (
                <DrawSummary
                  key="summary"
                  winners={state.revealed}
                  clamped={plan.clamped}
                  reduced={animation.level === 'low'}
                  canDrawAgain={canDrawAgain}
                  onAgain={again}
                  onClose={close}
                />
              ) : null}
            </AnimatePresence>
            <Confetti fireKey={celebration?.key ?? null} count={celebration?.count ?? 0} />
          </div>

          <div className="flex flex-col items-center gap-3 lg:flex-row lg:justify-between">
            <SegmentedControl<DrawType>
              label="รูปแบบการจับ"
              value={drawType}
              onValueChange={setDrawType}
              disabled={busy}
              className="w-full lg:w-72"
              options={DRAW_TYPES.map((value) => ({ value, label: DRAW_TYPE_LABELS[value] }))}
            />

            <div className="flex w-full flex-wrap items-center justify-center gap-2.5 lg:w-auto lg:justify-end">
              {teamSummary ? (
                <>
                  <Button variant="secondary" onClick={() => void copyTeams()}>
                    <ClipboardCopy aria-hidden />
                    คัดลอกรายชื่อทีม
                  </Button>
                  <Button variant="secondary" onClick={again}>
                    <RotateCcw aria-hidden />
                    สุ่มทีมใหม่
                  </Button>
                  <Button onClick={close}>
                    <Check aria-hidden />
                    เสร็จสิ้น
                  </Button>
                </>
              ) : busy ? (
                <>
                  <p className="text-sm font-medium text-neon-cyan" role="status">
                    {statusText[phase] ?? ''}
                  </p>
                  {SKIPPABLE.includes(phase) ? (
                    <Button variant="secondary" onClick={skip}>
                      <SkipForward aria-hidden />
                      ข้าม
                    </Button>
                  ) : null}
                </>
              ) : roundComplete ? (
                <Button variant="neon" size="xl" className="w-full sm:w-auto" onClick={() => setConfirmNewRound(true)}>
                  <RotateCcw aria-hidden />
                  เริ่มรอบใหม่
                </Button>
              ) : (
                <div className="relative w-full sm:w-auto">
                  {/* The glow pulses behind the button; the button itself stays still so it is easy to hit. */}
                  {profile.ambient && canStart ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-1 animate-glow-pulse rounded-3xl bg-[linear-gradient(120deg,var(--neon-violet),var(--neon-pink))] blur-xl"
                    />
                  ) : null}
                  <Button
                    variant="neon"
                    size="xl"
                    className="relative w-full sm:min-w-64"
                    onClick={handleStart}
                    disabled={!canStart}
                    data-testid="draw-button"
                  >
                    {actionLabel}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {wide ? <GlassCard className="flex min-h-0 flex-col p-4 sm:p-4">{sidePanel}</GlassCard> : null}
      </div>

      {/* The panel is rendered once: beside the stage on wide screens, in a sheet everywhere else. */}
      <Sheet open={panelOpen && !wide} onOpenChange={setPanelOpen}>
        <SheetContent side="bottom" className="h-[82dvh]">
          <SheetHeader>
            <SheetTitle>ผู้เข้าร่วมและกติกา</SheetTitle>
            <SheetDescription>เลือกผู้เข้าร่วมและปรับกติกาการสุ่ม</SheetDescription>
          </SheetHeader>
          {sidePanel}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmNewRound}
        onOpenChange={setConfirmNewRound}
        title="เริ่มรอบใหม่?"
        description={`ผู้ที่ถูกสุ่มแล้ว ${record.drawnIds.length} คนจะกลับเข้ากองสุ่ม ประวัติของรอบนี้ยังคงอยู่ในหน้าประวัติ`}
        confirmLabel="เริ่มรอบใหม่"
        onConfirm={startNewRound}
      />
    </div>
  )
}

export default function StudioPage() {
  return (
    <DataBoundary>
      <Studio />
    </DataBoundary>
  )
}

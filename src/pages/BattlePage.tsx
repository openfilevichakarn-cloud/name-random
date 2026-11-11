import { EllipsisVertical, Flag, Maximize, Minimize, RotateCcw, Shuffle, Swords, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/tooltip'
import { BattleResults } from '@/features/battle/components/BattleResults'
import { FinishBattleDialog } from '@/features/battle/components/FinishBattleDialog'
import { TeamScoreCard, type ScorePulse } from '@/features/battle/components/TeamScoreCard'
import { describeOutcome, leaders, pickMember, pickTeam, standings, winningMembers } from '@/features/battle/lib/battle'
import { awardBattleStars } from '@/features/battle/lib/stars'
import { Confetti } from '@/features/randomizer/components/Confetti'
import { cryptoRng } from '@/features/randomizer/engine/rng'
import { stageColor } from '@/features/randomizer/stages/types'
import { useBigScreen } from '@/hooks/useBigScreen'
import { useRoulette } from '@/hooks/useRoulette'
import { getAnimationProfile } from '@/lib/animation/levels'
import { playSfx } from '@/lib/audio/sfx'
import { formatTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useBattleStore } from '@/stores/battleStore'
import { useSettings } from '@/stores/settingsStore'
import { useStudioStore } from '@/stores/studioStore'

/** Grid columns that keep every team visible: 2 → 2, 3 → 3, 4 → 2×2 (4 on very wide screens), … */
function gridColumns(count: number): string {
  if (count <= 2) return 'sm:grid-cols-2'
  if (count === 3) return 'sm:grid-cols-2 lg:grid-cols-3'
  if (count === 4) return 'sm:grid-cols-2 2xl:grid-cols-4'
  return 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
}

export default function BattlePage() {
  const battle = useBattleStore((state) => state.battle)
  const animation = useSettings('animation')
  const features = useSettings('features')
  const navigate = useNavigate()
  const { immersive, toggle: toggleBigScreen, exit: exitBigScreen } = useBigScreen()
  const teamRoulette = useRoulette()
  const speakerRoulette = useRoulette()
  const [speakerTeam, setSpeakerTeam] = useState<number | null>(null)
  const [pulse, setPulse] = useState<ScorePulse | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [confirm, setConfirm] = useState<'restart' | 'close' | null>(null)
  const [celebration, setCelebration] = useState<string | null>(null)

  const reduced = animation.level === 'low'
  const profile = getAnimationProfile(animation.level)
  const finished = battle?.finishedAt != null
  const spinning = teamRoulette.spinning || speakerRoulette.spinning
  const leading = useMemo(() => (battle ? leaders(battle) : []), [battle])
  const table = useMemo(() => (battle ? standings(battle) : []), [battle])
  const starMembers = useMemo(() => (battle && features.stars ? winningMembers(battle) : []), [battle, features.stars])
  const { reset: resetTeamRoulette } = teamRoulette
  const { reset: resetSpeakerRoulette } = speakerRoulette

  const clearPicks = useCallback(() => {
    resetTeamRoulette()
    resetSpeakerRoulette()
    setSpeakerTeam(null)
  }, [resetTeamRoulette, resetSpeakerRoulette])

  const score = useCallback(
    (team: number, delta: number) => {
      const before = useBattleStore.getState().battle
      const target = before?.teams[team]
      if (!before || !target || before.finishedAt) return
      useBattleStore.getState().score(team, delta)
      const after = useBattleStore.getState().battle?.teams[team]?.score ?? target.score
      if (after === target.score) return
      clearPicks()
      setPulse({ id: Date.now(), team, delta })
      setAnnouncement(`${target.name} ${delta > 0 ? 'ได้' : 'เสีย'} ${Math.abs(delta)} คะแนน รวม ${after}`)
      playSfx(delta > 0 ? 'confetti' : 'click', { volume: delta > 0 ? 0.55 : 0.8 })
    },
    [clearPicks],
  )

  const undo = useCallback(() => {
    const current = useBattleStore.getState().battle
    const last = current?.log[current.log.length - 1]
    if (!current || !last || current.finishedAt) return
    useBattleStore.getState().undo()
    const team = current.teams[last.team]
    setPulse({ id: Date.now(), team: last.team, delta: -last.delta })
    setAnnouncement(`ย้อนกลับ: ${team?.name ?? ''} เหลือ ${(team?.score ?? 0) - last.delta} คะแนน`)
    playSfx('click')
  }, [])

  const spinTeams = () => {
    if (!battle || spinning) return
    const target = pickTeam(battle, cryptoRng)
    if (target === null) return
    resetSpeakerRoulette()
    setSpeakerTeam(null)
    setAnnouncement('')
    teamRoulette.spin(`team:${Date.now()}`, battle.teams.length, target, { instant: reduced })
  }

  const spinSpeaker = (teamIndex: number) => {
    const team = battle?.teams[teamIndex]
    if (!team || spinning) return
    // The speaker is decided first; the light then runs through the team and stops on them.
    const chosen = pickMember(team, cryptoRng)
    const target = team.members.findIndex((member) => member.id === chosen?.id)
    if (target < 0) return
    resetTeamRoulette()
    setSpeakerTeam(teamIndex)
    setAnnouncement('')
    speakerRoulette.spin(`speaker:${Date.now()}`, team.members.length, target, { duration: 1300, instant: reduced })
  }

  // Announce random picks once they land.
  const chosenTeam = teamRoulette.state?.done ? teamRoulette.state.index : null
  const chosenSpeaker =
    speakerRoulette.state?.done && speakerTeam !== null
      ? (battle?.teams[speakerTeam]?.members[speakerRoulette.state.index] ?? null)
      : null
  const pickMessage =
    chosenTeam !== null
      ? `${battle?.teams[chosenTeam]?.name ?? ''} ได้ตอบ!`
      : chosenSpeaker && speakerTeam !== null
        ? `ตัวแทน${battle?.teams[speakerTeam]?.name ?? ''}: ${chosenSpeaker.label}`
        : ''

  const finish = async (awardStars: boolean) => {
    const current = useBattleStore.getState().battle
    if (!current || current.finishedAt) return
    setFinishing(true)
    try {
      if (awardStars) {
        const { awarded, failed } = await awardBattleStars(winningMembers(current))
        if (awarded > 0) useBattleStore.getState().markStarsAwarded()
        if (failed > 0) toast.error(`ให้ดาวไม่สำเร็จ ${failed} คน (อาจถูกลบออกจากประวัติแล้ว)`)
      }
      useBattleStore.getState().finish()
      clearPicks()
      setFinishOpen(false)
      setCelebration(`${current.id}:${Date.now()}`)
      playSfx('winner')
    } finally {
      setFinishing(false)
    }
  }

  const newTeams = () => {
    useBattleStore.getState().clear()
    useStudioStore.getState().setDrawType('team')
    void navigate('/studio')
  }

  // Keyboard: 1–9 adds a point to team 1–9, Shift+digit takes one away, Backspace undoes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"]',
        )
      ) {
        return
      }
      if (event.key === 'Escape' && immersive) {
        exitBigScreen()
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        toggleBigScreen()
        return
      }
      const digit = /^Digit([1-9])$/.exec(event.code)
      if (digit) {
        event.preventDefault()
        score(Number(digit[1]) - 1, event.shiftKey ? -1 : 1)
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [score, undo, immersive, exitBigScreen, toggleBigScreen])

  if (!battle) {
    return (
      <EmptyState
        icon={Swords}
        title="ยังไม่มีการแข่งขัน"
        description="แบ่งทีมในสตูดิโอ แล้วกด “เริ่ม Team Battle” เพื่อเปิดกระดานคะแนนของแต่ละทีม"
        className="mt-10"
      >
        <Button variant="neon" size="lg" onClick={newTeams}>
          <Swords aria-hidden />
          ไปแบ่งทีมในสตูดิโอ
        </Button>
      </EmptyState>
    )
  }

  const memberCount = battle.teams.reduce((sum, team) => sum + team.members.length, 0)

  return (
    <div className="flex flex-col gap-5 immersive:min-h-dvh immersive:p-4 sm:immersive:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="hud-label text-neon-pink">Team Battle</p>
          <h1 className="mt-1 truncate text-3xl font-extrabold immersive:text-4xl">{battle.title || 'Team Battle'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            เริ่ม {formatTime(battle.startedAt)} น. · {battle.teams.length} ทีม · {memberCount} คน
            {finished ? ' · จบเกมแล้ว' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {finished ? null : (
            <>
              <Button variant="neon" onClick={spinTeams} disabled={spinning}>
                <Shuffle aria-hidden />
                สุ่มทีมตอบ
              </Button>
              <Hint label="ย้อนกลับคะแนนล่าสุด (Backspace)">
                <Button variant="secondary" onClick={undo} disabled={battle.log.length === 0}>
                  <Undo2 aria-hidden />
                  ย้อนกลับ
                </Button>
              </Hint>
              <Button variant="secondary" onClick={() => setFinishOpen(true)}>
                <Flag aria-hidden />
                จบเกม
              </Button>
            </>
          )}
          <Hint label={immersive ? 'ออกจากโหมดจอใหญ่ (Esc)' : 'โหมดจอใหญ่ (F)'}>
            <Button variant={immersive ? 'secondary' : 'outline'} onClick={toggleBigScreen} aria-pressed={immersive}>
              {immersive ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {immersive ? 'ออกจากจอใหญ่' : 'จอใหญ่'}
            </Button>
          </Hint>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="ตัวเลือกการแข่งขัน">
                <EllipsisVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConfirm('restart')}>
                <RotateCcw aria-hidden />
                เริ่มนับคะแนนใหม่
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={newTeams}>
                <Swords aria-hidden />
                แบ่งทีมใหม่
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('close')}>
                <X aria-hidden />
                ปิดการแข่งขัน
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {pickMessage || announcement}
      </p>
      {pickMessage ? (
        <p
          className="self-center rounded-full border border-neon-pink/50 bg-neon-pink/15 px-5 py-2 text-lg font-bold text-[#f9a8d4] shadow-[0_0_28px_-8px_var(--neon-pink)]"
          data-testid="battle-pick"
        >
          {pickMessage}
        </p>
      ) : null}

      {finished ? (
        <BattleResults
          battle={battle}
          standings={table}
          winners={leading}
          reduced={reduced}
          onRestart={() => {
            useBattleStore.getState().restart()
            clearPicks()
            toast.success('เริ่มเกมใหม่ด้วยทีมเดิมแล้ว')
          }}
          onNewTeams={newTeams}
          onClose={() => useBattleStore.getState().clear()}
        />
      ) : null}

      <div className={cn('grid grid-cols-1 gap-4', gridColumns(battle.teams.length))}>
        {battle.teams.map((team, index) => {
          const passing = teamRoulette.state && !teamRoulette.state.done && teamRoulette.state.index === index
          const speakerState =
            speakerTeam === index && speakerRoulette.state
              ? {
                  id: team.members[speakerRoulette.state.index]?.id ?? '',
                  done: speakerRoulette.state.done,
                }
              : null
          return (
            <TeamScoreCard
              key={index}
              team={team}
              index={index}
              color={stageColor(index, battle.teams.length)}
              leading={leading.includes(index)}
              spotlight={passing ? 'passing' : chosenTeam === index ? 'chosen' : null}
              speaker={speakerState}
              pulse={pulse}
              frozen={finished}
              spinning={spinning}
              shortcut={index < 9 && !finished ? index + 1 : null}
              reduced={reduced}
              onScore={(delta) => score(index, delta)}
              onPickSpeaker={() => spinSpeaker(index)}
            />
          )
        })}
      </div>

      {finished ? null : (
        <p className="hidden text-center text-sm text-muted-foreground pointer-fine:block">
          คีย์ลัด: กด 1–9 เพิ่มคะแนนทีมนั้น · Shift + เลข ลดคะแนน · Backspace ย้อนกลับ · F จอใหญ่
        </p>
      )}

      <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
        <Confetti fireKey={celebration} count={animation.confetti ? profile.confetti : 0} />
      </div>

      <FinishBattleDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        outcome={describeOutcome(battle, leading)}
        starCandidates={starMembers.length}
        pending={finishing}
        onConfirm={(awardStars) => void finish(awardStars)}
      />
      <ConfirmDialog
        open={confirm === 'restart'}
        onOpenChange={(open) => setConfirm(open ? 'restart' : null)}
        title="เริ่มนับคะแนนใหม่?"
        description="คะแนนของทุกทีมจะกลับเป็น 0 ทีมและสมาชิกยังเหมือนเดิม"
        confirmLabel="เริ่มนับใหม่"
        tone="destructive"
        onConfirm={() => {
          useBattleStore.getState().restart()
          clearPicks()
        }}
      />
      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(open) => setConfirm(open ? 'close' : null)}
        title="ปิดการแข่งขัน?"
        description="กระดานคะแนนนี้จะถูกล้าง ประวัติการแบ่งทีมและดาวที่ให้แล้วยังอยู่ครบ"
        confirmLabel="ปิดการแข่งขัน"
        tone="destructive"
        onConfirm={() => useBattleStore.getState().clear()}
      />
    </div>
  )
}

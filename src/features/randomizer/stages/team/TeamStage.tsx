import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { Candidate, Team } from '../../engine/types'
import { stageColor, type StagePhase } from '../types'

const SHUFFLE_STEP_MS = 150
const SHUFFLE_STEPS = 9
const DEAL_STEP_MS = 85

function MemberChip({ member, compact = false }: { member: Candidate; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-ink/70 font-semibold',
        compact ? 'py-1 pr-3 pl-1 text-sm' : 'w-full py-1 pr-3 pl-1',
      )}
    >
      {member.avatar ? (
        <StudentAvatar avatar={member.avatar} seed={member.id} className={compact ? 'size-7' : 'size-8'} />
      ) : (
        <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-neon-violet/25 text-xs text-neon-cyan">
          #
        </span>
      )}
      <span className="truncate">{member.label}</span>
    </span>
  )
}

export interface TeamStageProps {
  phase: StagePhase
  teams: readonly Team[]
  /** Changes with every new split; null before the first one. */
  dealKey: string | null
  /** Shown before the first split: how the pool is about to be divided. */
  preview: { members: number; teams: number }
  timeScale: number
  onSettled: (dealKey: string) => void
}

/**
 * Team Random / Group Maker. Names are shuffled in front of the class, then dealt into the
 * teams the engine already decided, one member at a time.
 */
export function TeamStage({ phase, teams, dealKey, preview, timeScale, onSettled }: TeamStageProps) {
  const latest = useLatest({ timeScale, onSettled })
  const everyone = useMemo(() => teams.flatMap((team) => team.members), [teams])
  // Deal order: first member of every team, then the second of every team, and so on.
  const sequence = useMemo(() => {
    const longest = teams.reduce((max, team) => Math.max(max, team.members.length), 0)
    const order: string[] = []
    for (let row = 0; row < longest; row += 1) {
      for (const team of teams) {
        const member = team.members[row]
        if (member) order.push(member.id)
      }
    }
    return order
  }, [teams])

  const [cloud, setCloud] = useState<Candidate[] | null>(null)
  const [dealt, setDealt] = useState(0)

  useEffect(() => {
    if (!dealKey || phase !== 'running') return
    const scale = latest.current.timeScale
    const timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false

    setDealt(0)
    setCloud(everyone)
    playSfx('spin')

    // Act 1: shuffle the whole class on screen (cosmetic order only).
    const steps = Math.max(2, Math.round(SHUFFLE_STEPS * scale))
    for (let step = 1; step <= steps; step += 1) {
      timers.push(
        setTimeout(() => {
          if (cancelled) return
          setCloud((current) => (current ? [...current].sort(() => Math.random() - 0.5) : current))
          playSfx('tick', { volume: 0.5 })
        }, step * SHUFFLE_STEP_MS),
      )
    }

    // Act 2: deal into teams.
    const dealStart = (steps + 1) * SHUFFLE_STEP_MS
    const dealStep = Math.max(35, DEAL_STEP_MS * scale)
    timers.push(
      setTimeout(() => {
        if (!cancelled) setCloud(null)
      }, dealStart),
    )
    sequence.forEach((_id, index) => {
      timers.push(
        setTimeout(
          () => {
            if (cancelled) return
            setDealt(index + 1)
            playSfx('tick', { rate: 1.2 })
          },
          dealStart + (index + 1) * dealStep,
        ),
      )
    })
    timers.push(
      setTimeout(
        () => {
          if (!cancelled) latest.current.onSettled(dealKey)
        },
        dealStart + (sequence.length + 2) * dealStep,
      ),
    )

    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one animation per deal
  }, [dealKey, phase === 'running'])

  // Anything but the running animation shows the finished teams (this also handles "skip").
  const showAll = phase !== 'running'
  const visible = useMemo(() => new Set(showAll ? sequence : sequence.slice(0, dealt)), [showAll, sequence, dealt])

  if (teams.length === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-24 items-center justify-center rounded-3xl border border-neon-cyan/40 bg-neon-cyan/10">
          <Users className="size-11 text-neon-cyan" aria-hidden />
        </div>
        <p className="text-[clamp(1.25rem,5cqmin,2.25rem)] font-extrabold">
          {preview.members >= 2 ? (
            <>
              แบ่ง <span className="text-neon-cyan">{preview.members}</span> คน เป็น{' '}
              <span className="text-neon-pink">{preview.teams}</span> ทีม
            </>
          ) : (
            'ต้องมีอย่างน้อย 2 คนจึงจะแบ่งทีมได้'
          )}
        </p>
        <p className="text-muted-foreground">กดปุ่มด้านล่างเพื่อสับรายชื่อและแบ่งทีม</p>
      </div>
    )
  }

  if (cloud && !showAll) {
    return (
      <div className="flex size-full items-center justify-center overflow-hidden" aria-hidden>
        <div className="flex max-h-full flex-wrap items-center justify-center gap-2 p-2">
          {cloud.map((member) => (
            <motion.span key={member.id} layout transition={{ type: 'spring', stiffness: 520, damping: 36 }}>
              <MemberChip member={member} compact />
            </motion.span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="size-full overflow-y-auto pr-1">
      <ul
        className="grid min-h-full content-center gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(11.5rem, 100%), 1fr))' }}
      >
        {teams.map((team) => {
          const color = stageColor(team.index)
          return (
            <li
              key={team.index}
              className="glass flex flex-col gap-2 rounded-2xl p-3"
              style={{ borderColor: color, boxShadow: `0 0 26px -12px ${color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold" style={{ color }}>
                  {team.name}
                </h3>
                <span className="tabular rounded-full bg-ink/70 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {team.members.length} คน
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {team.members.map((member) =>
                  visible.has(member.id) ? (
                    <motion.li
                      key={member.id}
                      initial={showAll ? false : { opacity: 0, scale: 0.5, y: -14 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                    >
                      <MemberChip member={member} />
                    </motion.li>
                  ) : (
                    <li key={member.id} aria-hidden className="h-10 rounded-full border border-dashed border-border/70" />
                  ),
                )}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

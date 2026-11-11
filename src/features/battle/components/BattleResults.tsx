import { motion } from 'framer-motion'
import { Medal, RotateCcw, Star, Swords, Trophy, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { describeOutcome, type Battle, type Standing } from '../lib/battle'

interface BattleResultsProps {
  battle: Battle
  standings: readonly Standing[]
  winners: readonly number[]
  reduced: boolean
  onRestart: () => void
  onNewTeams: () => void
  onClose: () => void
}

/** The end of a Team Battle: the winner, the final standings and what to do next. */
export function BattleResults({
  battle,
  standings,
  winners,
  reduced,
  onRestart,
  onNewTeams,
  onClose,
}: BattleResultsProps) {
  const outcome = describeOutcome(battle, winners)
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass-strong relative overflow-hidden rounded-3xl border-neon-gold/40 p-5 sm:p-7"
      aria-labelledby="battle-result-title"
      data-testid="battle-results"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgb(251_191_36/0.22),transparent_55%)]"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-neon-gold/20 text-neon-gold shadow-[0_0_32px_-6px_var(--neon-gold)]">
            <Trophy className="size-9" aria-hidden />
          </span>
          <div>
            <p className="hud-label text-neon-gold">Final Result</p>
            <h2
              id="battle-result-title"
              className="text-gradient-gold text-[clamp(1.6rem,3.2vw,2.6rem)] leading-tight font-extrabold text-balance"
              role="status"
            >
              {outcome}!
            </h2>
            {battle.starsAwarded ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-neon-gold">
                <Star className="size-4 fill-current" aria-hidden />
                ให้ดาวสมาชิกทีมที่ชนะแล้ว
              </p>
            ) : null}
          </div>
        </div>

        <ol className="flex flex-wrap gap-2" aria-label="อันดับสุดท้าย">
          {standings.map(({ index, team, rank }) => (
            <li
              key={index}
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3 py-2',
                rank === 1 && winners.length > 0 ? 'border-neon-gold/60 bg-neon-gold/12' : 'border-border bg-ink/50',
              )}
            >
              <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                {rank === 1 && winners.length > 0 ? <Medal className="size-4 text-neon-gold" aria-hidden /> : null}
                อันดับ {rank}
              </span>
              <span className="font-semibold">{team.name}</span>
              <span className="tabular text-lg font-extrabold">{team.score}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2.5">
        <Button variant="neon" onClick={onRestart}>
          <RotateCcw aria-hidden />
          แข่งใหม่ด้วยทีมเดิม
        </Button>
        <Button variant="secondary" onClick={onNewTeams}>
          <Swords aria-hidden />
          แบ่งทีมใหม่
        </Button>
        <Button variant="ghost" onClick={onClose}>
          <X aria-hidden />
          ปิดการแข่งขัน
        </Button>
      </div>
    </motion.section>
  )
}

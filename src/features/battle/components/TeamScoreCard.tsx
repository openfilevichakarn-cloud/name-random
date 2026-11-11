import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Dices, Minus, Plus } from 'lucide-react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { SCORE_STEPS, type BattleTeam } from '../lib/battle'

export interface ScorePulse {
  /** Unique per change, replays the floating "+1". */
  id: number
  team: number
  delta: number
}

interface TeamScoreCardProps {
  team: BattleTeam
  index: number
  color: string
  leading: boolean
  /** Lit up by "สุ่มทีมตอบ": `passing` while the light moves, `chosen` when it lands here. */
  spotlight: 'passing' | 'chosen' | null
  /** Member lit up by "สุ่มตัวแทน", and whether the pick is final. */
  speaker: { id: string; done: boolean } | null
  pulse: ScorePulse | null
  /** Scores are frozen (the game is over). */
  frozen: boolean
  /** A random pick is running somewhere on the board. */
  spinning: boolean
  /** Keyboard digit for +1, shown as a hint (1–9). */
  shortcut: number | null
  reduced: boolean
  onScore: (delta: number) => void
  onPickSpeaker: () => void
}

/** One team on the Team Battle board: big score, score buttons, members and a speaker picker. */
export function TeamScoreCard({
  team,
  index,
  color,
  leading,
  spotlight,
  speaker,
  pulse,
  frozen,
  spinning,
  shortcut,
  reduced,
  onScore,
  onPickSpeaker,
}: TeamScoreCardProps) {
  const ownPulse = pulse && pulse.team === index ? pulse : null
  return (
    <motion.section
      layout={!reduced}
      aria-labelledby={`team-${index}-name`}
      data-testid={`team-card-${index}`}
      className={cn(
        'glass relative flex min-w-0 flex-col gap-3 rounded-3xl p-4 transition-shadow duration-200 sm:p-5',
        leading && 'shadow-[0_0_0_2px_var(--neon-gold),0_0_40px_-8px_var(--neon-gold)]',
        spotlight === 'passing' && 'shadow-[0_0_0_2px_var(--neon-cyan),0_0_32px_-6px_var(--neon-cyan)]',
        spotlight === 'chosen' && 'shadow-[0_0_0_3px_var(--neon-pink),0_0_48px_-6px_var(--neon-pink)]',
      )}
      style={{
        backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${color} 22%, transparent), transparent 60%)`,
      }}
    >
      <header className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="size-3.5 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        />
        <h2 id={`team-${index}-name`} className="min-w-0 truncate text-xl font-extrabold immersive:text-2xl">
          {team.name}
        </h2>
        {spotlight === 'chosen' ? (
          <span className="rounded-full bg-neon-pink/20 px-2.5 py-0.5 text-sm font-bold text-[#f9a8d4]">
            ตาทีมนี้ตอบ!
          </span>
        ) : null}
        {leading ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-gold/15 px-2.5 py-0.5 text-sm font-bold text-neon-gold">
            <Crown className="size-4" aria-hidden />
            นำอยู่
          </span>
        ) : null}
      </header>

      <div className="relative flex flex-col items-center py-1">
        {/* A stable box for the score: the old number pops out of layout while the new one comes in. */}
        <span className="relative block" data-testid={`team-score-${index}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={team.score}
              initial={reduced ? false : { y: 18, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { y: -18, opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="tabular block text-[clamp(3.5rem,9vw,6rem)] leading-none font-extrabold immersive:text-[clamp(4.5rem,11vw,9rem)]"
              style={{ color, textShadow: `0 0 28px color-mix(in oklab, ${color} 55%, transparent)` }}
            >
              {team.score}
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence>
          {ownPulse && !reduced ? (
            <motion.span
              key={ownPulse.id}
              aria-hidden
              initial={{ opacity: 1, y: 0, scale: 0.9 }}
              animate={{ opacity: 0, y: -46, scale: 1.25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className={cn(
                'pointer-events-none absolute top-0 right-[18%] text-2xl font-extrabold',
                ownPulse.delta > 0 ? 'text-neon-lime' : 'text-neon-pink',
              )}
            >
              {ownPulse.delta > 0 ? `+${ownPulse.delta}` : ownPulse.delta}
            </motion.span>
          ) : null}
        </AnimatePresence>
        <p className="text-sm text-muted-foreground">
          คะแนน<span className="sr-only"> {team.name}</span>
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onScore(-1)}
          disabled={frozen}
          aria-label={`ลด 1 คะแนน ${team.name}`}
        >
          <Minus aria-hidden />
        </Button>
        {SCORE_STEPS.map((step, position) => (
          <Button
            key={step}
            variant={position === 0 ? 'neon' : 'secondary'}
            size={position === 0 ? 'lg' : 'default'}
            onClick={() => onScore(step)}
            disabled={frozen}
            aria-label={`เพิ่ม ${step} คะแนน ${team.name}`}
            className={position === 0 ? 'min-w-24' : undefined}
          >
            <Plus aria-hidden />
            {step}
            {position === 0 && shortcut !== null ? (
              <kbd className="ml-1 hidden rounded-md border border-white/30 px-1.5 text-xs font-semibold pointer-fine:inline">
                {shortcut}
              </kbd>
            ) : null}
          </Button>
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label={`สมาชิก ${team.name}`}>
        {team.members.map((member) => {
          const lit = speaker?.id === member.id
          return (
            <li
              key={member.id}
              className={cn(
                'inline-flex min-w-0 items-center gap-1.5 rounded-full border bg-ink/60 py-0.5 pr-2.5 pl-0.5 text-sm font-medium transition-all duration-150',
                lit && speaker?.done
                  ? 'scale-110 border-neon-gold bg-neon-gold/20 text-neon-gold shadow-[0_0_18px_-2px_var(--neon-gold)]'
                  : lit
                    ? 'border-neon-cyan bg-neon-cyan/15'
                    : 'border-border',
              )}
              aria-current={lit && speaker?.done ? 'true' : undefined}
            >
              {member.avatar ? (
                <StudentAvatar avatar={member.avatar} seed={member.id} className="size-6" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-neon-violet/25 text-[0.65rem] text-neon-cyan">
                  #
                </span>
              )}
              <span className="truncate">{member.label}</span>
            </li>
          )
        })}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        className="mt-auto self-center"
        onClick={onPickSpeaker}
        disabled={spinning || team.members.length === 0}
      >
        <Dices aria-hidden />
        สุ่มตัวแทนทีม
      </Button>
    </motion.section>
  )
}

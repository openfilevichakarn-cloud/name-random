import { motion } from 'framer-motion'
import { ChevronRight, Sparkles, Undo2, UserMinus, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Button } from '@/components/ui/button'
import type { DisplaySettings, NameSize } from '@/data/settings'
import type { RepeatPolicy } from '@/data/types'
import { graphemeLength } from '@/features/students/lib/text'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { Candidate } from '../engine/types'

/** Base size of the winner's name, in container-query units. */
const NAME_SCALE: Record<NameSize, number> = { md: 13, lg: 17, xl: 21 }

export interface WinnerRevealProps {
  winner: Candidate
  /** 0-based position within the draw and the number of winners in it. */
  index: number
  total: number
  policy: RepeatPolicy
  display: DisplaySettings
  /** Rotating light rays behind the winner. */
  rays: boolean
  /** Calm entrance for the Low animation level. */
  reduced: boolean
  /** Label of the "draw again" button. */
  againLabel: string
  /** Whether another draw is possible right now (false once a no-repeat round is used up). */
  canDrawAgain: boolean
  onAgain: () => void
  onClose: () => void
  /** Multiple draws: jump to the next winner without waiting. */
  onNext: () => void
  /** Allow-repeat: take this winner out of the pool ("Exclude Selected"). */
  onExclude: () => void
  /** No-repeat: return this winner to the round. */
  onPutBack: () => void
  /** Small badges under the name (Lucky Streak). */
  badges?: ReactNode
  /** The winner's game panel (reward, mission, quiz, stars). Sits beside the winner on wide stages. */
  children?: ReactNode
}

/**
 * Steps 7–10 of the reveal sequence: the name and avatar, the fanfare, then the next-round button.
 */
export function WinnerReveal({
  winner,
  index,
  total,
  policy,
  display,
  rays,
  reduced,
  againLabel,
  canDrawAgain,
  onAgain,
  onClose,
  onNext,
  onExclude,
  onPutBack,
  badges,
  children,
}: WinnerRevealProps) {
  const primaryRef = useRef<HTMLButtonElement>(null)
  const isNumber = winner.id.startsWith('n:')
  const single = total === 1
  const hasPanel = Boolean(children)
  // On a narrow stage the close button sits in the corner, so the main actions fit on one row.
  const cornerClose = single && canDrawAgain
  const length = Math.max(3, graphemeLength(winner.label))
  // With a panel the winner shares the stage, so everything in its column is a little smaller.
  const base = NAME_SCALE[display.nameSize] * (isNumber ? 1.5 : 1) * (hasPanel ? 0.78 : 1)

  // The parent keys this component by winner, so mounting is the reveal moment.
  useEffect(() => {
    playSfx('reveal')
    const fanfare = setTimeout(() => playSfx(single ? 'winner' : 'confetti'), 200)
    // Put keyboard focus on the main action so Enter/Space continues the lesson.
    const focus = setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), reduced ? 50 : 650)
    return () => {
      clearTimeout(fanfare)
      clearTimeout(focus)
    }
  }, [single, reduced])

  const details = [
    !isNumber && display.showNumber && winner.number !== null ? `เลขที่ ${winner.number}` : '',
    display.showFullName || isNumber ? winner.detail : '',
  ].filter(Boolean)

  return (
    <motion.div
      className="absolute inset-0 z-30 overflow-hidden rounded-[inherit] bg-ink/92 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.25 }}
      data-testid="winner-reveal"
    >
      {rays ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2"
        >
          <div className="size-full animate-spin-slow bg-[repeating-conic-gradient(from_0deg,rgb(251_191_36/0.16)_0deg_9deg,transparent_9deg_22deg)] [mask-image:radial-gradient(circle,#000_8%,transparent_58%)]" />
        </div>
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgb(139_92_246/0.38),transparent_55%)]"
      />

      {cornerClose ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-2 right-2 z-20 bg-ink/70 @3xl:hidden"
        >
          <X aria-hidden />
        </Button>
      ) : null}

      {/* The content scrolls on its own layer, so the oversized light rays never become scrollable. */}
      <div className="absolute inset-0 flex flex-col overflow-y-auto p-4">
        <div
          className={cn(
            'relative my-auto grid w-full items-center justify-items-center gap-x-8 gap-y-[2cqh] [--name-span:118]',
            hasPanel && '@3xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] @3xl:[--name-span:60]',
          )}
        >
          <div className="flex w-full min-w-0 flex-col items-center gap-[2cqh]">
            <p className="hud-label flex items-center gap-2 text-neon-gold">
              <Sparkles className="size-4" aria-hidden />
              {single ? 'Winner' : `คนที่ ${index + 1} / ${total}`}
              <Sparkles className="size-4" aria-hidden />
            </p>

            {display.showAvatar && winner.avatar ? (
              <motion.div
                initial={reduced ? false : { scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.05 }}
                className="relative shrink-0"
              >
                <span
                  aria-hidden
                  className="absolute -inset-[8%] animate-glow-pulse rounded-[30%] bg-neon-gold/35 blur-xl"
                />
                <StudentAvatar
                  avatar={winner.avatar}
                  seed={winner.id}
                  className={cn(
                    'relative ring-4 ring-neon-gold ring-offset-4 ring-offset-ink',
                    hasPanel ? 'size-[min(20cqh,28cqw)] @3xl:size-[min(30cqh,20cqw)]' : 'size-[min(30cqh,34cqw)]',
                  )}
                />
              </motion.div>
            ) : null}

            {isNumber ? <p className="tag-label text-neon-cyan">หมายเลข</p> : null}
            <motion.p
              role="status"
              aria-live="assertive"
              initial={reduced ? false : { scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              transition={{ type: 'spring', stiffness: 240, damping: 17, delay: reduced ? 0 : 0.18 }}
              className={cn(
                'max-w-full px-2 leading-[1.25] font-extrabold break-words',
                isNumber ? 'text-gradient-gold tabular' : 'text-gradient',
              )}
              style={{
                fontSize: `clamp(1.75rem, min(${base.toFixed(1)}cqmin, calc(var(--name-span) * 1cqw / ${length})), 14rem)`,
              }}
              data-testid="winner-name"
            >
              {winner.label}
            </motion.p>

            {details.length > 0 ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.35 }}
                className="text-[clamp(0.95rem,3.4cqmin,1.75rem)] text-foreground/85"
              >
                {details.join(' · ')}
              </motion.p>
            ) : null}

            {badges ? <div className="flex flex-wrap items-center justify-center gap-2">{badges}</div> : null}
          </div>

          {hasPanel ? <div className="w-full max-w-md @3xl:max-w-none">{children}</div> : null}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0.05 : 0.6 }}
            className={cn(
              'mt-[1cqh] flex flex-wrap items-center justify-center gap-2.5',
              hasPanel && '@3xl:col-span-2',
              // A narrow stage scrolls when the winner has a panel: keep the next action in reach.
              hasPanel &&
                'sticky bottom-0 z-10 -mx-4 -mb-4 w-[calc(100%+2rem)] gap-2 bg-linear-to-t from-ink from-60% to-transparent px-4 pt-6 pb-3 @3xl:static @3xl:m-0 @3xl:w-full @3xl:gap-2.5 @3xl:bg-none @3xl:p-0',
            )}
          >
            {single ? (
              <>
                {canDrawAgain ? (
                  <Button
                    ref={primaryRef}
                    variant="neon"
                    size="lg"
                    onClick={onAgain}
                    className={cn(
                      hasPanel && 'h-11 rounded-xl px-5 text-base @3xl:h-13 @3xl:rounded-2xl @3xl:px-7 @3xl:text-lg',
                    )}
                  >
                    {againLabel}
                    <ChevronRight aria-hidden />
                  </Button>
                ) : null}
                {policy === 'allow-repeat' ? (
                  <Button variant="secondary" onClick={onExclude}>
                    <UserMinus aria-hidden />
                    ตัดชื่อออก
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={onPutBack}>
                    <Undo2 aria-hidden />
                    ใส่ชื่อกลับ
                  </Button>
                )}
                <Button
                  ref={canDrawAgain ? undefined : primaryRef}
                  variant="ghost"
                  onClick={onClose}
                  className={cn(cornerClose && 'hidden @3xl:inline-flex')}
                >
                  <X aria-hidden />
                  ปิด
                </Button>
              </>
            ) : (
              <Button ref={primaryRef} variant="secondary" onClick={onNext}>
                ถัดไป
                <ChevronRight aria-hidden />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import { Check, Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { QuizOutcome } from '@/data/types'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

const RADIUS = 19
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const TICK_MS = 100
/** Tick sounds for the last seconds. */
const WARN_SECONDS = 5

interface QuizTimerProps {
  seconds: number
  outcome: QuizOutcome | null
  onOutcome: (outcome: QuizOutcome | null) => void
  /** A correct answer earns a star. */
  starReward: boolean
  reduced?: boolean
}

/**
 * Quiz Mode: an answer timer the teacher starts after asking the question, and the answer buttons.
 * The countdown runs on a deadline, not on counted intervals, so it does not drift.
 */
export function QuizTimer({ seconds, outcome, onOutcome, starReward, reduced = false }: QuizTimerProps) {
  const total = seconds * 1000
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const remainingRef = useRef(total)

  useEffect(() => {
    if (!running) return
    const deadline = performance.now() + remainingRef.current
    let lastWhole = Math.ceil(remainingRef.current / 1000)
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - performance.now())
      remainingRef.current = left
      setRemaining(left)
      const whole = Math.ceil(left / 1000)
      if (whole !== lastWhole) {
        lastWhole = whole
        if (whole > 0 && whole <= WARN_SECONDS) playSfx('tick', { rate: 1.3 })
      }
      if (left <= 0) {
        window.clearInterval(id)
        setRunning(false)
        playSfx('error')
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running])

  const reset = () => {
    setRunning(false)
    remainingRef.current = total
    setRemaining(total)
  }

  const toggle = () => {
    if (running) {
      setRunning(false)
      return
    }
    if (remainingRef.current <= 0) {
      remainingRef.current = total
      setRemaining(total)
    }
    playSfx('click')
    setRunning(true)
  }

  const answer = (next: QuizOutcome) => {
    setRunning(false)
    if (next === outcome) {
      onOutcome(null)
      return
    }
    playSfx(next === 'correct' ? 'winner' : 'error', { volume: next === 'correct' ? 0.7 : 0.5 })
    onOutcome(next)
  }

  const expired = remaining <= 0
  const fraction = total > 0 ? remaining / total : 0
  const wholeSeconds = Math.ceil(remaining / 1000)
  const tone = expired || fraction <= 0.2 ? 'text-neon-pink' : fraction <= 0.5 ? 'text-neon-gold' : 'text-neon-cyan'
  const started = running || remaining < total

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/8 p-3"
      data-testid="quiz-timer"
    >
      <motion.div
        className="relative size-16 shrink-0"
        animate={expired && !reduced ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
      >
        <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="4" className="stroke-white/10" />
          <circle
            cx="22"
            cy="22"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            className={cn(tone, 'transition-[stroke-dashoffset] duration-100 ease-linear')}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
        <span
          role="timer"
          aria-label={expired ? 'หมดเวลา' : `เหลือเวลา ${wholeSeconds} วินาที`}
          className={cn('tabular absolute inset-0 flex items-center justify-center text-xl font-extrabold', tone)}
        >
          {expired ? <Timer className="size-6" aria-hidden /> : wholeSeconds}
        </span>
      </motion.div>

      <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
        {expired ? (
          <p className="font-bold text-neon-pink" role="status">
            หมดเวลา!
          </p>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="hud-label text-neon-cyan">Quiz</span>
            <span className="text-sm text-muted-foreground">{seconds} วินาที</span>
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={toggle} aria-pressed={running}>
            {running ? <Pause aria-hidden /> : <Play aria-hidden />}
            {running ? 'หยุดเวลา' : expired ? 'จับเวลาใหม่' : started ? 'จับเวลาต่อ' : 'เริ่มจับเวลา'}
          </Button>
          {started && !expired ? (
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="รีเซ็ตเวลา">
              <RotateCcw aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="ผลการตอบ">
        <Button
          variant={outcome === 'correct' ? 'success' : 'outline'}
          size="sm"
          aria-pressed={outcome === 'correct'}
          onClick={() => answer('correct')}
          className={outcome === 'correct' ? undefined : 'border-neon-lime/45 text-neon-lime hover:text-neon-lime'}
        >
          <Check aria-hidden />
          ตอบถูก{starReward ? ' +⭐' : ''}
        </Button>
        <Button
          variant={outcome === 'wrong' ? 'destructive' : 'outline'}
          size="sm"
          aria-pressed={outcome === 'wrong'}
          onClick={() => answer('wrong')}
        >
          <X aria-hidden />
          ตอบผิด
        </Button>
      </div>
    </div>
  )
}

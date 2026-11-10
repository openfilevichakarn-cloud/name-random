import { gsap } from 'gsap'
import { useEffect, useRef, useState } from 'react'

import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { StageProps } from '../types'

const RING_RADIUS = 46
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
/** Shortest beat, so the countdown stays readable even at the fastest settings. */
const MIN_BEAT_SECONDS = 0.45
const IDLE_HINT = 'กดสุ่มเพื่อเริ่มนับถอยหลัง'

export interface CountdownStageProps extends StageProps {
  /** Number the countdown starts from (3, 5 or 10). */
  seconds: number
}

/**
 * Countdown Random. Counts down while names flicker past ever more slowly,
 * then locks onto the pre-decided winner on zero.
 */
export function CountdownStage({ candidates, phase, run, timeScale, ambient, seconds, onSettled }: CountdownStageProps) {
  const numeralRef = useRef<HTMLSpanElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const waveRef = useRef<HTMLSpanElement>(null)
  const tickerRef = useRef<HTMLParagraphElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const latest = useLatest({ candidates, timeScale, onSettled, seconds, ambient })
  const [count, setCount] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)

  // Idle: show the starting number and the hint.
  useEffect(() => {
    if (phase !== 'idle') return
    setCount(null)
    setLocked(false)
    if (tickerRef.current) tickerRef.current.textContent = candidates.length > 0 ? IDLE_HINT : ''
    if (ringRef.current) gsap.set(ringRef.current, { strokeDashoffset: 0 })
  }, [phase, candidates.length])

  const runKey = run?.key
  useEffect(() => {
    if (!run) return
    const numeral = numeralRef.current
    const ring = ringRef.current
    const ticker = tickerRef.current
    const { candidates: pool, timeScale: scale, seconds: total, ambient: wavesOn } = latest.current
    if (!numeral || !ring || !ticker || pool.length === 0) {
      latest.current.onSettled(run.key)
      return
    }

    setLocked(false)
    const beats = run.quick ? Math.min(3, total) : total
    const beat = Math.max(MIN_BEAT_SECONDS, scale)
    let lastSwap = 0
    let lastLabel = ''

    const timeline = gsap.timeline({
      onUpdate: () => {
        // Flicker through names, slowing down as zero approaches.
        const progress = timeline.progress()
        if (progress >= 1) return
        const now = performance.now()
        const interval = 50 + 240 * progress * progress
        if (now - lastSwap < interval) return
        lastSwap = now
        let label = lastLabel
        for (let attempt = 0; attempt < 4 && label === lastLabel; attempt += 1) {
          label = pool[Math.floor(Math.random() * pool.length)]?.label ?? ''
        }
        lastLabel = label
        ticker.textContent = label
        playSfx('tick', { volume: 0.3 })
      },
      onComplete: () => {
        timelineRef.current = null
        ticker.textContent = run.winner.label
        setCount(0)
        setLocked(true)
        latest.current.onSettled(run.key)
      },
    })

    for (let index = 0; index < beats; index += 1) {
      const at = index * beat
      const value = beats - index
      timeline.call(
        () => {
          setCount(value)
          // The last three counts climb in pitch.
          playSfx('countdown', { rate: value <= 3 ? 1 + (4 - value) * 0.12 : 1 })
        },
        undefined,
        at,
      )
      timeline.fromTo(
        numeral,
        { scale: 1.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: Math.min(0.34, beat * 0.5), ease: 'back.out(2.2)' },
        at,
      )
      timeline.fromTo(ring, { strokeDashoffset: 0 }, { strokeDashoffset: RING_LENGTH, duration: beat, ease: 'none' }, at)
      if (wavesOn && waveRef.current) {
        timeline.fromTo(
          waveRef.current,
          { scale: 0.7, opacity: 0.55 },
          { scale: 1.7, opacity: 0, duration: Math.min(0.8, beat), ease: 'power2.out' },
          at,
        )
      }
    }
    timelineRef.current = timeline

    return () => {
      timeline.kill()
      timelineRef.current = null
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one countdown per run key
  }, [runKey])

  // Skipped: jump to zero.
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') timelineRef.current?.progress(1)
  }, [phase])

  const display = count === null ? seconds : count
  const urgent = count !== null && count <= 3 && count > 0

  return (
    <div className="flex size-full flex-col items-center justify-center gap-[3cqh]" aria-hidden>
      <div className="relative flex aspect-square h-[62cqh] max-h-[80cqw] items-center justify-center">
        <span ref={waveRef} className="absolute inset-0 rounded-full border-4 border-neon-pink opacity-0" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="rgb(148 163 255 / 0.14)" strokeWidth="3.5" />
          <circle
            ref={ringRef}
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke={urgent ? 'var(--neon-pink)' : 'var(--neon-cyan)'}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            className="transition-[stroke] duration-200"
            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
          />
        </svg>
        <span
          ref={numeralRef}
          className={cn(
            'tabular text-[38cqh] leading-none font-extrabold will-change-transform',
            count === null ? 'text-foreground/20' : locked ? 'text-gradient-gold' : urgent ? 'text-neon-pink' : 'text-gradient',
          )}
          style={{ fontSize: 'min(38cqh, 46cqw)' }}
        >
          {locked ? '★' : display}
        </span>
      </div>
      <p
        ref={tickerRef}
        className={cn(
          'flex h-[1.9em] w-full max-w-[92%] items-center justify-center truncate rounded-full border px-6 text-center font-bold',
          'text-[clamp(1.1rem,6cqmin,2.8rem)] transition-colors',
          locked
            ? 'border-neon-gold/70 bg-neon-gold/10 text-neon-gold'
            : count === null
              ? 'border-transparent text-sm font-medium text-muted-foreground'
              : 'border-border bg-ink/60 text-foreground',
        )}
      />
    </div>
  )
}

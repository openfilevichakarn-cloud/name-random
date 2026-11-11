import { gsap } from 'gsap'
import { useEffect, useRef, useState } from 'react'

import { useElementSize } from '@/hooks/useElementSize'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { StageProps } from '../types'
import { drawWheel } from './drawWheel'
import { getSpinTarget, segmentAtPointer } from './wheelGeometry'

const MAX_DPR = 2
const LED_COUNT = 24
/** Minimum gap between tick sounds; at full speed segments pass faster than the ear can separate. */
const TICK_INTERVAL_MS = 34
const IDLE_HINT = 'แตะวงล้อเพื่อหมุน'

/**
 * Lucky Wheel. The face is painted once on a canvas and then rotated by the compositor;
 * the spin is a GSAP tween towards an angle computed from the pre-decided winner.
 */
export function WheelStage({ candidates, phase, run, timeScale, ambient, onSettled, onActivate }: StageProps) {
  const [boxRef, box] = useElementSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLParagraphElement>(null)
  const rotationRef = useRef(0)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const size = Math.floor(Math.min(box.width, box.height))
  const latest = useLatest({ candidates, timeScale, onSettled })
  const busy = phase !== 'idle'

  // Paint the wheel face whenever the pool, the size or the highlight changes.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const paint = () => drawWheel(ctx, { size, dpr, candidates, highlightId })
    paint()
    // The first paint can happen before the web font has loaded; repaint once it is ready.
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) paint()
    })
    return () => {
      cancelled = true
    }
  }, [candidates, size, highlightId])

  // Idle: clear the highlight, show the hint and (when allowed) drift slowly like an attract mode.
  useEffect(() => {
    if (phase !== 'idle') return
    setHighlightId(null)
    if (readoutRef.current) readoutRef.current.textContent = candidates.length > 0 ? IDLE_HINT : ''
    const wheel = wheelRef.current
    if (!wheel || !ambient) return
    const state = { rotation: rotationRef.current }
    const drift = gsap.to(state, {
      rotation: `+=360`,
      duration: 120,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        rotationRef.current = state.rotation
        wheel.style.transform = `rotate(${state.rotation}deg)`
      },
    })
    return () => {
      drift.kill()
    }
  }, [phase, ambient, candidates.length])

  // One spin per run key.
  const runKey = run?.key
  useEffect(() => {
    if (!run) return
    const wheel = wheelRef.current
    const pool = latest.current.candidates
    const count = pool.length
    const winnerIndex = pool.findIndex((candidate) => candidate.id === run.winner.id)
    if (!wheel || winnerIndex < 0) {
      latest.current.onSettled(run.key)
      return
    }

    setHighlightId(null)
    const scale = latest.current.timeScale
    const start = rotationRef.current
    const target = getSpinTarget({
      current: start,
      count,
      winnerIndex,
      turns: run.quick ? 3 : 5 + Math.floor(Math.random() * 3),
      // Cosmetic only: where inside the winning segment the pointer comes to rest.
      fraction: 0.16 + Math.random() * 0.68,
    })

    const state = { rotation: start }
    let lastIndex = segmentAtPointer(start, count)
    let lastTick = 0
    const apply = () => {
      rotationRef.current = state.rotation
      wheel.style.transform = `rotate(${state.rotation}deg)`
      const index = segmentAtPointer(state.rotation, count)
      if (index === lastIndex) return
      lastIndex = index
      if (readoutRef.current) readoutRef.current.textContent = pool[index]?.label ?? ''
      const now = performance.now()
      if (now - lastTick < TICK_INTERVAL_MS) return
      lastTick = now
      playSfx('tick')
      if (pointerRef.current) {
        gsap.fromTo(pointerRef.current, { rotation: 16 }, { rotation: 0, duration: 0.16, ease: 'power2.out', overwrite: true })
      }
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null
        if (readoutRef.current) readoutRef.current.textContent = run.winner.label
        setHighlightId(run.winner.id)
        latest.current.onSettled(run.key)
      },
    })
    // Wind back a little, then release: reads as someone pulling the wheel before letting go.
    timeline.to(state, { rotation: start - 14, duration: 0.3 * Math.min(1, scale), ease: 'power2.out', onUpdate: apply })
    timeline.call(() => playSfx('spin'))
    // power4.out: fast launch, then a long crawl over the last few names.
    timeline.to(state, { rotation: target, duration: (run.quick ? 3.4 : 6.4) * scale, ease: 'power4.out', onUpdate: apply })
    timelineRef.current = timeline

    return () => {
      timeline.kill()
      timelineRef.current = null
    }
    // A run is identified by its key; everything else is read through `latest`.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [runKey])

  // Skipped: jump straight to the resting position.
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') timelineRef.current?.progress(1)
  }, [phase])

  return (
    <div className="flex size-full flex-col items-center gap-2">
      <div ref={boxRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          {/* Rim with chasing LEDs */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,var(--neon-cyan),var(--neon-violet),var(--neon-pink),var(--neon-gold),var(--neon-cyan))] shadow-[0_0_60px_-10px_var(--neon-violet)]"
          />
          <div aria-hidden className="absolute inset-[1.6%] rounded-full bg-ink" />
          {ambient
            ? Array.from({ length: LED_COUNT }, (_unused, index) => (
                <span
                  key={index}
                  aria-hidden
                  className="absolute inset-0"
                  style={{ transform: `rotate(${(360 / LED_COUNT) * index}deg)` }}
                >
                  <span
                    className={cn(
                      'absolute top-[0.35%] left-1/2 size-[1.1%] -translate-x-1/2 rounded-full bg-white',
                      busy && 'animate-led',
                    )}
                    style={{ animationDelay: `${(index % 2) * 0.5}s` }}
                  />
                </span>
              ))
            : null}

          <div ref={wheelRef} className="absolute inset-[3%] will-change-transform">
            <canvas ref={canvasRef} className="size-full rounded-full" aria-hidden />
          </div>

          {/* Hub doubles as a start button. */}
          <button
            type="button"
            onClick={onActivate}
            disabled={busy || candidates.length === 0}
            aria-label="หมุนวงล้อ"
            className={cn(
              'absolute top-1/2 left-1/2 flex size-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
              'bg-[radial-gradient(circle_at_30%_25%,#c4b5fd,var(--neon-violet)_45%,#4c1d95)] font-extrabold tracking-widest text-white',
              'shadow-[0_0_0_3px_rgb(11_16_32),0_0_30px_-4px_var(--neon-violet),inset_0_2px_6px_rgb(255_255_255/0.45)]',
              'outline-none transition-transform duration-200 enabled:hover:scale-110 enabled:active:scale-95',
              'focus-visible:ring-4 focus-visible:ring-neon-cyan disabled:cursor-default',
            )}
            style={{ fontSize: Math.max(10, size * 0.04) }}
          >
            SPIN
          </button>

          {/* Pointer at 3 o'clock: the label under it is horizontal. */}
          <div
            ref={pointerRef}
            aria-hidden
            className="absolute top-1/2 -right-[3%] h-[9%] w-[11%] origin-right -translate-y-1/2 drop-shadow-[0_0_10px_var(--neon-gold)]"
          >
            <div className="size-full bg-[linear-gradient(90deg,#fde68a,var(--neon-gold))] [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
          </div>
        </div>
      </div>

      <p
        ref={readoutRef}
        aria-hidden
        data-testid="stage-result"
        className={cn(
          'flex h-[1.7em] w-full max-w-[90%] shrink-0 items-center justify-center truncate rounded-full px-6 text-center font-bold',
          'text-[clamp(1.1rem,5cqmin,2.6rem)] transition-colors',
          highlightId ? 'text-neon-gold' : busy ? 'text-foreground' : 'text-sm font-medium text-muted-foreground',
        )}
      />
    </div>
  )
}

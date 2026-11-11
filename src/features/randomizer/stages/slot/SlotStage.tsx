import { gsap } from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { graphemeLength } from '@/features/students/lib/text'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { Candidate } from '../../engine/types'
import type { StageProps, StageRun } from '../types'

type ReelKind = 'number' | 'name' | 'avatar' | 'digit'

interface ReelItem {
  key: string
  /** Text for number/name/digit reels. */
  text: string
  /** Avatar reels. */
  avatar: string | null
  seed: string
}

interface Reel {
  kind: ReelKind
  /** Top to bottom: [pad, result, …fillers, start]. The strip scrolls downwards onto the result. */
  items: ReelItem[]
}

const PLACEHOLDER: ReelItem = { key: 'placeholder', text: '?', avatar: null, seed: '' }
/** Strip lengths per reel: later reels travel further, so they stop later. */
const STRIP_LENGTHS = [20, 28, 38, 46] as const
const QUICK_STRIP_LENGTHS = [12, 16, 22, 26] as const
const REEL_SECONDS = [1.9, 2.8, 4.0, 4.9] as const
const QUICK_REEL_SECONDS = [1.1, 1.6, 2.3, 2.8] as const
const TICK_INTERVAL_MS = 55

function isNumberPool(candidates: readonly Candidate[]): boolean {
  return candidates.length > 0 && candidates.every((candidate) => candidate.studentId === null || candidate.id.startsWith('n:'))
}

function itemFor(kind: ReelKind, candidate: Candidate, digit = ''): Omit<ReelItem, 'key'> {
  switch (kind) {
    case 'number':
      return { text: candidate.number === null ? '–' : String(candidate.number), avatar: null, seed: '' }
    case 'name':
      return { text: candidate.label, avatar: null, seed: '' }
    case 'avatar':
      return { text: '', avatar: candidate.avatar, seed: candidate.id }
    case 'digit':
      return { text: digit, avatar: null, seed: '' }
  }
}

function randomOf<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

/** Layout of the machine for a pool: three attribute reels for students, one reel per digit for numbers. */
function reelKinds(candidates: readonly Candidate[]): ReelKind[] {
  if (!isNumberPool(candidates)) return ['number', 'name', 'avatar']
  const widest = candidates.reduce((max, candidate) => Math.max(max, candidate.label.length), 1)
  return Array.from({ length: Math.min(widest, 4) }, () => 'digit' as const)
}

function buildReels(
  kinds: readonly ReelKind[],
  pool: readonly Candidate[],
  run: StageRun | null,
  previous: readonly Reel[] | null,
): Reel[] {
  return kinds.map((kind, reelIndex) => {
    const startItem = previous?.[reelIndex]?.items[1] ?? PLACEHOLDER
    if (!run) {
      return { kind, items: [PLACEHOLDER, startItem].map((item, i) => ({ ...item, key: `idle-${reelIndex}-${i}` })) }
    }

    const digits = run.winner.label.padStart(kinds.length, '0')
    const filler = (): Omit<ReelItem, 'key'> =>
      kind === 'digit' ? itemFor(kind, run.winner, String(Math.floor(Math.random() * 10))) : itemFor(kind, randomOf(pool))
    const result = itemFor(kind, run.winner, digits[reelIndex] ?? '0')
    const lengths = run.quick ? QUICK_STRIP_LENGTHS : STRIP_LENGTHS
    const length = lengths[Math.min(reelIndex, lengths.length - 1)] as number

    const body: Omit<ReelItem, 'key'>[] = [filler(), result]
    while (body.length < length - 1) body.push(filler())
    body.push(startItem)
    // The filler order is purely cosmetic; the result is fixed at index 1.
    return { kind, items: body.map((item, i) => ({ ...item, key: `${run.key}-${reelIndex}-${i}` })) }
  })
}

/** Where the strip rests (showing the result at index 1) and where it starts (showing the last item). */
function restPercent(length: number): number {
  return -(1 / length) * 100
}

function startPercent(length: number): number {
  return -((length - 1) / length) * 100
}

function ReelCell({ kind, item }: { kind: ReelKind; item: ReelItem }) {
  if (kind === 'avatar') {
    return item.avatar ? (
      <StudentAvatar avatar={item.avatar} seed={item.seed} className="size-[62%] max-h-[78%] w-auto aspect-square" />
    ) : (
      <span className="text-[17cqh] font-extrabold text-neon-violet">?</span>
    )
  }
  if (kind === 'name') {
    const length = Math.max(4, graphemeLength(item.text))
    return (
      <span
        className="max-w-full truncate px-[1.5cqw] font-extrabold"
        style={{ fontSize: `min(14cqh, ${(70 / length).toFixed(2)}cqw)` }}
      >
        {item.text}
      </span>
    )
  }
  if (kind === 'number') {
    return (
      <span className="flex flex-col items-center leading-none">
        <span className="tag-label text-[max(0.6rem,2.4cqh)] text-neon-cyan">เลขที่</span>
        <span className="tabular mt-[1cqh] text-[16cqh] font-extrabold text-neon-cyan">{item.text}</span>
      </span>
    )
  }
  return <span className="tabular text-[26cqh] font-extrabold text-neon-gold">{item.text}</span>
}

/**
 * Mystery Slot. Each reel is a pre-built strip that scrolls down and lands on the winner's value;
 * the reels stop one after another, the last one after a long slow-down.
 */
export function SlotStage({ candidates, phase, run, timeScale, ambient, onSettled }: StageProps) {
  const kinds = useMemo(() => reelKinds(candidates), [candidates])
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const latest = useLatest({ timeScale, onSettled })

  // Reels are derived state: rebuilt once per run, kept afterwards so the result stays on display.
  const [reels, setReels] = useState<Reel[]>(() => buildReels(kinds, candidates, null, null))
  const [builtFor, setBuiltFor] = useState<string | null>(null)
  const [stopped, setStopped] = useState(0)
  if (run && run.key !== builtFor) {
    setBuiltFor(run.key)
    setStopped(0)
    setReels(buildReels(kinds, candidates, run, reels.length === kinds.length ? reels : null))
  } else if (!run && reels.length !== kinds.length) {
    // The pool changed shape (e.g. 2-digit → 3-digit range): start from fresh placeholders.
    setReels(buildReels(kinds, candidates, null, null))
  }

  // Park every strip on its result. GSAP owns the strips' transforms; React never writes them.
  useLayoutEffect(() => {
    for (const strip of stripRefs.current) {
      if (strip) gsap.set(strip, { yPercent: restPercent(strip.childElementCount) })
    }
  }, [reels])

  const runKey = run?.key
  // Layout effect: the strips must be moved to their start position before the browser paints,
  // otherwise the freshly built strip would flash the result for one frame.
  useLayoutEffect(() => {
    if (!run || builtFor !== run.key) return
    const strips = stripRefs.current.filter((strip): strip is HTMLDivElement => strip !== null)
    if (strips.length === 0) {
      latest.current.onSettled(run.key)
      return
    }

    const scale = latest.current.timeScale
    const seconds = run.quick ? QUICK_REEL_SECONDS : REEL_SECONDS
    let lastTick = 0
    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null
        latest.current.onSettled(run.key)
      },
    })
    timeline.call(() => playSfx('spin'), undefined, 0)

    strips.forEach((strip, index) => {
      const length = strip.childElementCount
      const duration = (seconds[Math.min(index, seconds.length - 1)] as number) * scale
      let lastItem = -1
      gsap.set(strip, { yPercent: startPercent(length) })
      timeline.to(
        strip,
        {
          // Run slightly past the result, then spring back onto the pay line.
          yPercent: restPercent(length) + (0.16 / length) * 100,
          duration,
          ease: 'power3.out',
          onUpdate: () => {
            const item = Math.round((-Number(gsap.getProperty(strip, 'yPercent')) / 100) * length)
            if (item === lastItem) return
            lastItem = item
            const now = performance.now()
            if (now - lastTick < TICK_INTERVAL_MS) return
            lastTick = now
            playSfx('tick', { volume: 0.7 })
          },
        },
        index * 0.06,
      )
      timeline.to(
        strip,
        {
          yPercent: restPercent(length),
          duration: 0.26,
          ease: 'back.out(2.4)',
          onStart: () => {
            playSfx('tick', { rate: 0.6 })
            setStopped(index + 1)
            // Only the last reel is still turning: build the tension.
            if (index === strips.length - 2) playSfx('suspense')
          },
        },
        index * 0.06 + duration,
      )
    })
    timelineRef.current = timeline

    return () => {
      timeline.kill()
      timelineRef.current = null
    }
    // A run is identified by its key; everything else is read through `latest`.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [runKey, builtFor])

  // Skipped: land every reel immediately.
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') timelineRef.current?.progress(1)
  }, [phase])

  const spinning = phase === 'running'
  const isDigits = kinds[0] === 'digit'

  return (
    <div className="flex size-full items-center justify-center">
      <div className="glass neon-border relative flex w-full max-w-[min(100%,150cqh)] flex-col gap-[2.5cqh] rounded-[2rem] p-[3cqmin]">
        <div className="flex items-center justify-center gap-3">
          {ambient
            ? [0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  aria-hidden
                  className={cn('size-2 rounded-full bg-neon-gold', spinning && 'animate-led')}
                  style={{ animationDelay: `${dot * 0.2}s` }}
                />
              ))
            : null}
          <p className="hud-label text-neon-gold">Mystery Slot</p>
          {ambient
            ? [0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  aria-hidden
                  className={cn('size-2 rounded-full bg-neon-gold', spinning && 'animate-led')}
                  style={{ animationDelay: `${dot * 0.2}s` }}
                />
              ))
            : null}
        </div>

        <div
          className="grid gap-[1.6cqmin]"
          style={{
            gridTemplateColumns: isDigits
              ? `repeat(${kinds.length}, minmax(0, 1fr))`
              : 'minmax(0, 1fr) minmax(0, 2.3fr) minmax(0, 1fr)',
          }}
          aria-hidden
        >
          {reels.map((reel, reelIndex) => {
            const length = reel.items.length
            const landed = phase !== 'running' || reelIndex < stopped
            return (
              // oxlint-disable-next-line react/no-array-index-key -- reels are positional
              <div
                key={reelIndex}
                className={cn(
                  'relative h-[44cqh] min-h-24 overflow-hidden rounded-2xl border bg-ink/85 transition-[border-color,box-shadow] duration-300',
                  landed && builtFor
                    ? 'border-neon-gold/70 shadow-[0_0_24px_-6px_var(--neon-gold)]'
                    : 'border-border',
                )}
              >
                <div
                  ref={(node) => {
                    stripRefs.current[reelIndex] = node
                  }}
                  className="absolute inset-x-0 top-0 will-change-transform"
                  style={{ height: `${length * 100}%` }}
                >
                  {reel.items.map((item, itemIndex) => (
                    <div
                      key={item.key}
                      // Index 1 is the item the reel comes to rest on.
                      data-testid={itemIndex === 1 ? `reel-result-${reel.kind}` : undefined}
                      className="flex items-center justify-center"
                      style={{ height: `${100 / length}%` }}
                    >
                      <ReelCell kind={reel.kind} item={item} />
                    </div>
                  ))}
                </div>
                {/* Curved-drum shading and the pay line */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(11_16_32/0.92),transparent_26%,transparent_74%,rgb(11_16_32/0.92))]" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-neon-gold/25" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

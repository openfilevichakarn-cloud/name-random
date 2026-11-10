import { gsap } from 'gsap'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { LogoMark } from '@/components/layout/Logo'
import { graphemeLength } from '@/features/students/lib/text'
import { useElementSize } from '@/hooks/useElementSize'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { Candidate } from '../../engine/types'
import type { StagePhase, StageRun } from '../types'
import { CARD_ASPECT, CARD_GAP, layoutCards } from './cardLayout'

const FLIP_SECONDS = 0.55

export interface CardStageProps {
  phase: StagePhase
  /** Cards of the current deal, in table order. Empty before the first deal. */
  cards: readonly Candidate[]
  /** Changes with every new deal. */
  dealKey: string | null
  /** Table positions that have been turned over, in pick order. */
  flipped: readonly number[]
  run: StageRun | null
  timeScale: number
  ambient: boolean
  /** Number of placeholder cards shown before the first deal. */
  placeholders: number
  onDealt: (dealKey: string) => void
  onPick: (index: number) => void
  onSettled: (runKey: string) => void
}

function CardBack({ ambient }: { ambient: boolean }) {
  return (
    <span className="backface-hidden absolute inset-0 overflow-hidden rounded-[11%] border border-neon-violet/70 bg-[linear-gradient(150deg,#31247a,#151838_70%)] shadow-[inset_0_0_0_3px_rgb(11_16_32/0.6)]">
      <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgb(139_92_246/0.16)_0_6px,transparent_6px_13px)]" />
      <span className="absolute inset-[9%] rounded-[9%] border border-neon-cyan/35" />
      <span className="text-gradient absolute inset-0 flex items-center justify-center text-[3.4em] leading-none font-extrabold">
        ?
      </span>
      <LogoMark className="absolute top-[7%] left-[9%] size-[1.5em] opacity-80" />
      {ambient ? (
        <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.16)_50%,transparent_65%)] bg-[length:220%_100%]" />
      ) : null}
    </span>
  )
}

function CardFront({ candidate, dimmed }: { candidate: Candidate; dimmed: boolean }) {
  const length = Math.max(4, graphemeLength(candidate.label))
  return (
    <span
      className={cn(
        'backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-[0.35em] overflow-hidden rounded-[11%] border-2 px-[0.4em] [transform:rotateY(180deg)]',
        dimmed
          ? 'border-border bg-[linear-gradient(160deg,#1a1f45,#11142c)] opacity-60'
          : 'border-neon-gold bg-[linear-gradient(160deg,#2a2f66,#151838)] shadow-[0_0_28px_-6px_var(--neon-gold)]',
      )}
    >
      {candidate.avatar ? (
        <StudentAvatar avatar={candidate.avatar} seed={candidate.id} className="size-[3.6em]" />
      ) : null}
      <span
        className={cn('max-w-full truncate font-extrabold', candidate.avatar ? '' : 'tabular text-neon-gold')}
        style={{ fontSize: candidate.avatar ? `${Math.min(1.25, 7.6 / length).toFixed(2)}em` : '3.2em' }}
      >
        {candidate.label}
      </span>
      {candidate.avatar && candidate.number !== null ? (
        <span className="tabular text-[0.8em] leading-none text-neon-cyan">เลขที่ {candidate.number}</span>
      ) : null}
    </span>
  )
}

/**
 * Mystery Card. The engine binds a name to every face-down card before they are dealt;
 * the students then choose which card to turn over.
 */
export function CardStage({
  phase,
  cards,
  dealKey,
  flipped,
  run,
  timeScale,
  ambient,
  placeholders,
  onDealt,
  onPick,
  onSettled,
}: CardStageProps) {
  const [boxRef, box] = useElementSize<HTMLDivElement>()
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const latest = useLatest({ timeScale, onDealt, onSettled })
  /** Run whose card is still shaking face down (it turns over when the shake ends). */
  const [suspenseKey, setSuspenseKey] = useState<string | null>(null)

  const hasDeal = cards.length > 0
  const count = hasDeal ? cards.length : placeholders
  const layout = layoutCards(count, box.width, box.height)
  const activeIndex = run ? flipped[flipped.length - 1] : undefined
  // Once the draw is over, turn every remaining card so the class can see what was under them.
  const revealAll = phase === 'idle' && hasDeal && flipped.length > 0

  // Deal: cards fly out from the centre of the table.
  useLayoutEffect(() => {
    if (phase !== 'dealing' || !dealKey) return
    const nodes = cardRefs.current.filter((node): node is HTMLButtonElement => node !== null)
    const table = nodes[0]?.parentElement?.getBoundingClientRect()
    if (!table || nodes.length === 0) {
      latest.current.onDealt(dealKey)
      return
    }
    const centerX = table.left + table.width / 2
    const centerY = table.top + table.height / 2
    const scale = latest.current.timeScale
    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null
        latest.current.onDealt(dealKey)
      },
    })
    nodes.forEach((node, index) => {
      const rect = node.getBoundingClientRect()
      timeline.from(
        node,
        {
          x: centerX - (rect.left + rect.width / 2),
          y: centerY - (rect.top + rect.height / 2),
          rotation: (Math.random() - 0.5) * 50,
          scale: 0.5,
          opacity: 0,
          duration: 0.42 * scale,
          ease: 'power3.out',
          onStart: () => playSfx('tick', { volume: 0.6, rate: 1.3 }),
        },
        index * 0.055 * scale,
      )
    })
    timelineRef.current = timeline
    return () => {
      timeline.kill()
      timelineRef.current = null
      gsap.set(nodes, { clearProps: 'transform,opacity' })
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one deal animation per deal key
  }, [dealKey, phase === 'dealing'])

  // Pick: the chosen card lifts and trembles before it turns over.
  const runKey = run?.key
  useEffect(() => {
    if (!run || activeIndex === undefined) return
    const node = cardRefs.current[activeIndex]
    if (!node) {
      latest.current.onSettled(run.key)
      return
    }
    const scale = latest.current.timeScale
    setSuspenseKey(run.key)
    playSfx('suspense')
    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null
        latest.current.onSettled(run.key)
      },
    })
    timeline.to(node, { scale: 1.12, duration: 0.22, ease: 'power2.out' })
    timeline.to(node, { rotation: 4, duration: 0.07, repeat: Math.max(3, Math.round(9 * scale)), yoyo: true, ease: 'sine.inOut' })
    timeline.to(node, { rotation: 0, duration: 0.06 })
    timeline.call(() => {
      setSuspenseKey(null)
      playSfx('reveal')
    })
    // Hold for the CSS flip, then settle back into the grid.
    timeline.to(node, { scale: 1, duration: 0.2, ease: 'power2.inOut' }, `+=${FLIP_SECONDS}`)
    timelineRef.current = timeline
    return () => {
      timeline.kill()
      timelineRef.current = null
      setSuspenseKey(null)
      gsap.set(node, { clearProps: 'transform' })
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one animation per run key
  }, [runKey])

  // Skipped: finish whatever is still playing.
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') timelineRef.current?.progress(1)
  }, [phase])

  return (
    <div ref={boxRef} className="flex size-full items-center justify-center [perspective:1400px]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${layout.columns}, ${layout.cardWidth}px)`,
          gap: CARD_GAP,
          fontSize: Math.max(8, layout.cardWidth * 0.105),
        }}
      >
        {Array.from({ length: count }, (_unused, index) => {
          const candidate = cards[index]
          const picked = flipped.includes(index)
          const trembling = suspenseKey !== null && index === activeIndex
          const faceUp = candidate !== undefined && ((picked && !trembling) || revealAll)
          const selectable = phase === 'picking' && candidate !== undefined && !picked
          return (
            <button
              // oxlint-disable-next-line react/no-array-index-key -- cards are identified by table position
              key={`${dealKey ?? 'idle'}-${index}`}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              type="button"
              disabled={!selectable}
              onClick={() => onPick(index)}
              aria-label={faceUp && candidate ? candidate.label : `การ์ดใบที่ ${index + 1}`}
              className={cn(
                'group relative rounded-[11%] outline-none will-change-transform',
                'focus-visible:ring-4 focus-visible:ring-neon-cyan',
                selectable && 'cursor-pointer',
                !hasDeal && 'opacity-55',
                phase === 'picking' && picked && 'z-0',
              )}
              style={{ width: layout.cardWidth, height: layout.cardWidth / CARD_ASPECT }}
            >
              <span
                className={cn(
                  'preserve-3d absolute inset-0 transition-transform ease-out',
                  // The float animation owns `transform` while it runs, so hover feedback also uses brightness.
                  selectable &&
                    'group-hover:-translate-y-[4%] group-hover:scale-[1.04] group-hover:brightness-125 group-focus-visible:brightness-125',
                  ambient && selectable && 'animate-float',
                )}
                style={{
                  transform: faceUp ? 'rotateY(180deg)' : undefined,
                  transitionDuration: `${FLIP_SECONDS}s`,
                  transitionDelay: revealAll && !picked ? `${index * 45}ms` : undefined,
                  animationDelay: `${(index % 5) * -1.1}s`,
                }}
              >
                <CardBack ambient={ambient && selectable} />
                {candidate ? <CardFront candidate={candidate} dimmed={revealAll && !picked} /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

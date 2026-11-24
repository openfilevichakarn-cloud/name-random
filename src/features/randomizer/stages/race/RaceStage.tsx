import { gsap } from 'gsap'
import { Flag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import type { Candidate } from '../../engine/types'
import { stageColor, type StageProps } from '../types'
import {
  CHECKPOINTS,
  LANE_LIMIT,
  MAX_RACERS,
  pickRacers,
  planRace,
  racerHeight,
  rowPositions,
  standingsAt,
} from './racePlan'
import { DuckRacer, KartRacer, LongTailBoatRacer } from './Racers'

export type RaceTheme = 'kart' | 'duck' | 'boat'

interface ThemeSpec {
  title: string
  Racer: ComponentType<{ color: string; className?: string }>
  /** Racer width ÷ height. */
  aspect: number
  /** Moving water (ducks, boats) or rumbling engines (karts). */
  motion: 'bob' | 'rumble'
  track: string
  lane: string
  finish: string
  hint: string
}

const THEMES: Record<RaceTheme, ThemeSpec> = {
  kart: {
    title: 'Go-Kart Grand Prix',
    Racer: KartRacer,
    aspect: 2,
    motion: 'rumble',
    track: 'bg-[linear-gradient(180deg,#166534_0,#166534_3%,#374151_3%,#1f2937_50%,#374151_97%,#166534_97%)]',
    lane: 'border-b-2 border-dashed border-white/25',
    finish: 'bg-[repeating-conic-gradient(#f8fafc_0_25%,#0b1020_0_50%)] bg-[length:14px_14px]',
    hint: 'กด “ออกตัว!” แล้วลุ้นว่ารถคันไหนเข้าเส้นชัยก่อน',
  },
  duck: {
    title: 'Duck Race',
    Racer: DuckRacer,
    aspect: 2,
    motion: 'bob',
    track:
      'bg-[radial-gradient(circle_at_12px_8px,rgb(255_255_255/0.16)_2px,transparent_3px),linear-gradient(180deg,#0e7490,#155e75_55%,#164e63)] bg-[length:48px_24px,auto]',
    lane: 'border-b-[3px] border-dotted border-[#f87171]/80',
    finish: 'bg-[repeating-linear-gradient(180deg,#fbbf24_0_14px,#f8fafc_14px_28px)]',
    hint: 'กด “ปล่อยเป็ด!” แล้วเชียร์เป็ดของเพื่อนให้ถึงทุ่นก่อน',
  },
  boat: {
    title: 'Long-tail Boat Race',
    Racer: LongTailBoatRacer,
    aspect: 2.4,
    motion: 'bob',
    track:
      'bg-[radial-gradient(ellipse_14px_3px_at_20px_10px,rgb(255_255_255/0.16)_60%,transparent_70%),linear-gradient(180deg,#365314_0,#365314_3%,#4d6b45_3%,#3b5f55_45%,#2f5148_97%,#365314_97%)] bg-[length:48px_22px,auto]',
    lane: 'border-b border-white/15',
    finish: 'bg-[repeating-linear-gradient(180deg,#ef4444_0_12px,#f8fafc_12px_24px,#1d4ed8_24px_36px)]',
    hint: 'กด “ติดเครื่อง!” เรือหางยาวลำไหนถึงธงก่อนชนะ',
  },
}

/** Total race time in seconds before the animation-level scale. */
const RACE_SECONDS = 6
const QUICK_RACE_SECONDS = 2.8

export interface RaceStageProps extends StageProps {
  theme: RaceTheme
}

/**
 * Race modes (Go-Kart, Duck Race, Long-tail Boat). The whole class races (up to 50); the winner comes
 * from the engine and the race is planned so that only this racer crosses the line, with the lead
 * changing on the way. Big fields share the track and overlap.
 */
export function RaceStage({ candidates, phase, run, timeScale, ambient, onSettled, theme }: RaceStageProps) {
  const spec = THEMES[theme]
  const latest = useLatest({ candidates, timeScale, onSettled })
  const racerRefs = useRef<(HTMLDivElement | null)[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const preview = useMemo(() => candidates.slice(0, MAX_RACERS), [candidates])
  const [field, setField] = useState<{ racers: Candidate[]; rows: number[] } | null>(null)
  /** Racer indices from first place, while racing (or at the finish). */
  const [standings, setStandings] = useState<number[] | null>(null)
  const [finished, setFinished] = useState(false)
  const racers = field?.racers ?? preview
  const rows = useMemo(() => field?.rows ?? rowPositions(racers.length, () => 0.5), [field, racers.length])
  const height = racerHeight(racers.length)
  const lanes = racers.length <= LANE_LIMIT
  const running = phase === 'running' || phase === 'ready'

  // Back on the grid once the result has been closed.
  useEffect(() => {
    if (phase !== 'idle') return
    setField(null)
    setStandings(null)
    setFinished(false)
    for (const element of racerRefs.current) if (element) gsap.set(element, { '--p': 0 })
  }, [phase])

  const runKey = run?.key
  useEffect(() => {
    if (!run) return
    const { candidates: pool, timeScale: scale } = latest.current
    const lineup = pickRacers(pool.length > 0 ? pool : [run.winner], run.winner)
    const plan = planRace(lineup, run.winner.id)
    setField({ racers: lineup, rows: rowPositions(lineup.length) })
    setFinished(false)
    setStandings(null)

    let timeline: gsap.core.Timeline | null = null
    // Wait one frame so the new line-up is rendered before animating it.
    const frame = requestAnimationFrame(() => {
      const total = Math.max(1.6, (run.quick ? QUICK_RACE_SECONDS : RACE_SECONDS) * scale)
      const step = total / CHECKPOINTS
      playSfx('spin')
      timeline = gsap.timeline({
        onComplete: () => {
          timelineRef.current = null
          setStandings(standingsAt(plan, CHECKPOINTS))
          setFinished(true)
          latest.current.onSettled(run.key)
        },
      })
      lineup.forEach((_racer, index) => {
        const element = racerRefs.current[index]
        if (!element) return
        gsap.set(element, { '--p': 0 })
        const points = plan[index] ?? []
        for (let checkpoint = 1; checkpoint <= CHECKPOINTS; checkpoint += 1) {
          timeline?.to(
            element,
            { '--p': points[checkpoint] ?? 0, duration: step, ease: 'none' },
            (checkpoint - 1) * step,
          )
        }
      })
      for (let checkpoint = 1; checkpoint < CHECKPOINTS; checkpoint += 1) {
        timeline.call(
          () => {
            setStandings(standingsAt(plan, checkpoint))
            playSfx('tick', { volume: 0.35, rate: 0.9 + checkpoint * 0.05 })
          },
          undefined,
          checkpoint * step,
        )
      }
      timelineRef.current = timeline
    })

    return () => {
      cancelAnimationFrame(frame)
      timeline?.kill()
      timelineRef.current = null
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one race per run key
  }, [runKey])

  // Skipped: everyone jumps to the finish positions.
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') timelineRef.current?.progress(1)
  }, [phase])

  const winnerId = finished ? (run?.winner.id ?? null) : null
  const leader = standings ? racers[standings[0] ?? 0] : undefined
  const top = (standings ?? []).slice(0, 5)
  // Name tags on the track: everyone in a small field, the top three in a crowd.
  const tagged = new Set(lanes ? racers.map((racer) => racer.id) : top.slice(0, 3).map((index) => racers[index]?.id))

  return (
    <div className="flex size-full flex-col gap-[1.5cqh] p-[1.5cqh]" aria-hidden data-testid="race-stage">
      <div className="flex min-h-0 items-center justify-between gap-3 px-1">
        <p className="hud-label shrink-0 text-neon-gold">
          {spec.title} · {racers.length} {theme === 'duck' ? 'ตัว' : theme === 'boat' ? 'ลำ' : 'คัน'}
        </p>
        <p className="min-w-0 truncate text-[clamp(0.85rem,3cqmin,1.4rem)] font-bold" data-testid="race-leader">
          {leader ? (
            <>
              {finished ? 'เข้าเส้นชัย: ' : 'นำอยู่: '}
              <span className={finished ? 'text-neon-gold' : 'text-neon-cyan'}>{leader.label}</span>
            </>
          ) : (
            <span className="font-medium text-muted-foreground">
              {candidates.length > MAX_RACERS ? `ลงแข่งรอบละ ${MAX_RACERS} คน · ผู้ชนะสุ่มจากทุกคน` : spec.hint}
            </span>
          )}
        </p>
      </div>

      {/* Live standings: top five, one line above the track. */}
      <ol
        className="flex h-[clamp(1.4rem,5cqh,2rem)] shrink-0 items-center gap-1.5 overflow-hidden px-1"
        data-testid="race-standings"
      >
        {top.map((index, place) => {
          const racer = racers[index]
          if (!racer) return null
          return (
            <li
              key={racer.id}
              className={cn(
                'flex min-w-0 shrink items-center gap-1 rounded-full border border-border bg-ink/60 py-0.5 pr-2 pl-1 text-[clamp(0.6rem,2.2cqmin,0.9rem)] font-semibold',
                winnerId === racer.id && 'border-neon-gold bg-neon-gold/20 text-neon-gold',
              )}
            >
              <span className="tabular text-muted-foreground">{place + 1}</span>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: stageColor(index, racers.length) }}
              />
              <span className="truncate">{racer.label}</span>
            </li>
          )
        })}
      </ol>

      <div
        className={cn(
          // isolate: the crowd's z-order stays inside the track, under the winner screen.
          'relative isolate flex min-h-0 flex-1 overflow-hidden rounded-xl',
          spec.track,
          ambient && theme !== 'kart' && 'animate-water-flow',
        )}
      >
        <div aria-hidden className="absolute inset-y-0 left-[2%] w-[3px] bg-white/40" />
        <div aria-hidden className={cn('absolute inset-y-0 right-[3%] w-[2.2%] min-w-2.5', spec.finish)} />
        <Flag
          aria-hidden
          className="absolute top-1 right-[3.6%] size-[min(5cqh,1.5rem)] -translate-y-0.5 text-neon-gold"
        />
        {lanes
          ? rows
              .slice(1)
              .map((_row, index) => (
                <div
                  key={index}
                  aria-hidden
                  className={cn('absolute inset-x-0', spec.lane)}
                  style={{ top: `${((index + 1) / racers.length) * 100}%` }}
                />
              ))
          : null}

        {racers.map((racer, index) => {
          const y = rows[index] ?? 0.5
          const winner = winnerId === racer.id
          return (
            <div
              key={racer.id}
              ref={(element) => {
                racerRefs.current[index] = element
              }}
              className="absolute [--p:0]"
              style={{
                top: `${y * 100}%`,
                height: `${height * 100}%`,
                left: 'calc(2% + var(--p) * 93%)',
                aspectRatio: String(spec.aspect),
                transform: 'translate(calc(var(--p) * -100%), -50%)',
                // Lower on the track = closer to the viewer; the winner comes to the front at the end.
                zIndex: winner ? 55 : 1 + Math.round(y * 50),
              }}
              data-racer={racer.id}
            >
              {tagged.has(racer.id) || winner ? (
                <span
                  className={cn(
                    'absolute bottom-[88%] left-1/2 flex max-w-[260%] -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-px text-[clamp(0.55rem,1.9cqmin,0.85rem)] font-bold whitespace-nowrap',
                    winner ? 'bg-neon-gold text-ink' : 'bg-ink/80 text-foreground',
                  )}
                >
                  {racer.avatar && lanes ? (
                    <StudentAvatar avatar={racer.avatar} seed={racer.id} className="size-[1.3em] shrink-0" />
                  ) : null}
                  <span className="truncate">{racer.label}</span>
                </span>
              ) : null}
              <spec.Racer
                color={stageColor(index, racers.length)}
                className={cn(
                  'size-full drop-shadow-[0_3px_4px_rgb(0_0_0/0.45)]',
                  ambient && running && (spec.motion === 'bob' ? 'animate-race-bob' : 'animate-race-rumble'),
                  ambient && !running && spec.motion === 'bob' && 'animate-race-bob',
                  winner && 'drop-shadow-[0_0_12px_var(--neon-gold)]',
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

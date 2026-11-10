import { gsap } from 'gsap'
import { useEffect, useRef, useState } from 'react'

import { useElementSize } from '@/hooks/useElementSize'
import { useLatest } from '@/hooks/useLatest'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import { STAGE_COLORS, type StageProps } from '../types'
import { CapsuleSim } from './capsuleSim'

/** Machine proportions: width / height. */
const MACHINE_ASPECT = 0.68

/**
 * Gacha Random. Turning the crank stirs the capsules, one drops into the tray, rolls to the
 * front of the stage and cracks open on the reveal. The capsule is a prop: the winner inside it
 * was decided by the engine before the crank moved.
 */
export function GachaStage({ candidates, phase, run, timeScale, ambient, onSettled, onActivate }: StageProps) {
  const [boxRef, box] = useElementSize<HTMLDivElement>()
  const [domeRef, dome] = useElementSize<HTMLDivElement>()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<CapsuleSim | null>(null)
  const machineRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const chuteRef = useRef<HTMLDivElement>(null)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const topHalfRef = useRef<HTMLSpanElement>(null)
  const bottomHalfRef = useRef<HTMLSpanElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const wobbleRef = useRef<gsap.core.Tween | null>(null)
  const latest = useLatest({ timeScale, onSettled })
  const [capsuleColor, setCapsuleColor] = useState<string>(STAGE_COLORS[0])

  const busy = phase !== 'idle'
  const machineHeight = Math.floor(Math.min(box.height, box.width / MACHINE_ASPECT))
  const capsuleSize = Math.max(28, machineHeight * 0.11)

  // Physics toy lifecycle.
  useEffect(() => {
    if (!canvasRef.current) return
    const sim = new CapsuleSim(canvasRef.current)
    simRef.current = sim
    return () => {
      sim.dispose()
      simRef.current = null
    }
  }, [])

  useEffect(() => {
    simRef.current?.resize(dome.width)
  }, [dome.width])

  // The dome shows what is left in the pool (capped). Refilled whenever the machine is idle.
  useEffect(() => {
    if (phase === 'idle') simRef.current?.setCount(candidates.length)
  }, [phase, candidates.length, dome.width])

  // Idle: put the dispensed capsule away.
  useEffect(() => {
    if (phase !== 'idle') return
    wobbleRef.current?.kill()
    const capsule = capsuleRef.current
    if (capsule) gsap.set(capsule, { autoAlpha: 0, x: 0, y: 0, scale: 1, rotation: 0 })
    gsap.set([topHalfRef.current, bottomHalfRef.current], { x: 0, y: 0, rotation: 0, autoAlpha: 1 })
  }, [phase])

  const runKey = run?.key
  useEffect(() => {
    if (!run) return
    const root = rootRef.current
    const capsule = capsuleRef.current
    const chute = chuteRef.current
    const machine = machineRef.current
    const sim = simRef.current
    if (!root || !capsule || !chute || !sim) {
      latest.current.onSettled(run.key)
      return
    }

    const scale = latest.current.timeScale
    const stir = (run.quick ? 0.9 : 1.7) * scale
    wobbleRef.current?.kill()
    gsap.set([topHalfRef.current, bottomHalfRef.current], { x: 0, y: 0, rotation: 0, autoAlpha: 1 })
    gsap.set(capsule, { autoAlpha: 0, x: 0, y: 0, scale: 1, rotation: 0 })

    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null
        // Keep the capsule trembling until the reveal opens it.
        wobbleRef.current = gsap.to(capsule, { rotation: 9, duration: 0.09, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        latest.current.onSettled(run.key)
      },
    })

    timeline.call(() => {
      playSfx('spin')
      sim.setAgitating(true)
    })
    if (knobRef.current) {
      timeline.to(knobRef.current, { rotation: '+=720', duration: stir, ease: 'power2.inOut' }, 0)
    }
    if (machine) {
      timeline.to(machine, { x: 4, duration: 0.05, repeat: Math.round(stir / 0.05), yoyo: true, ease: 'none' }, 0)
      timeline.set(machine, { x: 0 })
    }
    timeline.call(
      () => {
        sim.setAgitating(false)
        setCapsuleColor(sim.removeOne())
        playSfx('tick', { rate: 0.55 })
      },
      undefined,
      stir,
    )
    // Drop into the tray…
    timeline.fromTo(
      capsule,
      { autoAlpha: 1, y: -capsuleSize * 1.3 },
      { y: 0, duration: 0.5 * Math.min(1, scale), ease: 'bounce.out' },
      stir,
    )
    // …then come forward to the middle of the stage.
    timeline.to(capsule, {
      x: () => {
        const rootBox = root.getBoundingClientRect()
        const chuteBox = chute.getBoundingClientRect()
        return rootBox.left + rootBox.width / 2 - (chuteBox.left + chuteBox.width / 2)
      },
      y: () => {
        const rootBox = root.getBoundingClientRect()
        const chuteBox = chute.getBoundingClientRect()
        return rootBox.top + rootBox.height * 0.46 - (chuteBox.top + chuteBox.height / 2)
      },
      scale: () => Math.max(2.2, (Math.min(root.clientWidth, root.clientHeight) * 0.42) / capsuleSize),
      rotation: 360,
      duration: 0.6 * scale,
      ease: 'power2.inOut',
    })
    timelineRef.current = timeline

    return () => {
      timeline.kill()
      timelineRef.current = null
      sim.setAgitating(false)
      if (machine) gsap.set(machine, { x: 0 })
    }
    // oxlint-disable-next-line react/exhaustive-deps -- one pull per run key
  }, [runKey])

  // Reveal: crack the capsule open (also covers a skipped animation).
  useEffect(() => {
    if (phase !== 'reveal' && phase !== 'summary') return
    timelineRef.current?.progress(1)
    wobbleRef.current?.kill()
    const capsule = capsuleRef.current
    if (!capsule) return
    gsap.set(capsule, { rotation: 0 })
    playSfx('reveal')
    const open = gsap.timeline()
    open.to(topHalfRef.current, { y: '-70%', rotation: -28, autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0)
    open.to(bottomHalfRef.current, { y: '55%', rotation: 14, autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0)
    open.fromTo(flashRef.current, { scale: 0.2, autoAlpha: 0.95 }, { scale: 4, autoAlpha: 0, duration: 0.55, ease: 'power2.out' }, 0)
    return () => {
      open.kill()
    }
  }, [phase])

  return (
    <div
      ref={(node) => {
        rootRef.current = node
        boxRef(node)
      }}
      className="relative flex size-full items-end justify-center"
    >
      <div
        ref={machineRef}
        className="relative shrink-0"
        style={{ height: machineHeight, width: machineHeight * MACHINE_ASPECT }}
      >
        {/* Glass dome */}
        <div
          ref={domeRef}
          className="absolute top-0 left-[5%] aspect-square w-[90%] overflow-hidden rounded-full border-[3px] border-white/30 bg-[radial-gradient(circle_at_32%_24%,rgb(255_255_255/0.2),rgb(34_211_238/0.07)_42%,rgb(11_16_32/0.55))] shadow-[0_0_50px_-12px_var(--neon-cyan),inset_0_-18px_40px_rgb(11_16_32/0.5)]"
        >
          <canvas ref={canvasRef} className="size-full" aria-hidden />
          <span
            aria-hidden
            className="pointer-events-none absolute top-[9%] left-[14%] h-[26%] w-[14%] -rotate-[28deg] rounded-full bg-white/25 blur-[2px]"
          />
        </div>

        {/* Body */}
        <div className="absolute inset-x-0 bottom-0 h-[43%] rounded-[1.6rem] border border-neon-pink/50 bg-[linear-gradient(170deg,#4c2a9c,#2a1b63_55%,#1a1444)] shadow-[0_20px_50px_-20px_var(--neon-pink),inset_0_2px_0_rgb(255_255_255/0.2)]">
          <span
            aria-hidden
            className="absolute -top-[9%] left-[4%] h-[20%] w-[92%] rounded-[50%] border border-white/15 bg-[linear-gradient(180deg,#6d3fd6,#3a2382)]"
          />
          <p className="hud-label absolute top-[20%] left-1/2 -translate-x-1/2 text-neon-gold">Gacha</p>

          {/* Crank — also a start button */}
          <button
            type="button"
            onClick={onActivate}
            disabled={busy || candidates.length === 0}
            aria-label="หมุนตู้กาชา"
            className={cn(
              'absolute top-[38%] left-[12%] flex aspect-square h-[46%] items-center justify-center rounded-full',
              'border-2 border-white/40 bg-[radial-gradient(circle_at_30%_25%,#fde68a,var(--neon-gold)_50%,#b45309)]',
              'shadow-[0_0_24px_-4px_var(--neon-gold)] outline-none transition-transform duration-200',
              'enabled:hover:scale-110 enabled:active:scale-95 focus-visible:ring-4 focus-visible:ring-neon-cyan disabled:cursor-default',
              ambient && !busy && 'animate-glow-pulse',
            )}
          >
            <span ref={knobRef} className="block h-[16%] w-[72%] rounded-full bg-ink/80" />
          </button>

          {/* Chute and tray */}
          <div
            ref={chuteRef}
            className="absolute right-[12%] bottom-[14%] flex aspect-square h-[44%] items-center justify-center rounded-2xl border border-white/15 bg-ink/85 shadow-[inset_0_8px_18px_rgb(0_0_0/0.7)]"
          >
            <div
              ref={capsuleRef}
              aria-hidden
              className="invisible relative will-change-transform"
              style={{ width: capsuleSize, height: capsuleSize }}
            >
              <span ref={flashRef} className="invisible absolute inset-0 rounded-full bg-white blur-md" />
              <span
                ref={bottomHalfRef}
                className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full border border-ink/40 bg-[#E7EBFA]"
              />
              <span
                ref={topHalfRef}
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-full border border-ink/40"
                style={{ backgroundColor: capsuleColor, boxShadow: `0 0 18px -2px ${capsuleColor}` }}
              >
                <span className="absolute top-[22%] left-[18%] h-[26%] w-[20%] rounded-full bg-white/60" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'

import { getAnimationProfile } from '@/lib/animation/levels'
import { useSettings } from '@/stores/settingsStore'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  phase: number
}

const PARTICLE_COLORS = ['139, 92, 246', '34, 211, 238', '236, 72, 153', '248, 250, 252'] as const
const LINK_DISTANCE = 130
const MAX_DPR = 1.5

function spawn(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 8,
    vy: -(4 + Math.random() * 12),
    radius: 0.7 + Math.random() * 1.7,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)] ?? PARTICLE_COLORS[0],
    alpha: 0.35 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  }
}

interface ParticleFieldProps {
  /** Particle budget for a 1920×1080 viewport. */
  budget: number
  links: boolean
}

/** Slow drifting neon dust on a single canvas. Purely decorative. */
function ParticleField({ budget, links }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frameId = 0
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const areaRatio = Math.min(1, (width * height) / (1920 * 1080))
      const target = Math.max(12, Math.round(budget * areaRatio))
      if (particles.length > target) particles.length = target
      while (particles.length < target) particles.push(spawn(width, height))
    }

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // The studio stage owns the frame budget while a draw animation is running.
      if (document.documentElement.dataset.busy === 'true') return

      ctx.clearRect(0, 0, width, height)
      const time = now / 1000

      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        else if (p.x > width + 10) p.x = -10

        const twinkle = 0.65 + 0.35 * Math.sin(time * 1.3 + p.phase)
        const alpha = p.alpha * twinkle
        ctx.fillStyle = `rgba(${p.color}, ${(alpha * 0.16).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(${p.color}, ${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      if (links) {
        ctx.lineWidth = 1
        for (let i = 0; i < particles.length; i += 1) {
          const a = particles[i]
          if (!a) continue
          for (let j = i + 1; j < particles.length; j += 1) {
            const b = particles[j]
            if (!b) continue
            const dx = a.x - b.x
            const dy = a.y - b.y
            const distance = Math.hypot(dx, dy)
            if (distance > LINK_DISTANCE) continue
            ctx.strokeStyle = `rgba(148, 163, 255, ${(0.14 * (1 - distance / LINK_DISTANCE)).toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
    }

    const start = () => {
      cancelAnimationFrame(frameId)
      last = performance.now()
      frameId = requestAnimationFrame(draw)
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frameId)
      else start()
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [budget, links])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" />
}

/** Fixed full-viewport background: aurora gradients, optional grid and particles. */
export function Backdrop() {
  const appearance = useSettings('appearance')
  const level = useSettings('animation').level
  const profile = getAnimationProfile(level)

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(1100px 680px at 8% -12%, rgb(139 92 246 / 0.26), transparent 62%)',
            'radial-gradient(900px 620px at 98% 4%, rgb(34 211 238 / 0.15), transparent 60%)',
            'radial-gradient(1000px 700px at 55% 118%, rgb(236 72 153 / 0.16), transparent 62%)',
          ].join(', '),
        }}
      />
      {appearance.grid ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgb(148 163 255 / 0.055) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 255 / 0.055) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, #000 25%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, #000 25%, transparent 78%)',
          }}
        />
      ) : null}
      {appearance.particles && profile.particles > 0 ? (
        <ParticleField budget={profile.particles} links={profile.particleLinks} />
      ) : null}
    </div>
  )
}

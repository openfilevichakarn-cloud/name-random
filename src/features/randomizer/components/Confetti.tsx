import { useEffect, useRef } from 'react'

import { ConfettiEngine } from '@/lib/animation/confetti'
import { playSfx } from '@/lib/audio/sfx'

interface ConfettiProps {
  /** A new value fires a new celebration; null fires nothing. */
  fireKey: string | null
  /** Pieces per celebration (0 disables it). */
  count: number
}

/** Step 8 of the reveal sequence: two cannons from the bottom corners and a shower from the top. */
export function Confetti({ fireKey, count }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ConfettiEngine | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new ConfettiEngine(canvasRef.current)
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !fireKey || count <= 0) return
    engine.resize()
    const side = Math.round(count * 0.38)
    engine.burst({ x: 0.02, y: 0.98, angle: -Math.PI / 3.2, spread: 0.42, count: side })
    engine.burst({ x: 0.98, y: 0.98, angle: -Math.PI + Math.PI / 3.2, spread: 0.42, count: side })
    engine.burst({ x: 0.5, y: -0.02, angle: Math.PI / 2, spread: 1.3, count: count - side * 2, power: 0.55 })
    playSfx('confetti')
  }, [fireKey, count])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-40 size-full" />
}

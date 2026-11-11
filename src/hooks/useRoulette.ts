import { useCallback, useEffect, useRef, useState } from 'react'

import { playSfx } from '@/lib/audio/sfx'

export interface RouletteState {
  /** Identifies the spin, so a result is never mistaken for an older one. */
  key: string
  /** The item lit up right now. */
  index: number
  /** The spin has landed on its target. */
  done: boolean
}

export interface SpinOptions {
  /** Total run time in ms. */
  duration?: number
  /** Skip the animation (Low animation level). */
  instant?: boolean
}

/**
 * Light items up one after another, slowing down, and land on `target`.
 * The target is decided by the caller before the spin: the animation only shows it.
 */
export function useRoulette() {
  const [state, setState] = useState<RouletteState | null>(null)
  const timers = useRef<number[]>([])

  const stop = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }, [])

  useEffect(() => stop, [stop])

  const spin = useCallback(
    (key: string, count: number, target: number, { duration = 1600, instant = false }: SpinOptions = {}) => {
      stop()
      if (count <= 0 || target < 0 || target >= count) return
      if (instant || count === 1) {
        setState({ key, index: target, done: true })
        playSfx('reveal')
        return
      }
      // At least two laps for small lists, so the landing is not predictable from the start.
      const steps = Math.max(12, count * 2 + 3)
      const first = (((target - (steps - 1)) % count) + count) % count
      // Ease-out: every step waits a little longer than the one before.
      const weights = Array.from({ length: steps - 1 }, (_, step) => 1 + 3.2 * (step / steps) ** 2)
      const unit = duration / weights.reduce((sum, weight) => sum + weight, 0)
      setState({ key, index: first, done: false })
      let elapsed = 0
      weights.forEach((weight, step) => {
        elapsed += weight * unit
        const index = (first + step + 1) % count
        const last = step === weights.length - 1
        timers.current.push(
          window.setTimeout(() => {
            setState({ key, index, done: last })
            if (last) playSfx('reveal')
            else playSfx('tick', { volume: 0.45 })
          }, elapsed),
        )
      })
    },
    [stop],
  )

  const reset = useCallback(() => {
    stop()
    setState(null)
  }, [stop])

  return { state, spinning: state !== null && !state.done, spin, reset }
}

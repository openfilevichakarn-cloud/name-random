import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * A ref that always holds the latest value. Lets long-lived callbacks (GSAP timelines, timers,
 * observers) read current props without being torn down and rebuilt on every render.
 *
 * Updated in a layout effect, so effects and layout effects declared after this hook already see
 * the value of the render that scheduled them.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

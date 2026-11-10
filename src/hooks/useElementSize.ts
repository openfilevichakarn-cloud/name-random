import { useCallback, useEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

const EMPTY: ElementSize = { width: 0, height: 0 }

/**
 * Track an element's content-box size with a ResizeObserver.
 * Returns a ref callback to attach to the element and its current size.
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, ElementSize] {
  const [size, setSize] = useState<ElementSize>(EMPTY)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    const update = (width: number, height: number) => {
      setSize((current) =>
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height },
      )
    }
    update(node.clientWidth, node.clientHeight)

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return [ref, size]
}

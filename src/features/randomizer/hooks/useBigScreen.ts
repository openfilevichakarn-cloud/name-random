import { useCallback, useEffect, useRef } from 'react'

import { useSettings } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Big Screen Mode for projectors and smart TVs: navigation disappears and the stage takes the
 * whole window. Browser fullscreen and the screen wake lock are added when the settings ask
 * for them and the device supports them; without them the in-page layout still applies.
 */
export function useBigScreen() {
  const immersive = useUiStore((state) => state.immersive)
  const setImmersive = useUiStore((state) => state.setImmersive)
  const display = useSettings('display')
  const wasFullscreen = useRef(false)

  const enter = useCallback(() => {
    setImmersive(true)
    if (display.autoFullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
      // Must be called straight from the click; a rejection (e.g. denied by policy) is not an error for us.
      document.documentElement.requestFullscreen().catch(() => undefined)
    }
  }, [display.autoFullscreen, setImmersive])

  const exit = useCallback(() => {
    setImmersive(false)
    // We are leaving on purpose: the `fullscreenchange` that follows must not be read as the
    // browser kicking us out (it could arrive after the user has already re-entered).
    wasFullscreen.current = false
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  }, [setImmersive])

  const toggle = useCallback(() => {
    if (useUiStore.getState().immersive) exit()
    else enter()
  }, [enter, exit])

  // Leaving browser fullscreen (Esc, system gesture) also leaves Big Screen Mode.
  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement !== null
      if (!active && wasFullscreen.current) setImmersive(false)
      wasFullscreen.current = active
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [setImmersive])

  // Keep the projector awake while presenting.
  useEffect(() => {
    if (!immersive || !display.keepAwake || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (released) void lock.release()
        else sentinel = lock
      } catch {
        // Denied (battery saver, permissions policy): presenting still works, the screen may just dim.
      }
    }
    // The browser drops the lock whenever the tab is hidden; take it again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [immersive, display.keepAwake])

  // Big Screen Mode belongs to the studio: leaving the page ends it.
  useEffect(
    () => () => {
      setImmersive(false)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    },
    [setImmersive],
  )

  return { immersive, enter, exit, toggle }
}

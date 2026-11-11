import { useEffect } from 'react'

import { playSfx } from '@/lib/audio/sfx'

/** Everything that behaves like a button. Add `data-sfx="off"` on an element (or an ancestor) to opt out. */
const INTERACTIVE = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="combobox"]',
  'label:has(input[type="radio"])',
  'label:has(input[type="checkbox"])',
  'label:has(input[type="file"])',
].join(',')

const HOVER_INTERVAL_MS = 70

function findControl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  const control = target.closest(INTERACTIVE)
  if (!control || control.closest('[data-sfx="off"]')) return null
  if (control.matches(':disabled, [aria-disabled="true"], [data-disabled]')) return null
  return control
}

/**
 * Click and hover sounds for the whole interface through event delegation,
 * so every control sounds consistent without wiring each one by hand.
 */
export function useUiSounds(): void {
  useEffect(() => {
    let hovered: Element | null = null
    let lastHoverAt = 0

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && findControl(event.target)) playSfx('click')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      if (findControl(event.target)) playSfx('click')
    }

    const onPointerOver = (event: PointerEvent) => {
      // Hover feedback only makes sense for a mouse; touch has no hover.
      if (event.pointerType !== 'mouse') return
      const control = findControl(event.target)
      if (control === hovered) return
      hovered = control
      if (!control) return
      const now = performance.now()
      if (now - lastHoverAt < HOVER_INTERVAL_MS) return
      lastHoverAt = now
      playSfx('hover')
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerover', onPointerOver, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerover', onPointerOver, true)
    }
  }, [])
}

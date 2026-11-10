import { create } from 'zustand'

interface UiState {
  /** Big Screen Mode: navigation and secondary panels are hidden. */
  immersive: boolean
  setImmersive: (value: boolean) => void
}

/** Ephemeral UI state that is never persisted. */
export const useUiStore = create<UiState>()((set) => ({
  immersive: false,
  setImmersive: (value) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.immersive = value ? 'true' : 'false'
    }
    set({ immersive: value })
  },
}))

/**
 * Tell decorative background animation to yield frames to the stage.
 * Stored on <html> (not in React state) so toggling it never re-renders anything.
 */
export function setStageBusy(busy: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.busy = busy ? 'true' : 'false'
}

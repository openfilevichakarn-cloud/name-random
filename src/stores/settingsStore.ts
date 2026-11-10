import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createDefaultSettings, sanitizeSettings, type AppSettings, type SettingsSection } from '@/data/settings'
import { getSafeStorage, STORAGE_PREFIX } from '@/lib/storage'

interface SettingsState {
  settings: AppSettings
  /** Patch one section. Values are validated before they are stored. */
  update: <K extends SettingsSection>(section: K, patch: Partial<AppSettings[K]>) => void
  /** Replace everything (cloud sync, backup restore). */
  replaceAll: (settings: unknown) => void
  /** Reset one section, or everything when no section is given. */
  reset: (section?: SettingsSection) => void
}

export const SETTINGS_STORAGE_KEY = `${STORAGE_PREFIX}settings`

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: createDefaultSettings(),
      update: (section, patch) =>
        set((state) => ({
          settings: sanitizeSettings(
            { ...state.settings, [section]: { ...state.settings[section], ...patch } },
            state.settings,
          ),
        })),
      replaceAll: (settings) => set({ settings: sanitizeSettings(settings) }),
      reset: (section) =>
        set((state) => {
          const defaults = createDefaultSettings()
          return { settings: section ? { ...state.settings, [section]: defaults[section] } : defaults }
        }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(getSafeStorage),
      partialize: (state) => ({ settings: state.settings }),
      // Persisted data may be older than the current shape — rebuild it on top of the defaults.
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as Partial<SettingsState> | undefined)?.settings),
      }),
    },
  ),
)

/** Subscribe to a single settings section. */
export function useSettings<K extends SettingsSection>(section: K): AppSettings[K] {
  return useSettingsStore((state) => state.settings[section])
}

/** Mirror the settings that CSS depends on onto <html> data attributes. */
export function applySettingsToDocument(settings: AppSettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.anim = settings.animation.level
  root.dataset.accent = settings.appearance.accent
  root.dataset.scale = settings.appearance.scale
}

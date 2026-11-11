// Google Font "Prompt", self-hosted so the app keeps its look offline. Only the Thai and Latin subsets are shipped.
import '@fontsource/prompt/thai-300.css'
import '@fontsource/prompt/thai-400.css'
import '@fontsource/prompt/thai-500.css'
import '@fontsource/prompt/thai-600.css'
import '@fontsource/prompt/thai-700.css'
import '@fontsource/prompt/thai-800.css'
import '@fontsource/prompt/latin-300.css'
import '@fontsource/prompt/latin-400.css'
import '@fontsource/prompt/latin-500.css'
import '@fontsource/prompt/latin-600.css'
import '@fontsource/prompt/latin-700.css'
import '@fontsource/prompt/latin-800.css'
import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { router } from './app/router'
import { isSupabaseConfigured } from './data/supabase/client'
import { armAudioUnlock, soundManager } from './lib/audio/soundManager'
import { applySettingsToDocument, useSettingsStore } from './stores/settingsStore'

// Apply persisted appearance before the first paint, then keep <html> in sync with the store.
applySettingsToDocument(useSettingsStore.getState().settings)
soundManager.configure(useSettingsStore.getState().settings.sound)
useSettingsStore.subscribe((state) => {
  applySettingsToDocument(state.settings)
  soundManager.configure(state.settings.sound)
})

// Browsers only allow audio after a user gesture: the audio system is created on the first one.
armAudioUnlock()

// Accounts and cloud sync, only when a Supabase project is configured. Loaded on demand,
// so local-only deployments never download the account code.
if (isSupabaseConfigured) {
  void import('./features/auth/lib/session').then(({ initAuth }) => initAuth())
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

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
import { applySettingsToDocument, useSettingsStore } from './stores/settingsStore'

// Apply persisted appearance before the first paint, then keep <html> in sync with the store.
applySettingsToDocument(useSettingsStore.getState().settings)
useSettingsStore.subscribe((state) => applySettingsToDocument(state.settings))

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

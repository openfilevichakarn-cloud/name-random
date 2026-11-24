import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

import { contentSecurityPolicy } from './build/csp.ts'

function cspOptions(mode: string) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return { supabaseUrl: env.VITE_SUPABASE_URL, google: Boolean(env.VITE_GOOGLE_CLIENT_ID?.trim()) }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app from /<repository>/; other hosts use the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(cspOptions(mode))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'build/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
}))

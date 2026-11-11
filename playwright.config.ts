import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
/** A second build with accounts enabled, talking to the fake Supabase in e2e/fakeSupabase.ts. */
const CLOUD_PORT = 4174
const CLOUD_URL = `http://localhost:${CLOUD_PORT}`

/**
 * On Linux, Chromium only keeps non-ASCII download file names when the process locale is UTF-8.
 * Containers often run with the POSIX locale, where a Thai file name would be replaced by "download".
 */
const locale = process.env.LC_ALL ?? process.env.LC_CTYPE ?? process.env.LANG ?? ''
const browserEnv =
  process.platform === 'linux' && !/utf-?8/i.test(locale)
    ? { ...(process.env as Record<string, string>), LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' }
    : undefined

/**
 * End-to-end tests run against the production build (`vite preview`).
 * Every test gets a fresh browser context, i.e. an empty IndexedDB and localStorage.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: browserEnv ? { env: browserEnv } : {},
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /cloud\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /cloud\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'cloud',
      testMatch: /cloud\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: CLOUD_URL },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx vite build --outDir dist-e2e-cloud && npx vite preview --outDir dist-e2e-cloud --port ${CLOUD_PORT} --strictPort`,
      url: CLOUD_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_fake_key',
      },
    },
  ],
})

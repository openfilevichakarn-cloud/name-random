import { expect, test, type Page } from '@playwright/test'

import { closeReveal, drawWinner, openStudio, seedClassroom, trackPageErrors, useTestSettings } from './helpers.ts'

interface AudioProbe {
  /** Real-time AudioContexts created by the page. */
  contexts: number
  /** OfflineAudioContexts created (one per synthesised sound effect). */
  offline: number
  /** Buffer sources started on a real-time context, i.e. sounds actually played. */
  starts: number
}

/** Count Web Audio activity without touching the app's own code. */
async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { contexts: 0, offline: 0, starts: 0 }
    const scope = window as unknown as Record<string, unknown>
    scope.audioProbe = probe

    const Realtime = window.AudioContext
    window.AudioContext = class extends Realtime {
      constructor(options?: AudioContextOptions) {
        super(options)
        probe.contexts += 1
      }
    }
    const Offline = window.OfflineAudioContext
    class CountedOffline extends Offline {
      constructor(channels: number, length: number, sampleRate: number) {
        super(channels, length, sampleRate)
        probe.offline += 1
      }
    }
    window.OfflineAudioContext = CountedOffline as unknown as typeof OfflineAudioContext
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
      if (!(this.context instanceof Offline)) probe.starts += 1
      start.apply(this, args)
    }
  })
}

function readProbe(page: Page): Promise<AudioProbe> {
  return page.evaluate(() => ({ ...(window as unknown as { audioProbe: AudioProbe }).audioProbe }))
}

const audioStatus = (page: Page) => page.locator('html')

/**
 * Give the page its first user gestures. The first one creates the audio system; Howler then
 * plays one silent buffer on the following gesture to finish unlocking mobile browsers, so a
 * second tap is spent here to keep that out of the counts below.
 */
async function unlockAudio(page: Page): Promise<void> {
  const target = page.getByRole('heading', { level: 1 })
  await target.click()
  await expect(audioStatus(page)).toHaveAttribute('data-audio', 'ready')
  await target.click()
  await page.waitForTimeout(150)
}

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await installAudioProbe(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

test.describe('browser audio policy', () => {
  test('creates no AudioContext until the first user interaction', async ({ page, isMobile }) => {
    await useTestSettings(page, { sound: { enabled: true } })
    await page.goto('/settings?tab=sound')
    await expect(page.getByRole('heading', { name: 'ระดับเสียง' })).toBeVisible()
    await expect(page.getByText(/เบราว์เซอร์อนุญาตให้เล่นเสียงหลังจากแตะหรือคลิกครั้งแรก/)).toBeVisible()

    // Loading, rendering and moving the pointer are not user activation.
    if (!isMobile) await page.mouse.move(400, 300)
    await page.waitForTimeout(800)
    expect(await readProbe(page)).toEqual({ contexts: 0, offline: 0, starts: 0 })
    await expect(audioStatus(page)).toHaveAttribute('data-audio', 'locked')

    // The first tap unlocks audio: one shared context and the ten synthesised effects.
    await page.getByRole('heading', { name: 'ระดับเสียง' }).click()
    await expect(audioStatus(page)).toHaveAttribute('data-audio', 'ready')
    const probe = await readProbe(page)
    expect(probe.contexts).toBe(1)
    expect(probe.offline).toBe(10)
    await expect(page.getByText(/เบราว์เซอร์อนุญาตให้เล่นเสียงหลังจากแตะหรือคลิกครั้งแรก/)).toHaveCount(0)
  })
})

test.describe('sound settings', () => {
  test('previews every sound event and re-synthesises on a theme change', async ({ page }) => {
    await useTestSettings(page, { sound: { enabled: true, hover: false } })
    await page.goto('/settings?tab=sound')
    await unlockAudio(page)

    const events = ['คลิกปุ่ม', 'ชี้ปุ่ม', 'เริ่มหมุน', 'ติ๊ก', 'ลุ้น', 'นับถอยหลัง', 'เปิดเผย', 'ประกาศผล', 'คอนเฟตตี', 'แจ้งเตือน']
    for (const [index, label] of events.entries()) {
      const before = (await readProbe(page)).starts
      await page.getByRole('button', { name: label, exact: true }).click()
      // "ชี้ปุ่ม" is the hover sound, which is switched off in this test.
      const expected = index === 1 ? before : before + 1
      await expect.poll(async () => (await readProbe(page)).starts).toBe(expected)
    }

    await page.getByRole('radio', { name: 'Arcade' }).click()
    await expect.poll(async () => (await readProbe(page)).offline).toBe(20)
    expect((await readProbe(page)).contexts).toBe(1)
  })

  test('mute and zero volume silence everything', async ({ page }) => {
    await useTestSettings(page, { sound: { enabled: true, hover: false } })
    await page.goto('/settings?tab=sound')
    await unlockAudio(page)

    await page.getByRole('switch', { name: 'เปิดเสียง' }).click()
    await page.waitForTimeout(150)
    const muted = (await readProbe(page)).starts
    await expect(page.getByRole('button', { name: 'ประกาศผล', exact: true })).toBeDisabled()
    // Ordinary clicks make no sound while muted.
    await page.getByRole('tab', { name: 'General' }).click()
    await page.getByRole('tab', { name: 'Sound' }).click()
    await page.waitForTimeout(150)
    expect((await readProbe(page)).starts).toBe(muted)

    // Back on: the dock toggle mirrors the setting and sounds play again.
    await page.getByRole('switch', { name: 'เปิดเสียง' }).click()
    await expect(page.getByRole('button', { name: 'ปิดเสียง' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'ประกาศผล', exact: true }).click()
    await expect.poll(async () => (await readProbe(page)).starts).toBeGreaterThan(muted)
  })

  test('the music preview plays a generated loop and stops on demand', async ({ page }) => {
    await useTestSettings(page, { sound: { enabled: true, hover: false } })
    await page.goto('/settings?tab=sound')
    await unlockAudio(page)

    await page.getByRole('button', { name: 'เล่นเพลงตัวอย่าง' }).click()
    const playing = (await readProbe(page)).starts
    // The sequencer keeps scheduling notes (hi-hats are buffer sources).
    await expect.poll(async () => (await readProbe(page)).starts, { timeout: 5000 }).toBeGreaterThan(playing + 2)

    await page.getByRole('button', { name: 'หยุดเพลง' }).click()
    await page.waitForTimeout(400)
    const stopped = (await readProbe(page)).starts
    await page.waitForTimeout(700)
    expect((await readProbe(page)).starts).toBe(stopped)
  })
})

test.describe('studio sound', () => {
  test('a draw is accompanied by sound effects', async ({ page }) => {
    await useTestSettings(page, { sound: { enabled: true, hover: false, musicMode: 'off' } })
    await seedClassroom(page, 'ป.1/1', ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ'])
    await openStudio(page)
    // The studio was opened by a fresh page load, so audio waits for a gesture again.
    await unlockAudio(page)

    const before = (await readProbe(page)).starts
    await drawWinner(page, { skip: false })
    // At least: the launch, some ticks, the reveal and the fanfare.
    expect((await readProbe(page)).starts - before).toBeGreaterThanOrEqual(4)
    await closeReveal(page)
  })

  test('with sound switched off the app never plays anything', async ({ page }) => {
    await useTestSettings(page, { sound: { enabled: false } })
    await seedClassroom(page, 'ป.1/2', ['มานี มีตา', 'ปิติ พอใจ'])
    await openStudio(page)
    await drawWinner(page, { skip: false })
    expect((await readProbe(page)).starts).toBe(0)
  })
})

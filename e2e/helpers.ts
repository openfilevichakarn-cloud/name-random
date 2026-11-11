import { expect, type Page } from '@playwright/test'

/** Settings applied before the app boots, so tests are fast and deterministic. */
export async function useTestSettings(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  const settings = {
    animation: { level: 'low', pace: 'short', confetti: false, countdownSeconds: 3 },
    sound: { enabled: false },
    ...overrides,
  }
  await page.addInitScript((value) => {
    // Only seed once: a reload inside a test must keep whatever the app saved in the meantime.
    if (localStorage.getItem('ngsr:settings') === null) {
      localStorage.setItem('ngsr:settings', JSON.stringify({ state: { settings: value }, version: 1 }))
    }
  }, settings)
}

/** Fail the test on uncaught exceptions and console errors. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

/** Create a classroom through the UI and wait for its (empty) roster page. */
export async function createClassroom(page: Page, name: string): Promise<void> {
  await page.goto('/classrooms')
  await page
    .getByRole('button', { name: /^เพิ่มห้องเรียน/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มห้องเรียน' })
  await dialog.getByLabel('ชื่อห้องเรียน').fill(name)
  await dialog.getByRole('button', { name: 'สร้างห้องเรียน' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page).toHaveURL(/\/classrooms\/[0-9a-f-]{36}$/)
}

export interface StudentDraft {
  firstName: string
  lastName?: string
  nickname?: string
  studentCode?: string
  number?: string
}

/** Fill the open student dialog (does not submit). */
export async function fillStudentForm(page: Page, draft: StudentDraft): Promise<void> {
  const dialog = page.getByRole('dialog')
  if (draft.number !== undefined) await dialog.getByLabel('เลขที่').fill(draft.number)
  if (draft.studentCode !== undefined) await dialog.getByLabel('รหัสนักเรียน').fill(draft.studentCode)
  await dialog.getByLabel('ชื่อ', { exact: true }).fill(draft.firstName)
  if (draft.lastName !== undefined) await dialog.getByLabel('นามสกุล').fill(draft.lastName)
  if (draft.nickname !== undefined) await dialog.getByLabel('ชื่อเล่น').fill(draft.nickname)
}

/** Add students one after another using "save and add another" (Enter), then close the dialog. */
export async function addStudents(page: Page, drafts: StudentDraft[]): Promise<void> {
  await page
    .getByRole('button', { name: 'เพิ่มนักเรียน' })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มนักเรียน' })
  await expect(dialog).toBeVisible()
  for (const draft of drafts) {
    await fillStudentForm(page, draft)
    await dialog.getByLabel('ชื่อ', { exact: true }).press('Enter')
    // The form remounts empty once the student has been saved.
    await expect(dialog.getByLabel('ชื่อ', { exact: true })).toHaveValue('')
  }
  await dialog.getByRole('button', { name: 'ยกเลิก' }).click()
  await expect(dialog).toBeHidden()
}

/** Seed a classroom with students by pasting names into the import dialog. */
export async function importPastedNames(page: Page, names: string[]): Promise<void> {
  await page
    .getByRole('button', { name: /^นำเข้า/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'นำเข้ารายชื่อนักเรียน' })
  await dialog.getByLabel(/วางรายชื่อ/).fill(names.join('\n'))
  await dialog.getByRole('button', { name: 'ใช้รายชื่อที่วาง' }).click()
  await dialog.getByRole('button', { name: `นำเข้า ${names.length} คน` }).click()
  await expect(dialog).toBeHidden()
}

/** Create a classroom and fill it with students given as "ชื่อ นามสกุล". */
export async function seedClassroom(page: Page, name: string, students: string[]): Promise<void> {
  await createClassroom(page, name)
  await importPastedNames(page, students)
  await expect(page.getByRole('row')).toHaveCount(students.length + 1)
}

const MODE_NAMES = {
  wheel: 'Lucky Wheel',
  slot: 'Mystery Slot',
  card: 'Mystery Card',
  countdown: 'Countdown',
  gacha: 'Gacha',
} as const
export type ModeName = keyof typeof MODE_NAMES

/** Open the studio (the last classroom is preselected) and wait for the stage. */
export async function openStudio(page: Page, mode: ModeName = 'wheel'): Promise<void> {
  await page.goto('/studio')
  await expect(page.getByTestId('stage')).toBeVisible()
  if (mode !== 'wheel') await selectMode(page, mode)
}

export async function selectMode(page: Page, mode: ModeName): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(MODE_NAMES[mode]) }).click()
}

/** Current phase of the draw pipeline, read from the stage element. */
export function stagePhase(page: Page) {
  return page.getByTestId('stage')
}

interface DrawOptions {
  /** Press "ข้าม" instead of waiting for the animation (default true). */
  skip?: boolean
}

/** Run a single draw up to the winner screen and return the revealed name. The screen stays open. */
export async function drawWinner(page: Page, { skip = true }: DrawOptions = {}): Promise<string> {
  // A previous winner screen may still be fading out; never read a name from it.
  await expect(page.getByTestId('winner-reveal')).toHaveCount(0)
  await page.getByTestId('draw-button').click()
  if (skip) await page.getByRole('button', { name: 'ข้าม' }).click()
  await expect(stagePhase(page)).toHaveAttribute('data-phase', 'reveal', { timeout: 30_000 })
  const name = await page.getByTestId('winner-name').innerText()
  return name.trim()
}

export async function closeReveal(page: Page): Promise<void> {
  // Exact: "แตะเพื่อเปิดกล่องรางวัล" (the surprise gift) also contains "ปิด".
  await page.getByTestId('winner-reveal').getByRole('button', { name: 'ปิด', exact: true }).click()
  await expect(stagePhase(page)).toHaveAttribute('data-phase', 'idle')
  await expect(page.getByTestId('winner-reveal')).toHaveCount(0)
}

/** Make the participants / rules panel reachable (it lives in a sheet on narrow screens). */
export async function openPanel(page: Page, tab: 'ผู้เข้าร่วม' | 'กติกา'): Promise<void> {
  const trigger = page.getByRole('button', { name: 'ผู้เข้าร่วมและกติกา' })
  if (await trigger.isVisible()) await trigger.click()
  await page.getByRole('tab', { name: tab }).click()
}

/** Close the panel sheet again where there is one. */
export async function closePanel(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'ปิดแผง' })
  if (await close.isVisible()) {
    await close.click()
    await expect(close).toBeHidden()
  }
}

/** Navigate inside the app through the main menu (keeps pending writes alive, unlike page.goto). */
export async function navigateTo(page: Page, label: string): Promise<void> {
  await page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: label }).click()
}

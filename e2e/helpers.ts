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

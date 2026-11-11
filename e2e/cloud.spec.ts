import { expect, test, type Page } from '@playwright/test'

import { FakeSupabase } from './fakeSupabase.ts'
import { createClassroom, drawWinner, importPastedNames, openStudio, trackPageErrors, useTestSettings } from './helpers.ts'

/**
 * Accounts and cloud sync, against the in-memory Supabase in fakeSupabase.ts.
 * Runs on the `cloud` project: a build with VITE_SUPABASE_URL pointing at the fake.
 */

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await useTestSettings(page)
})

test.afterEach(() => {
  // Rejected API calls (a wrong password, an invalid invite code) are part of these scenarios. Chromium
  // reports every 4xx response as a console error itself; anything the app logs is still caught.
  const unexpected = pageErrors.filter(
    (message) => !/^console: Failed to load resource: the server responded with a status of 4\d\d/.test(message),
  )
  expect(unexpected, 'no console errors or uncaught exceptions').toEqual([])
})

const html = (page: Page) => page.locator('html')
const dockLogin = (page: Page) => page.getByRole('complementary').getByRole('link', { name: 'เข้าสู่ระบบ' })

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('อีเมล').fill(email)
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
}

async function signUp(page: Page, name: string, email: string, password: string): Promise<void> {
  await page.goto('/login?mode=signup')
  await page.getByLabel('ชื่อที่แสดง').fill(name)
  await page.getByLabel('อีเมล').fill(email)
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password)
  await page.getByLabel('ยืนยันรหัสผ่าน').fill(password)
  await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click()
}

async function openAccountTab(page: Page): Promise<void> {
  await page.goto('/settings?tab=account')
  await expect(page.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true')
}

test.describe('accounts', () => {
  test('sign up, create a school and keep working in the cloud after a reload', async ({ page }) => {
    const fake = new FakeSupabase()
    await fake.install(page)

    await page.goto('/')
    await expect(dockLogin(page)).toBeVisible()

    await signUp(page, 'ครูฟ้า', 'fah@school.test', 'correct-horse-1')
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByRole('tab', { name: 'สร้างโรงเรียนใหม่' }).click()
    await page.getByLabel('ชื่อโรงเรียน').fill('โรงเรียนทดสอบ')
    await expect(page.getByLabel('ชื่อที่แสดง')).toHaveValue('ครูฟ้า')
    await page.getByRole('button', { name: 'สร้างโรงเรียน' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('สวัสดี ครูฟ้า')
    await expect(page.getByRole('button', { name: 'บัญชี ครูฟ้า' })).toBeVisible()

    // Data now goes to the cloud, owned by this teacher and school.
    await createClassroom(page, 'ป.4/1')
    await importPastedNames(page, ['มานี มีตา', 'ปิติ พอใจ'])
    const account = fake.accounts[0]
    expect(fake.tables.classrooms).toEqual([expect.objectContaining({ name: 'ป.4/1', owner_id: account?.id })])
    expect(fake.tables.students).toHaveLength(2)

    await page.goto('/settings?tab=data')
    await expect(page.getByTestId('storage-mode')).toContainText('เก็บบนคลาวด์ (บัญชีโรงเรียน โรงเรียนทดสอบ)')

    // The session survives a reload and the data comes back from the cloud.
    await page.reload()
    await page.goto('/classrooms')
    await expect(page.getByRole('link', { name: 'ป.4/1' })).toBeVisible()
  })

  test('explains a wrong password', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.addAccount('mai@school.test', 'right-password', 'ครูใหม่', { name: 'โรงเรียนเอ' })
    await fake.install(page)

    await signIn(page, 'mai@school.test', 'wrong-password')
    await expect(page.getByRole('alert')).toHaveText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('validates the sign-up form before sending anything', async ({ page }) => {
    const fake = new FakeSupabase()
    await fake.install(page)
    await page.goto('/login?mode=signup')
    await page.getByLabel('อีเมล').fill('not-an-email')
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill('short')
    await page.getByLabel('ยืนยันรหัสผ่าน').fill('different')
    await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click()
    await expect(page.getByText('กรุณากรอกชื่อที่แสดง')).toBeVisible()
    await expect(page.getByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeVisible()
    await expect(page.getByText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')).toBeVisible()
    await expect(page.getByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeVisible()
    expect(fake.accounts).toHaveLength(0)
  })

  test('asks new users to confirm their e-mail when the project requires it', async ({ page }) => {
    const fake = new FakeSupabase({ confirmEmails: true })
    await fake.install(page)
    await signUp(page, 'ครูนก', 'nok@school.test', 'correct-horse-1')
    await expect(page.getByRole('heading', { name: 'ตรวจสอบอีเมลของคุณ' })).toBeVisible()
    await expect(page.getByText('nok@school.test')).toBeVisible()

    await page.getByRole('button', { name: 'ไปที่หน้าเข้าสู่ระบบ' }).click()
    await signIn(page, 'nok@school.test', 'correct-horse-1')
    await expect(page.getByRole('alert')).toContainText('กรุณายืนยันอีเมลก่อน')
  })

  test('sends a password-reset link', async ({ page }) => {
    const fake = new FakeSupabase()
    await fake.install(page)
    await page.goto('/login')
    await page.getByLabel('อีเมล').fill('lost@school.test')
    await page.getByRole('button', { name: 'ลืมรหัสผ่าน?' }).click()
    await expect(page.getByLabel('อีเมล')).toHaveValue('lost@school.test')
    await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่' }).click()
    await expect(page.getByRole('status')).toContainText('lost@school.test')
  })
})

test.describe('schools', () => {
  test('a teacher joins with an invite code and does not see it', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.addAccount('owner@school.test', 'owner-password', 'ผอ.', { name: 'โรงเรียนบี', joinCode: 'JOIN2345' })
    await fake.install(page)

    await signUp(page, 'ครูบี', 'bee@school.test', 'correct-horse-1')
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByLabel('รหัสเข้าร่วม').fill('nope0000')
    await page.getByRole('button', { name: 'เข้าร่วมโรงเรียน' }).click()
    await expect(page.getByRole('alert')).toHaveText('รหัสเข้าร่วมไม่ถูกต้อง หรือถูกเปลี่ยนไปแล้ว')

    await page.getByLabel('รหัสเข้าร่วม').fill('join-2345')
    await page.getByRole('button', { name: 'เข้าร่วมโรงเรียน' }).click()
    await expect(page).toHaveURL(/\/$/)

    await openAccountTab(page)
    await expect(page.getByLabel('ชื่อโรงเรียน')).toHaveValue('โรงเรียนบี')
    await expect(page.getByLabel('ชื่อโรงเรียน')).toBeDisabled()
    await expect(page.getByRole('main').getByText('ครู', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'แสดงรหัสเข้าร่วม' })).toHaveCount(0)
    // Both members are listed.
    await expect(page.getByText('ผอ.')).toBeVisible()
    await expect(page.getByText('(คุณ)')).toBeVisible()
  })

  test('the owner reveals the invite code', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const fake = new FakeSupabase()
    fake.addAccount('owner@school.test', 'owner-password', 'ผอ.', { name: 'โรงเรียนซี', joinCode: 'SEEC0DE7' })
    await fake.install(page)

    await signIn(page, 'owner@school.test', 'owner-password')
    await expect(page).toHaveURL(/\/$/)
    await openAccountTab(page)
    await page.getByRole('button', { name: 'แสดงรหัสเข้าร่วม' }).click()
    await expect(page.getByTestId('join-code')).toHaveText('SEEC0DE7')
    await page.getByRole('button', { name: 'คัดลอกรหัสเข้าร่วม' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SEEC0DE7')
  })
})

test.describe('cloud data', () => {
  test('local data can be uploaded after signing in, and comes back after signing out', async ({ page }) => {
    const fake = new FakeSupabase()
    const account = fake.addAccount('local@school.test', 'local-password', 'ครูเครื่อง', { name: 'โรงเรียนดี' })
    await fake.install(page)

    // Signed out: everything stays in this browser.
    await createClassroom(page, 'ห้องในเครื่อง')
    await importPastedNames(page, ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ'])
    expect(fake.tables.classrooms).toHaveLength(0)

    await signIn(page, 'local@school.test', 'local-password')
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/classrooms')
    await expect(page.getByRole('heading', { name: 'ยังไม่มีห้องเรียน' })).toBeVisible()

    await openAccountTab(page)
    await page.getByRole('button', { name: 'อัปโหลดข้อมูลในเครื่อง' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'อัปโหลด' }).click()
    await expect(page.getByText('อัปโหลดแล้ว: 1 ห้อง 3 คน 0 ผลการสุ่ม')).toBeVisible()
    expect(fake.tables.classrooms).toEqual([expect.objectContaining({ name: 'ห้องในเครื่อง', owner_id: account.id })])
    expect(fake.tables.students).toHaveLength(3)

    await page.goto('/classrooms')
    await expect(page.getByRole('link', { name: 'ห้องในเครื่อง' })).toBeVisible()

    // Signing out switches back to the data in this browser.
    await page.getByRole('button', { name: 'บัญชี ครูเครื่อง' }).click()
    await page.getByRole('menuitem', { name: 'ออกจากระบบ' }).click()
    await expect(dockLogin(page)).toBeVisible()
    await expect(page.getByRole('link', { name: 'ห้องในเครื่อง' })).toBeVisible()
    await page.goto('/settings?tab=data')
    await expect(page.getByTestId('storage-mode')).toContainText('เก็บในเบราว์เซอร์นี้ (Local)')
  })

  test('draws are recorded in the cloud history', async ({ page }) => {
    const fake = new FakeSupabase()
    const account = fake.addAccount('draw@school.test', 'draw-password', 'ครูสุ่ม', { name: 'โรงเรียนอี' })
    await fake.install(page)
    await signIn(page, 'draw@school.test', 'draw-password')
    await expect(page).toHaveURL(/\/$/)

    await createClassroom(page, 'ม.1/1')
    await importPastedNames(page, ['มานี มีตา', 'ปิติ พอใจ'])
    await openStudio(page)
    const winner = await drawWinner(page)

    await expect.poll(() => fake.tables.random_results.length).toBe(1)
    expect(fake.tables.random_sessions).toEqual([expect.objectContaining({ user_id: account.id, classroom_name: 'ม.1/1' })])
    expect(fake.tables.random_results[0]).toMatchObject({ user_id: account.id, mode: 'wheel', draw_type: 'single' })
    expect(String(fake.tables.random_results[0]?.display_name)).toContain(winner)

    await page.goto('/history')
    await expect(page.getByText('พบ 1 รายการ')).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toContainText(winner)
  })

  test('settings follow the teacher to another computer', async ({ page, browser }) => {
    const fake = new FakeSupabase()
    fake.addAccount('sync@school.test', 'sync-password', 'ครูซิงก์', { name: 'โรงเรียนเอฟ' })
    await fake.install(page)
    await signIn(page, 'sync@school.test', 'sync-password')
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/settings?tab=appearance')
    await page.getByRole('radio', { name: 'Pink' }).check()
    await expect.poll(() => (fake.tables.random_settings[0]?.appearance as { accent?: string } | undefined)?.accent).toBe('pink')

    // A second computer: fresh browser storage, same account.
    const other = await browser.newContext()
    const second = await other.newPage()
    await useTestSettings(second)
    await fake.install(second)
    await signIn(second, 'sync@school.test', 'sync-password')
    await expect(second).toHaveURL(/\/$/)
    await expect(html(second)).toHaveAttribute('data-accent', 'pink')
    await other.close()
  })
})

import { expect, test, type Browser, type Page } from '@playwright/test'

import { FakeGoogleDrive } from './fakeGoogle.ts'
import { importPastedNames, navigateTo, trackPageErrors, useTestSettings as seedSettings } from './helpers.ts'

let pageErrors: string[] = []

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

/** A fresh browser ("another computer") signed in to the same fake Google account. */
async function openDevice(browser: Browser, drive: FakeGoogleDrive): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'th-TH' })
  const page = await context.newPage()
  pageErrors.push(...trackPageErrors(page))
  await seedSettings(page)
  await drive.install(page)
  await page.goto('/')
  return page
}

async function connect(page: Page): Promise<void> {
  await navigateTo(page, 'ตั้งค่า')
  await page.getByRole('tab', { name: 'Data Management' }).click()
  await page.getByRole('button', { name: 'เชื่อมต่อ Google Drive' }).click()
}

/**
 * Create a classroom without reloading the page: a reload drops Google's access token
 * (the app then asks to reconnect, which has its own test).
 */
async function createClassroom(page: Page, name: string): Promise<void> {
  await navigateTo(page, 'ห้องเรียน')
  await page.getByRole('button', { name: /^เพิ่มห้องเรียน/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มห้องเรียน' })
  await dialog.getByLabel('ชื่อห้องเรียน').fill(name)
  await dialog.getByRole('button', { name: 'สร้างห้องเรียน' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const driveStatus = (page: Page) => page.getByTestId('drive-status')
const statusButton = (page: Page) => page.getByTestId('drive-status-button').filter({ visible: true })

test.describe('Google Drive sync', () => {
  test.beforeEach(() => {
    pageErrors = []
  })

  test('saves classrooms and students to Drive and brings them to another computer', async ({ browser }) => {
    const drive = new FakeGoogleDrive()
    const first = await openDevice(browser, drive)
    await connect(first)
    await expect(driveStatus(first)).toHaveText('บันทึกแล้ว')
    await expect(first.getByTestId('drive-settings')).toContainText('kru@school.test')
    expect(drive.files.size).toBe(1)

    await createClassroom(first, 'ป.6/2')
    await importPastedNames(first, ['มานี มีตา', 'ปิติ พอใจ'])
    await expect
      .poll(() => drive.data()?.data.students.map((student) => student.firstName).sort())
      .toEqual(['ปิติ', 'มานี'])
    expect(drive.data()?.data.classrooms.map((classroom) => classroom.name)).toEqual(['ป.6/2'])
    await expect(statusButton(first)).toHaveAccessibleName(/บันทึกแล้ว/)

    const second = await openDevice(browser, drive)
    await connect(second)
    await expect(driveStatus(second)).toHaveText('บันทึกแล้ว')
    await navigateTo(second, 'ห้องเรียน')
    await expect(second.getByText('ป.6/2')).toBeVisible()
    expect(drive.files.size).toBe(1)
  })

  test('asks which data to keep when both computers changed', async ({ browser }) => {
    const drive = new FakeGoogleDrive()
    const first = await openDevice(browser, drive)
    await connect(first)
    await expect(driveStatus(first)).toHaveText('บันทึกแล้ว')
    await createClassroom(first, 'ห้องจาก Drive')
    await expect.poll(() => drive.data()?.data.classrooms.length).toBe(1)

    const second = await openDevice(browser, drive)
    await createClassroom(second, 'ห้องในเครื่อง')
    await connect(second)
    const dialog = second.getByRole('alertdialog', { name: 'ข้อมูลในเครื่องนี้กับ Google Drive ไม่ตรงกัน' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('ห้องเรียน 1')
    await dialog.getByRole('button', { name: 'ใช้ข้อมูลจาก Drive' }).click()
    await expect(dialog).toBeHidden()
    await expect(driveStatus(second)).toHaveText('บันทึกแล้ว')

    await navigateTo(second, 'ห้องเรียน')
    await expect(second.getByText('ห้องจาก Drive')).toBeVisible()
    await expect(second.getByText('ห้องในเครื่อง')).toHaveCount(0)
  })

  test('after a reload it asks to reconnect, then saves what changed meanwhile', async ({ browser }) => {
    const drive = new FakeGoogleDrive()
    const page = await openDevice(browser, drive)
    await connect(page)
    await expect(driveStatus(page)).toHaveText('บันทึกแล้ว')

    await page.reload()
    const button = statusButton(page)
    await expect(button).toHaveAccessibleName(/ต้องเชื่อมต่ออีกครั้ง/)
    // Working offline from Drive is fine: the change waits.
    await createClassroom(page, 'ห้องระหว่างรอ')
    expect(drive.data()?.data.classrooms ?? []).toEqual([])

    await button.click()
    await expect.poll(() => drive.data()?.data.classrooms.map((classroom) => classroom.name)).toEqual(['ห้องระหว่างรอ'])
    await expect(button).toHaveAccessibleName(/บันทึกแล้ว/)
  })

  test('disconnecting keeps the data on this computer', async ({ browser }) => {
    const drive = new FakeGoogleDrive()
    const page = await openDevice(browser, drive)
    await connect(page)
    await expect(driveStatus(page)).toHaveText('บันทึกแล้ว')
    await createClassroom(page, 'ห้องคงอยู่')
    await navigateTo(page, 'ตั้งค่า')
    await page.getByRole('tab', { name: 'Data Management' }).click()
    await page.getByRole('button', { name: 'ยกเลิกการเชื่อมต่อ' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ยกเลิกการเชื่อมต่อ' }).click()
    await expect(page.getByRole('button', { name: 'เชื่อมต่อ Google Drive' })).toBeVisible()
    await expect(statusButton(page)).toHaveCount(0)
    await navigateTo(page, 'ห้องเรียน')
    await expect(page.getByText('ห้องคงอยู่')).toBeVisible()
  })
})

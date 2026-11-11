import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { closeReveal, drawWinner, openStudio, seedClassroom, selectMode, stagePhase, trackPageErrors, useTestSettings } from './helpers.ts'

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await useTestSettings(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

const html = (page: Page) => page.locator('html')

test.describe('settings', () => {
  test('has the seven sections and keeps the open one in the URL', async ({ page }) => {
    await page.goto('/settings')
    const tabs = ['General', 'Appearance', 'Sound', 'Animation', 'Random Rules', 'Data Management', 'Display']
    for (const name of tabs) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('tab', { name: 'Display' }).click()
    await expect(page).toHaveURL(/tab=display/)
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Display' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Big Screen Mode' })).toBeVisible()
  })

  test('appearance: accent, text size and background effects apply at once and persist', async ({ page }) => {
    await page.goto('/settings?tab=appearance')
    await page.getByRole('radio', { name: 'Pink' }).check()
    await expect(html(page)).toHaveAttribute('data-accent', 'pink')
    await page.getByRole('radio', { name: 'ใหญ่มาก' }).click()
    await expect(html(page)).toHaveAttribute('data-scale', 'xl')
    await expect(html(page)).toHaveCSS('font-size', '19px')

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-accent', 'pink')
    await expect(html(page)).toHaveAttribute('data-scale', 'xl')
    await expect(page.getByRole('radio', { name: 'Pink' })).toBeChecked()
  })

  test('animation: the level drives the particle backdrop', async ({ page }) => {
    await page.goto('/settings?tab=animation')
    await expect(html(page)).toHaveAttribute('data-anim', 'low')
    const backdropCanvas = page.locator('[aria-hidden="true"].fixed canvas')
    await expect(backdropCanvas).toHaveCount(0)

    await page.getByRole('radio', { name: 'High' }).click()
    await expect(html(page)).toHaveAttribute('data-anim', 'high')
    await expect(backdropCanvas).toHaveCount(1)

    await page.getByRole('tab', { name: 'Appearance' }).click()
    await page.getByRole('switch', { name: 'อนุภาคเคลื่อนไหว' }).click()
    await expect(backdropCanvas).toHaveCount(0)
  })

  test('animation: the countdown starts from the configured number', async ({ page }) => {
    await page.goto('/settings?tab=animation')
    await page.getByRole('radio', { name: '10', exact: true }).click()
    await openStudio(page, 'countdown')
    await expect(page.getByTestId('stage').locator('span.tabular').first()).toHaveText('10')
  })

  test('general: teacher name greets on the dashboard and the name format reaches the stage', async ({ page }) => {
    await seedClassroom(page, 'ม.2/1', ['มานี มีตา'])
    await page.goto('/settings?tab=general')
    await page.getByLabel('ชื่อครู').fill('ครูฟ้า')
    await page.getByRole('radio', { name: 'ชื่อ-นามสกุล' }).click()
    await expect(page.getByText('ตัวอย่าง: กิตติพงษ์ ใจดี')).toBeVisible()

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('สวัสดี ครูฟ้า')

    await openStudio(page)
    expect(await drawWinner(page)).toBe('มานี มีตา')
  })

  test('general: the default mode is selected when the studio opens', async ({ page }) => {
    await page.goto('/settings?tab=general')
    await page.getByRole('combobox', { name: 'โหมดเริ่มต้น' }).click()
    await page.getByRole('option', { name: 'Gacha' }).click()
    await page.reload()
    await openStudio(page)
    await expect(page.getByRole('radio', { name: /Gacha/ })).toBeChecked()
  })

  test('random rules: edits are shared with the studio', async ({ page }) => {
    await seedClassroom(page, 'ม.2/2', ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ', 'วีระ ประสงค์สุข', 'สมคิด คิดดี'])
    await page.goto('/settings?tab=rules')
    await page.getByRole('button', { name: 'เพิ่มจำนวนที่สุ่มต่อครั้ง' }).click()
    await page.getByRole('radio', { name: 'ซ้ำได้' }).click()

    await openStudio(page)
    await expect(page.getByTestId('pool-count')).toHaveText('ผู้เข้าร่วม 5')
    await page.getByRole('radio', { name: 'หลายคน' }).click()
    await expect(page.getByTestId('draw-button')).toHaveText('สุ่ม 4 คน!')
  })

  test('display: toggles decide what the winner screen shows', async ({ page }) => {
    await seedClassroom(page, 'ม.2/3', ['มานี มีตา'])
    await openStudio(page)
    await drawWinner(page)
    const reveal = page.getByTestId('winner-reveal')
    await expect(reveal).toContainText('เลขที่ 1')
    await expect(reveal).toContainText('มานี มีตา')
    await expect(reveal.locator('[class*="ring-neon-gold"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'ใส่ชื่อกลับ' }).click()

    await page.goto('/settings?tab=display')
    await page.getByRole('switch', { name: 'แสดง Avatar' }).click()
    await page.getByRole('switch', { name: 'แสดงเลขที่' }).click()
    await page.getByRole('switch', { name: 'แสดงชื่อ-นามสกุล' }).click()

    await openStudio(page)
    await drawWinner(page)
    await expect(reveal.getByTestId('winner-name')).toHaveText('มานี')
    await expect(reveal).not.toContainText('เลขที่ 1')
    await expect(reveal).not.toContainText('มานี มีตา')
    await expect(reveal.locator('[class*="ring-neon-gold"]')).toHaveCount(0)
  })

  test('each section can be reset to its defaults', async ({ page }) => {
    await page.goto('/settings?tab=animation')
    await page.getByRole('radio', { name: 'ยาว' }).click()
    await expect(page.getByRole('radio', { name: 'ยาว' })).toBeChecked()
    await page.getByRole('button', { name: 'คืนค่าเริ่มต้น' }).click()
    await expect(page.getByRole('radio', { name: 'ปกติ', exact: true })).toBeChecked()
  })
})

test.describe('data management', () => {
  test('backs up, wipes and restores everything', async ({ page }) => {
    await seedClassroom(page, 'ม.3/1', ['มานี มีตา', 'ปิติ พอใจ'])
    await openStudio(page)
    const winner = await drawWinner(page)
    await closeReveal(page)

    await page.goto('/settings?tab=data')
    const counts = page.locator('dl')
    await expect(counts).toContainText('ห้องเรียน1')
    await expect(counts).toContainText('นักเรียน2')
    await expect(counts).toContainText('ผลการสุ่ม1')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'ดาวน์โหลดไฟล์สำรอง' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^randomizer-backup-\d{4}-\d{2}-\d{2}_\d{4}\.json$/)
    const backupPath = await download.path()
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as { format: string; data: { students: unknown[] } }
    expect(backup.format).toBe('ngsr-backup')
    expect(backup.data.students).toHaveLength(2)

    await page.getByRole('button', { name: 'ลบข้อมูลทั้งหมด' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบข้อมูลทั้งหมด' }).click()
    await expect(counts).toContainText('ห้องเรียน0')
    await expect(counts).toContainText('ผลการสุ่ม0')

    await page.locator('input[type="file"]').setInputFiles(backupPath)
    const dialog = page.getByRole('alertdialog', { name: 'กู้คืนข้อมูลจากไฟล์นี้?' })
    await expect(dialog).toContainText('นักเรียน 2')
    await expect(dialog).toContainText('ผลการสุ่ม 1')
    await dialog.getByRole('button', { name: 'กู้คืนข้อมูล' }).click()
    await expect(counts).toContainText('นักเรียน2')
    await expect(counts).toContainText('ผลการสุ่ม1')

    await page.goto('/history')
    await expect(page.getByRole('row').nth(1)).toContainText(winner)
    await page.goto('/classrooms')
    await expect(page.getByRole('link', { name: 'ม.3/1' })).toBeVisible()
  })

  test('refuses a file that is not a backup', async ({ page }) => {
    await page.goto('/settings?tab=data')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'not-a-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}', 'utf8'),
    })
    await expect(page.getByText('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ NEXT-GEN STUDENT RANDOMIZER')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('adds labelled sample data and resets all settings', async ({ page }) => {
    await page.goto('/settings?tab=data')
    await page.getByRole('button', { name: 'เพิ่มห้องตัวอย่าง' }).click()
    await expect(page.locator('dl')).toContainText('นักเรียน24')
    await expect(page.getByRole('button', { name: 'เพิ่มห้องตัวอย่าง' })).toBeDisabled()

    await page.getByRole('tab', { name: 'Appearance' }).click()
    await page.getByRole('radio', { name: 'Cyan' }).check()
    await expect(html(page)).toHaveAttribute('data-accent', 'cyan')
    await page.getByRole('tab', { name: 'Data Management' }).click()
    await page.getByRole('button', { name: 'คืนค่าเริ่มต้น' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'คืนค่าเริ่มต้น' }).click()
    await expect(html(page)).toHaveAttribute('data-accent', 'violet')
  })
})

test.describe('big screen mode', () => {
  test('hides the navigation, fills the window and exits with Escape', async ({ page, isMobile }) => {
    await seedClassroom(page, 'ม.3/2', ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ'])
    await openStudio(page)
    const navigation = page.getByRole('navigation', { name: 'เมนูหลัก' })
    await expect(navigation.first()).toBeVisible()
    const before = await page.getByTestId('stage').boundingBox()

    await page.getByRole('button', { name: 'จอใหญ่' }).click()
    await expect(html(page)).toHaveAttribute('data-immersive', 'true')
    await expect(navigation).toHaveCount(0)
    const after = await page.getByTestId('stage').boundingBox()
    expect((after?.height ?? 0) * (after?.width ?? 0)).toBeGreaterThan((before?.height ?? 0) * (before?.width ?? 0))

    // Drawing still works, and the panel is reachable through the sheet.
    await drawWinner(page)
    await closeReveal(page)
    await expect(page.getByRole('button', { name: 'ผู้เข้าร่วมและกติกา' })).toBeVisible()
    await selectMode(page, 'slot')

    if (isMobile) {
      await page.getByRole('button', { name: 'ออกจากจอใหญ่' }).click()
    } else {
      await page.locator('body').press('Escape')
    }
    await expect(html(page)).toHaveAttribute('data-immersive', 'false')
    await expect(navigation.first()).toBeVisible()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'idle')
  })

  test('the F key toggles it and leaving the studio ends it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hardware keyboard shortcut')
    // Arrive in the studio through in-app navigation, so "back" stays inside the app.
    await page.goto('/history')
    await page.getByRole('navigation', { name: 'เมนูหลัก' }).first().getByRole('link', { name: 'สตูดิโอ' }).click()
    await expect(page.getByTestId('stage')).toBeVisible()

    await page.locator('body').press('f')
    await expect(html(page)).toHaveAttribute('data-immersive', 'true')
    await page.locator('body').press('f')
    await expect(html(page)).toHaveAttribute('data-immersive', 'false')

    await page.locator('body').press('f')
    await expect(html(page)).toHaveAttribute('data-immersive', 'true')
    await page.goBack()
    await expect(page).toHaveURL(/\/history$/)
    await expect(html(page)).toHaveAttribute('data-immersive', 'false')
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' }).first()).toBeVisible()
  })
})

import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

import { closeReveal, drawWinner, openStudio, seedClassroom, selectMode, trackPageErrors, useTestSettings } from './helpers.ts'

const ROSTER = ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ', 'วีระ ประสงค์สุข']

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await useTestSettings(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

/** Two wheel draws and one slot draw in the same round. Returns the winners' first names in order. */
async function playRound(page: Page): Promise<string[]> {
  await seedClassroom(page, 'ป.2/1', ROSTER)
  await openStudio(page)
  const winners: string[] = []
  winners.push(await drawWinner(page))
  await closeReveal(page)
  winners.push(await drawWinner(page))
  await closeReveal(page)
  await selectMode(page, 'slot')
  winners.push(await drawWinner(page))
  await closeReveal(page)
  return winners
}

test.describe('history', () => {
  test('starts empty and points to the studio', async ({ page }) => {
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'ยังไม่มีประวัติการสุ่ม' })).toBeVisible()
    await page.getByRole('link', { name: 'ไปที่สตูดิโอ' }).click()
    await expect(page).toHaveURL(/\/studio$/)
  })

  test('lists results newest first with date, classroom and mode', async ({ page, isMobile }) => {
    const winners = await playRound(page)
    await page.goto('/history')

    await expect(page.getByText('พบ 3 รายการ')).toBeVisible()
    const rows = page.getByRole('row')
    await expect(rows).toHaveCount(4)
    // Newest first: the slot draw is on top. The table stores the full name.
    await expect(rows.nth(1)).toContainText(winners[2] as string)
    await expect(rows.nth(3)).toContainText(winners[0] as string)
    await expect(rows.nth(1)).toContainText('ป.2/1')
    await expect(rows.nth(1)).toContainText(isMobile ? 'สล็อต' : 'Mystery Slot')
    await expect(rows.nth(3)).toContainText(isMobile ? 'วงล้อ' : 'Lucky Wheel')
    await expect(rows.nth(1)).toContainText(String(new Date().getFullYear() + 543))
  })

  test('filters by mode and by name, and offers a way out of an empty result', async ({ page }) => {
    const winners = await playRound(page)
    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(4)

    await page.getByRole('combobox', { name: 'กรองตามรูปแบบการสุ่ม' }).click()
    await page.getByRole('option', { name: 'Mystery Slot' }).click()
    await expect(page.getByText('พบ 1 รายการ')).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toContainText(winners[2] as string)

    await page.getByRole('combobox', { name: 'กรองตามรูปแบบการสุ่ม' }).click()
    await page.getByRole('option', { name: 'Gacha' }).click()
    await expect(page.getByRole('heading', { name: 'ไม่พบประวัติที่ตรงกับตัวกรอง' })).toBeVisible()
    await page.getByRole('button', { name: 'ดูทั้งหมด' }).click()
    await expect(page.getByRole('row')).toHaveCount(4)

    await page.getByRole('searchbox', { name: 'ค้นหาชื่อในประวัติ' }).fill(winners[0] as string)
    await expect(page.getByText('พบ 1 รายการ')).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toContainText(winners[0] as string)
  })

  test('shows each round with its draws in order', async ({ page }) => {
    const winners = await playRound(page)
    await page.goto('/history')
    await page.getByRole('radio', { name: 'รายรอบ' }).click()

    const round = page.getByRole('listitem').filter({ hasText: 'ป.2/1' }).first()
    await expect(round).toContainText('3 ครั้ง')
    await expect(round).toContainText('รอบปัจจุบัน')
    const draws = round.getByRole('listitem')
    await expect(draws).toHaveCount(3)
    await expect(draws.nth(0)).toContainText(winners[0] as string)
    await expect(draws.nth(0)).toContainText('วงล้อ')
    await expect(draws.nth(2)).toContainText(winners[2] as string)
    await expect(draws.nth(2)).toContainText('สล็อต')
  })

  test('exports the report to Excel', async ({ page }) => {
    const winners = await playRound(page)
    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(4)

    await page.getByRole('button', { name: 'ส่งออกรายงาน' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Excel (.xlsx)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^รายงานการสุ่ม \d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
    const workbook = XLSX.read(await readFile(await download.path()), { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (!sheet) throw new Error('report has no sheet')
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false })
    expect(rows[0]).toEqual([
      'วันที่',
      'เวลา',
      'ห้องเรียน',
      'รูปแบบ',
      'ประเภท',
      'ชื่อ',
      'เลขที่',
      'ทีม',
      'ลำดับในครั้ง',
      'ดาว',
      'ภารกิจ',
      'รางวัลเซอร์ไพรส์',
      'ผลการตอบ',
      'Lucky Streak',
    ])
    expect(rows).toHaveLength(4)
    expect(rows[1]?.slice(2, 5)).toEqual(['ป.2/1', 'Mystery Slot', 'ทีละคน'])
    expect(rows[1]?.[5]).toContain(winners[2] as string)
    expect(rows[3]?.[3]).toBe('Lucky Wheel')
  })

  test('deletes one result, then clears everything while keeping the roster', async ({ page }) => {
    await playRound(page)
    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(4)

    await page.getByRole('button', { name: /^ลบผลการสุ่ม/ }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบรายการ' }).click()
    await expect(page.getByRole('row')).toHaveCount(3)

    await page.getByRole('button', { name: 'ล้างประวัติ' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ล้างประวัติทั้งหมด' }).click()
    await expect(page.getByRole('heading', { name: 'ยังไม่มีประวัติการสุ่ม' })).toBeVisible()

    // The classroom is untouched and a new draw starts a fresh, valid round.
    await page.goto('/classrooms')
    await expect(page.getByRole('link', { name: 'ป.2/1' })).toBeVisible()
    await openStudio(page)
    await drawWinner(page)
    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(2)
  })
})

test.describe('dashboard', () => {
  test('guides a new user and quick-starts a number draw', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'เริ่มต้นใช้งาน' })).toBeVisible()

    await page.getByRole('radio', { name: 'สุ่มตัวเลข' }).check()
    await page.getByRole('link', { name: /^Countdown/ }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByRole('radio', { name: /Countdown/ })).toBeChecked()
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 40 / 40')
  })

  test('summarises classrooms, students and today\'s draws', async ({ page }) => {
    const winners = await playRound(page)
    await page.goto('/')

    const overview = page.getByRole('region', { name: 'ภาพรวมระบบ' })
    await expect(overview.getByText('ห้องเรียน').locator('xpath=../..')).toContainText('1')
    await expect(overview.getByText('นักเรียน').locator('xpath=../..')).toContainText('4')
    await expect(overview.getByText('สุ่มวันนี้').locator('xpath=../..')).toContainText('3')

    // The chart's table view carries the same number for today.
    const table = page.getByRole('table', { name: 'จำนวนครั้งที่สุ่มในแต่ละวัน' })
    await expect(table.getByRole('row').last()).toContainText('3')

    await expect(page.getByText('ผู้ถูกสุ่มล่าสุด').locator('xpath=../..')).toContainText(winners[2] as string)
    await expect(page.getByText('กิจกรรมล่าสุด').locator('xpath=../..')).toContainText('เพิ่มนักเรียน 4 คน')
    await expect(page.getByText('โหมดที่ใช้บ่อย (30 วัน)').locator('xpath=../..')).toContainText('Lucky Wheel')
  })

  test('quick start opens the studio on the chosen classroom and mode', async ({ page }) => {
    await seedClassroom(page, 'ป.2/2', ROSTER)
    await page.goto('/')
    await page.getByRole('radio', { name: 'ป.2/2' }).check()
    await page.getByRole('link', { name: /^Gacha/ }).click()

    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByRole('radio', { name: /Gacha/ })).toBeChecked()
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 4 / 4')
  })
})

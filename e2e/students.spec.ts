import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'

import { addStudents, createClassroom, fillStudentForm, importPastedNames, trackPageErrors, useTestSettings } from './helpers.ts'

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await useTestSettings(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

test.describe('classrooms', () => {
  test('creates a classroom and opens its empty roster', async ({ page }) => {
    await page.goto('/classrooms')
    await expect(page.getByRole('heading', { name: 'ยังไม่มีห้องเรียน' })).toBeVisible()

    await createClassroom(page, 'ป.5/1')
    await expect(page.getByRole('heading', { name: 'ยังไม่มีนักเรียนในห้องนี้' })).toBeVisible()

    await page.goto('/classrooms')
    await expect(page.getByRole('link', { name: 'ป.5/1' })).toBeVisible()
  })

  test('validates the classroom form', async ({ page }) => {
    await createClassroom(page, 'ม.1/1')
    await page.goto('/classrooms')
    await page.getByRole('button', { name: 'เพิ่มห้องเรียน' }).click()
    const dialog = page.getByRole('dialog', { name: 'เพิ่มห้องเรียน' })

    await dialog.getByRole('button', { name: 'สร้างห้องเรียน' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('กรุณากรอกชื่อห้องเรียน')

    await dialog.getByLabel('ชื่อห้องเรียน').fill('ม.1/1')
    await dialog.getByRole('button', { name: 'สร้างห้องเรียน' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('มีห้องเรียนชื่อนี้ในปีการศึกษาเดียวกันอยู่แล้ว')

    await dialog.getByLabel('ปีการศึกษา').fill('69')
    await dialog.getByLabel('ชื่อห้องเรียน').fill('ม.1/2')
    await dialog.getByRole('button', { name: 'สร้างห้องเรียน' }).click()
    await expect(dialog.getByRole('alert')).toContainText('4 หลัก')
  })

  test('edits and deletes a classroom', async ({ page }) => {
    await createClassroom(page, 'ห้องเดิม')
    await page.goto('/classrooms')

    await page.getByRole('button', { name: 'ตัวเลือกของห้อง ห้องเดิม' }).click()
    await page.getByRole('menuitem', { name: 'แก้ไขห้องเรียน' }).click()
    const dialog = page.getByRole('dialog', { name: 'แก้ไขห้องเรียน' })
    await dialog.getByLabel('ชื่อห้องเรียน').fill('ห้องใหม่')
    await dialog.getByRole('button', { name: 'บันทึก' }).click()
    await expect(page.getByRole('link', { name: 'ห้องใหม่' })).toBeVisible()

    await page.getByRole('button', { name: 'ตัวเลือกของห้อง ห้องใหม่' }).click()
    await page.getByRole('menuitem', { name: 'ลบห้องเรียน' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบห้องเรียน' }).click()
    await expect(page.getByRole('heading', { name: 'ยังไม่มีห้องเรียน' })).toBeVisible()
  })

  test('sample data is clearly labelled and removable', async ({ page }) => {
    await page.goto('/classrooms')
    await page.getByRole('button', { name: 'ลองด้วยข้อมูลตัวอย่าง' }).click()

    await expect(page.getByText('นี่คือข้อมูลตัวอย่าง รายชื่อทั้งหมดเป็นชื่อสมมติ ไม่ใช่นักเรียนจริง')).toBeVisible()
    await expect(page.getByText('ทั้งหมด 24 คน')).toBeVisible()

    await page.goto('/classrooms')
    await expect(page.getByText('ข้อมูลตัวอย่าง', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: /ห้องตัวอย่าง/ }).click()
    await page.getByRole('button', { name: 'ลบข้อมูลตัวอย่าง' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบห้องเรียน' }).click()
    await expect(page.getByRole('heading', { name: 'ยังไม่มีห้องเรียน' })).toBeVisible()
  })

  test('shows a not-found state for an unknown classroom', async ({ page }) => {
    await page.goto('/classrooms/00000000-0000-4000-8000-000000000000')
    await expect(page.getByRole('heading', { name: 'ไม่พบห้องเรียนนี้' })).toBeVisible()
  })
})

test.describe('students', () => {
  test('adds students in a row with auto-numbering and keeps them after a reload', async ({ page }) => {
    await createClassroom(page, 'ป.4/2')
    await addStudents(page, [
      { firstName: 'มานี', lastName: 'มีตา', nickname: 'นี' },
      { firstName: 'ปิติ', lastName: 'พอใจ' },
      { firstName: 'ชูใจ', lastName: 'เลิศล้ำ', studentCode: 'A-103' },
    ])

    const rows = page.getByRole('row')
    await expect(rows).toHaveCount(4) // header + 3 students
    await expect(rows.nth(1)).toContainText('1')
    await expect(rows.nth(1)).toContainText('มานี มีตา')
    await expect(rows.nth(3)).toContainText('3')
    await expect(rows.nth(3)).toContainText('ชูใจ เลิศล้ำ')

    await page.reload()
    await expect(page.getByRole('row')).toHaveCount(4)
    await expect(page.getByText('ทั้งหมด 3 คน')).toBeVisible()
  })

  test('validates the student form', async ({ page }) => {
    await createClassroom(page, 'ป.4/3')
    await addStudents(page, [{ firstName: 'มานี', lastName: 'มีตา', studentCode: 'S1' }])

    await page.getByRole('button', { name: 'เพิ่มนักเรียน' }).click()
    const dialog = page.getByRole('dialog', { name: 'เพิ่มนักเรียน' })
    await expect(dialog.getByLabel('เลขที่')).toHaveValue('2')

    await dialog.getByRole('button', { name: 'บันทึกและปิด' }).click()
    await expect(dialog.getByText('กรุณากรอกชื่อ')).toBeVisible()

    await fillStudentForm(page, { firstName: 'ปิติ', number: '1', studentCode: 's1' })
    await dialog.getByRole('button', { name: 'บันทึกและปิด' }).click()
    await expect(dialog.getByText('เลขที่ 1 ถูกใช้แล้ว')).toBeVisible()
    await expect(dialog.getByText('รหัสนักเรียนนี้มีอยู่ในห้องแล้ว')).toBeVisible()

    await fillStudentForm(page, { firstName: 'ปิติ', number: '2', studentCode: 'S2' })
    await dialog.getByRole('button', { name: 'บันทึกและปิด' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row')).toHaveCount(3)
  })

  test('edits a student including the avatar, then deletes them', async ({ page }) => {
    await createClassroom(page, 'ป.4/4')
    await addStudents(page, [{ firstName: 'มานี', lastName: 'มีตา' }])

    await page.getByRole('button', { name: 'แก้ไข มานี มีตา' }).click()
    const dialog = page.getByRole('dialog', { name: 'แก้ไขข้อมูลนักเรียน' })
    await dialog.getByLabel('ชื่อเล่น').fill('นี')
    await dialog.getByRole('button', { name: 'เปลี่ยน Avatar' }).click()
    await page.getByRole('tab', { name: 'อีโมจิ' }).click()
    await page.getByRole('button', { name: 'อีโมจิ 🦊' }).click()
    await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByRole('row').nth(1)).toContainText('นี')
    await expect(page.getByRole('row').nth(1).locator('svg text')).toHaveText('🦊')

    await page.getByRole('button', { name: 'ลบ มานี มีตา' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบนักเรียน' }).click()
    await expect(page.getByRole('heading', { name: 'ยังไม่มีนักเรียนในห้องนี้' })).toBeVisible()
  })

  test('searches, selects and bulk-deletes', async ({ page }) => {
    await createClassroom(page, 'ป.4/5')
    await importPastedNames(page, ['มานี มีตา', 'มานะ อดทน', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ'])
    await expect(page.getByRole('row')).toHaveCount(5)

    const search = page.getByRole('searchbox', { name: 'ค้นหานักเรียน' })
    await search.fill('มาน')
    await expect(page.getByRole('row')).toHaveCount(3)
    await expect(page.getByText('พบ 2 จาก 4 คน')).toBeVisible()

    await search.fill('ไม่มีคนนี้')
    await expect(page.getByRole('heading', { name: 'ไม่พบนักเรียนที่ค้นหา' })).toBeVisible()
    await page.getByRole('button', { name: 'ล้างคำค้นหา' }).last().click()
    await expect(page.getByRole('row')).toHaveCount(5)

    // Select only what the search shows, then delete the selection.
    await search.fill('มาน')
    await page.getByRole('checkbox', { name: 'เลือกนักเรียนทั้งหมดที่แสดง' }).click()
    await expect(page.getByText('เลือก 2 คน')).toBeVisible()
    await page.getByRole('button', { name: 'ลบที่เลือก' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบ 2 คน' }).click()

    await search.fill('')
    await expect(page.getByRole('row')).toHaveCount(3)
    await expect(page.getByText('ทั้งหมด 2 คน')).toBeVisible()
  })
})

test.describe('import and export', () => {
  test('imports pasted names and strips Thai name prefixes', async ({ page }) => {
    await createClassroom(page, 'ป.3/1')
    await page.getByRole('button', { name: 'นำเข้าจาก Excel' }).click()
    const dialog = page.getByRole('dialog', { name: 'นำเข้ารายชื่อนักเรียน' })
    await dialog.getByLabel(/วางรายชื่อ/).fill('เด็กชายกิตติพงษ์ ใจดี\nด.ญ.กานดา รักเรียน\n\nนางสาวสมหญิง ณ อยุธยา')
    await dialog.getByRole('button', { name: 'ใช้รายชื่อที่วาง' }).click()

    await expect(dialog.getByText('พร้อมนำเข้า 3 คน')).toBeVisible()
    await dialog.getByRole('button', { name: 'นำเข้า 3 คน' }).click()
    await expect(dialog).toBeHidden()

    const rows = page.getByRole('row')
    await expect(rows.nth(1)).toContainText('กิตติพงษ์ ใจดี')
    await expect(rows.nth(2)).toContainText('กานดา รักเรียน')
    await expect(rows.nth(3)).toContainText('สมหญิง ณ อยุธยา')
    await expect(page.getByText('เด็กชาย')).toHaveCount(0)
  })

  test('imports a CSV file, maps its columns and reports skipped rows', async ({ page }) => {
    await createClassroom(page, 'ป.3/2')
    await addStudents(page, [{ firstName: 'มานี', lastName: 'มีตา' }])

    const csv = [
      'เลขที่,รหัสนักเรียน,ชื่อ,นามสกุล,ชื่อเล่น',
      '1,00123,ปิติ,พอใจ,ติ',
      '2,00124,ชูใจ,เลิศล้ำ,ใจ',
      '3,00125,,ไม่มีชื่อ,',
      '4,00126,มานี,มีตา,',
    ].join('\n')

    await page.getByRole('button', { name: 'นำเข้า', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'นำเข้ารายชื่อนักเรียน' })
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'รายชื่อ.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`﻿${csv}`, 'utf8'),
    })

    await expect(dialog.getByRole('switch', { name: 'แถวแรกเป็นหัวตาราง' })).toBeChecked()
    await expect(dialog.getByRole('combobox', { name: /คอลัมน์ 1/ })).toHaveText('เลขที่')
    await expect(dialog.getByRole('combobox', { name: /คอลัมน์ 3/ })).toHaveText('ชื่อ')
    await expect(dialog.getByText('พร้อมนำเข้า 2 คน')).toBeVisible()
    await expect(dialog.getByText('ข้าม 2 แถว')).toBeVisible()
    // Roll number 1 is taken by the existing student, so one row is renumbered.
    await expect(dialog.getByText('ปรับแก้ 1 แถว')).toBeVisible()

    await dialog.getByRole('button', { name: 'นำเข้า 2 คน' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row')).toHaveCount(4)
    await expect(page.getByRole('row').nth(2)).toContainText('ชูใจ เลิศล้ำ')
    await expect(page.getByText('ทั้งหมด 3 คน')).toBeVisible()
  })

  test('can replace the whole roster on import', async ({ page }) => {
    await createClassroom(page, 'ป.3/3')
    await importPastedNames(page, ['เก่า หนึ่ง', 'เก่า สอง'])

    await page.getByRole('button', { name: 'นำเข้า', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'นำเข้ารายชื่อนักเรียน' })
    await dialog.getByLabel(/วางรายชื่อ/).fill('ใหม่ หนึ่ง')
    await dialog.getByRole('button', { name: 'ใช้รายชื่อที่วาง' }).click()
    await dialog.getByRole('radio', { name: 'แทนที่ทั้งหมด' }).click()
    await expect(dialog.getByText('รายชื่อเดิมทั้ง 2 คนจะถูกลบและแทนที่ด้วยรายชื่อใหม่')).toBeVisible()
    await dialog.getByRole('button', { name: 'นำเข้า 1 คน' }).click()

    await expect(page.getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('row').nth(1)).toContainText('ใหม่ หนึ่ง')
  })

  test('rejects a file that is not a spreadsheet', async ({ page }) => {
    await createClassroom(page, 'ป.3/4')
    await page.getByRole('button', { name: 'นำเข้าจาก Excel' }).click()
    const dialog = page.getByRole('dialog', { name: 'นำเข้ารายชื่อนักเรียน' })
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('\n\n', 'utf8'),
    })
    await expect(dialog.getByRole('alert')).toContainText('ไม่พบข้อมูล')
  })

  test('exports the roster to Excel and CSV', async ({ page }) => {
    await createClassroom(page, 'ป.3/5')
    await addStudents(page, [
      { firstName: 'มานี', lastName: 'มีตา', nickname: 'นี', studentCode: '00123' },
      { firstName: '=SUM(1)', lastName: 'ทดสอบ' },
    ])

    await page.getByRole('button', { name: 'ส่งออก' }).click()
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Excel (.xlsx)' }).click(),
    ])
    expect(xlsxDownload.suggestedFilename()).toMatch(/^รายชื่อ ป\.3-5 \d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
    const workbook = XLSX.read(await readFile(await xlsxDownload.path()), { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (!sheet) throw new Error('exported workbook has no sheet')
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })).toEqual([
      ['เลขที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น'],
      ['1', '00123', 'มานี', 'มีตา', 'นี'],
      ['2', '', '=SUM(1)', 'ทดสอบ', ''],
    ])
    // The risky text is stored as a string cell, never as a formula.
    expect(sheet.C3).toMatchObject({ t: 's', v: '=SUM(1)' })

    await page.getByRole('button', { name: 'ส่งออก' }).click()
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'CSV (.csv)' }).click(),
    ])
    const csv = await readFile(await csvDownload.path(), 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM so Excel opens Thai text correctly
    expect(csv).toContain('1,00123,มานี,มีตา,นี')
    expect(csv).toContain("2,,'=SUM(1),ทดสอบ,") // formula injection neutralised
  })
})

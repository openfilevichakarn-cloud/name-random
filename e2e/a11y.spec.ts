import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { trackPageErrors, useTestSettings } from './helpers.ts'

/** Pages to scan, with demo data so lists, tables and charts have content. */
const PAGES = [
  { path: '/', name: 'หน้าหลัก' },
  { path: '/classrooms', name: 'ห้องเรียน' },
  { path: '/studio', name: 'สตูดิโอ' },
  { path: '/ranking', name: 'อันดับ' },
  { path: '/battle', name: 'Team Battle' },
  { path: '/history', name: 'ประวัติ' },
  { path: '/settings?tab=features', name: 'ตั้งค่า' },
] as const

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
    }))
}

test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
  let pageErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    pageErrors = trackPageErrors(page)
    await useTestSettings(page)
    await page.goto('/classrooms')
    await page.getByRole('button', { name: 'ลองด้วยข้อมูลตัวอย่าง' }).click()
    await expect(page.getByText('ทั้งหมด 24 คน')).toBeVisible()
  })

  test.afterEach(() => {
    expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
  })

  for (const target of PAGES) {
    test(`${target.name} has no serious or critical violations`, async ({ page }) => {
      await page.goto(target.path)
      await expect(page.locator('main')).toBeVisible()
      // Let entrance animations settle so colours are measured at rest.
      await page.waitForTimeout(800)
      expect(await scan(page)).toEqual([])
    })
  }

  test('the winner screen has no serious or critical violations', async ({ page }) => {
    await page.goto('/studio')
    await page.getByTestId('draw-button').click()
    await page.getByRole('button', { name: 'ข้าม' }).click()
    await expect(page.getByTestId('winner-reveal')).toBeVisible()
    await page.waitForTimeout(900)
    expect(await scan(page)).toEqual([])
  })
})

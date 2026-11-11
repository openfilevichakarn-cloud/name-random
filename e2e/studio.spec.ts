import { expect, test, type Page } from '@playwright/test'

import {
  closePanel,
  closeReveal,
  drawWinner,
  openPanel,
  openStudio,
  seedClassroom,
  selectMode,
  stagePhase,
  trackPageErrors,
  useTestSettings,
  type ModeName,
} from './helpers.ts'

const ROSTER = ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ', 'วีระ ประสงค์สุข', 'สมคิด คิดดี', 'ดวงแก้ว ใจหวัง']
const FIRST_NAMES = ROSTER.map((name) => name.split(' ')[0])

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = trackPageErrors(page)
  await useTestSettings(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

test.describe('game modes', () => {
  const landed: Record<Exclude<ModeName, 'card'>, (page: Page, winner: string) => Promise<void>> = {
    // The label under the pointer once the wheel has stopped.
    wheel: async (page, winner) => {
      await expect(page.getByTestId('stage-result')).toHaveText(winner)
    },
    // The name reel rests on the winner.
    slot: async (page, winner) => {
      await expect(page.getByTestId('reel-result-name')).toHaveText(winner)
    },
    // The name ticker locks onto the winner at zero.
    countdown: async (page, winner) => {
      await expect(page.getByTestId('stage-result')).toHaveText(winner)
    },
    gacha: async () => undefined,
  }

  for (const mode of ['wheel', 'slot', 'countdown', 'gacha'] as const) {
    test(`${mode}: the full animation ends on the drawn student`, async ({ page }) => {
      await seedClassroom(page, 'ป.6/1', ROSTER)
      await openStudio(page, mode)
      await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 6 / 6')

      const winner = await drawWinner(page, { skip: false })
      expect(FIRST_NAMES).toContain(winner)
      await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 6')

      // Under the overlay, the stage itself must have come to rest on that same student.
      await landed[mode](page, winner)
      await closeReveal(page)

      await page.goto('/history')
      await expect(page.getByRole('row')).toHaveCount(2)
      await expect(page.getByRole('row').nth(1)).toContainText(winner)
    })
  }

  test('card: the student chooses which card to turn over', async ({ page }) => {
    await seedClassroom(page, 'ป.6/2', ROSTER)
    await openStudio(page, 'card')

    await page.getByTestId('draw-button').click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'picking', { timeout: 15_000 })
    await expect(page.getByText('แตะเลือกการ์ด 1 ใบ')).toBeVisible()
    const cards = page.getByRole('button', { name: /^การ์ดใบที่/ })
    await expect(cards).toHaveCount(6)

    await page.getByRole('button', { name: 'การ์ดใบที่ 4' }).click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'reveal', { timeout: 15_000 })
    const winner = (await page.getByTestId('winner-name').innerText()).trim()
    expect(FIRST_NAMES).toContain(winner)

    // Afterwards every card is face up: the picked one shows the winner, and all six students are on the table.
    await closeReveal(page)
    for (const name of FIRST_NAMES) {
      await expect(page.getByTestId('stage').getByRole('button', { name: name as string })).toHaveCount(1)
    }
  })
})

test.describe('random rules', () => {
  test('no repeat: draws everyone exactly once, then asks for a new round', async ({ page }) => {
    const roster = ROSTER.slice(0, 4)
    await seedClassroom(page, 'ป.6/3', roster)
    await openStudio(page)

    const winners: string[] = []
    for (let turn = 0; turn < roster.length; turn += 1) {
      winners.push(await drawWinner(page))
      await expect(page.getByTestId('pool-count')).toHaveText(`เหลือ ${roster.length - turn - 1} / ${roster.length}`)
      if (turn < roster.length - 1) {
        await closeReveal(page)
      } else {
        // Nobody is left: the winner screen no longer offers another draw.
        await expect(page.getByRole('button', { name: 'สุ่มต่อ' })).toHaveCount(0)
        await closeReveal(page)
      }
    }
    expect([...winners].sort()).toEqual(roster.map((name) => name.split(' ')[0]).sort())

    await expect(page.getByText('สุ่มครบทุกคนแล้ว!')).toBeVisible()
    await expect(page.getByTestId('draw-button')).toHaveCount(0)

    await page.getByRole('button', { name: 'เริ่มรอบใหม่' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'เริ่มรอบใหม่' }).click()
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 4 / 4')
    await expect(page.getByTestId('draw-button')).toBeEnabled()
  })

  test('the round survives a page reload', async ({ page }) => {
    await seedClassroom(page, 'ป.6/4', ROSTER)
    await openStudio(page)
    const first = await drawWinner(page)
    await closeReveal(page)

    await page.reload()
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 6')
    const second = await drawWinner(page)
    expect(second).not.toBe(first)
  })

  test('repeat allowed keeps everyone in the pool; "exclude selected" removes the winner', async ({ page }) => {
    await seedClassroom(page, 'ป.6/5', ['มานี มีตา', 'ปิติ พอใจ'])
    await openStudio(page)
    await openPanel(page, 'กติกา')
    await page.getByRole('radio', { name: 'ซ้ำได้' }).click()
    await closePanel(page)
    await expect(page.getByTestId('pool-count')).toHaveText('ผู้เข้าร่วม 2')

    const first = await drawWinner(page)
    await expect(page.getByTestId('pool-count')).toHaveText('ผู้เข้าร่วม 2')
    await page.getByRole('button', { name: 'ตัดชื่อออก' }).click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'idle')
    await expect(page.getByTestId('pool-count')).toHaveText('ผู้เข้าร่วม 1')

    // Only one student is left, so every further draw must return them.
    const other = first === 'มานี' ? 'ปิติ' : 'มานี'
    expect(await drawWinner(page)).toBe(other)
    await page.getByRole('button', { name: 'สุ่มต่อ' }).click()
    await page.getByRole('button', { name: 'ข้าม' }).click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'reveal')
    await expect(page.getByTestId('winner-name')).toHaveText(other)
    await expect(page.getByTestId('pool-count')).toHaveText('ผู้เข้าร่วม 1')
  })

  test('manual exclude takes students out before the draw', async ({ page }) => {
    await seedClassroom(page, 'ป.6/6', ROSTER.slice(0, 3))
    await openStudio(page)
    await openPanel(page, 'ผู้เข้าร่วม')
    await page.getByRole('switch', { name: 'มานี เข้าร่วมการสุ่ม' }).click()
    await page.getByRole('switch', { name: 'ปิติ เข้าร่วมการสุ่ม' }).click()
    await expect(page.getByText('ตัดออก 2')).toBeVisible()
    await closePanel(page)

    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 1 / 1')
    expect(await drawWinner(page)).toBe('ชูใจ')
  })

  test('multiple random reveals distinct winners and a summary', async ({ page }) => {
    await seedClassroom(page, 'ป.6/7', ROSTER)
    await openStudio(page)
    await page.getByRole('radio', { name: 'หลายคน' }).click()
    await expect(page.getByTestId('draw-button')).toHaveText('สุ่ม 3 คน!')

    await page.getByTestId('draw-button').click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'summary', { timeout: 40_000 })
    const summary = page.getByTestId('draw-summary')
    await expect(summary.getByRole('heading')).toHaveText('ผู้ถูกเลือก 3 คน')
    const names = await summary.getByRole('listitem').locator('span.font-bold').allInnerTexts()
    expect(new Set(names).size).toBe(3)
    for (const name of names) expect(FIRST_NAMES).toContain(name)
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 3 / 6')
  })

  test('team random splits everyone into balanced teams', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await seedClassroom(page, 'ป.6/8', ROSTER)
    await openStudio(page)
    await page.getByRole('radio', { name: 'แบ่งทีม' }).click()
    await openPanel(page, 'กติกา')
    await page.getByRole('button', { name: 'ลดจำนวนทีม' }).click()
    await closePanel(page)
    await expect(page.getByText('แบ่ง 6 คน เป็น 3 ทีม')).toBeVisible()

    await page.getByTestId('draw-button').click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'summary', { timeout: 30_000 })
    const teams = page.getByTestId('stage').locator('ul > li.glass')
    await expect(teams).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      await expect(teams.nth(index)).toContainText(`ทีม ${index + 1}`)
      await expect(teams.nth(index)).toContainText('2 คน')
    }
    for (const name of FIRST_NAMES) await expect(page.getByTestId('stage').getByText(name as string, { exact: true })).toHaveCount(1)

    await page.getByRole('button', { name: 'คัดลอกรายชื่อทีม' }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('ทีม 1 (2 คน)')
    expect(copied).toContain('ทีม 3 (2 คน)')

    await page.getByRole('button', { name: 'เสร็จสิ้น' }).click()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'idle')
  })

  test('number random works without any classroom', async ({ page }) => {
    await openStudio(page)
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 40 / 40')
    await openPanel(page, 'กติกา')
    await page.getByRole('textbox', { name: 'ตัวเลขสุดท้าย' }).fill('5')
    await page.getByRole('textbox', { name: 'ตัวเลขสุดท้าย' }).press('Enter')
    await closePanel(page)
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 5')

    const drawn: number[] = []
    for (let turn = 0; turn < 5; turn += 1) {
      const value = Number(await drawWinner(page))
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(5)
      drawn.push(value)
      await closeReveal(page)
    }
    expect([...drawn].sort()).toEqual([1, 2, 3, 4, 5])
    await expect(page.getByText('สุ่มครบทุกคนแล้ว!')).toBeVisible()

    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(6)
    await expect(page.getByRole('row').nth(1)).toContainText(`หมายเลข ${drawn[4]}`)
  })
})

test.describe('safety', () => {
  test('a draw cannot be started twice while one is running', async ({ page }) => {
    await seedClassroom(page, 'ป.6/9', ROSTER)
    await openStudio(page)

    // A double click and a key press land in the same frame as the first click.
    await page.getByTestId('draw-button').dblclick()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('draw-button')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: /Mystery Slot/ })).toBeDisabled()
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'reveal', { timeout: 30_000 })
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 6')

    await page.goto('/history')
    await expect(page.getByRole('row')).toHaveCount(2)
  })

  test('keyboard: Space draws and Escape skips, then closes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hardware keyboard shortcuts')
    await seedClassroom(page, 'ป.6/10', ROSTER)
    await openStudio(page)

    await page.locator('body').press('Space')
    await expect(stagePhase(page)).not.toHaveAttribute('data-phase', 'idle')
    await page.keyboard.press('Escape')
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'reveal')
    await page.keyboard.press('Escape')
    await expect(stagePhase(page)).toHaveAttribute('data-phase', 'idle')
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 6')
  })

  test('"put back" returns a drawn student to the round', async ({ page }) => {
    await seedClassroom(page, 'ป.6/11', ROSTER.slice(0, 2))
    await openStudio(page)
    await drawWinner(page)
    await page.getByRole('button', { name: 'ใส่ชื่อกลับ' }).click()
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 2 / 2')
  })

  test('switching modes mid-round keeps the round', async ({ page }) => {
    await seedClassroom(page, 'ป.6/12', ROSTER)
    await openStudio(page)
    const first = await drawWinner(page)
    await closeReveal(page)
    await selectMode(page, 'slot')
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 5 / 6')
    const second = await drawWinner(page)
    expect(second).not.toBe(first)
  })
})

test.describe('from the classroom page', () => {
  test('draws only from the selected group', async ({ page }) => {
    await seedClassroom(page, 'ป.6/13', ROSTER)
    await page.getByRole('checkbox', { name: 'เลือก ชูใจ เลิศล้ำ' }).click()
    await page.getByRole('checkbox', { name: 'เลือก สมคิด คิดดี' }).click()
    await page.getByRole('button', { name: 'สุ่มเฉพาะกลุ่มนี้' }).click()

    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 2 / 2')
    const first = await drawWinner(page)
    await closeReveal(page)
    const second = await drawWinner(page)
    expect([first, second].sort()).toEqual(['ชูใจ', 'สมคิด'])
  })
})

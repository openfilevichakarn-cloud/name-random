import { expect, test, type Page } from '@playwright/test'

import {
  closeReveal,
  drawWinner,
  navigateTo,
  openStudio,
  seedClassroom,
  trackPageErrors,
  useTestSettings,
} from './helpers.ts'

const ROSTER = ['มานี มีตา', 'ปิติ พอใจ', 'ชูใจ เลิศล้ำ', 'วีระ ประสงค์สุข', 'สมคิด คิดดี', 'ดวงแก้ว ใจหวัง']

let pageErrors: string[] = []

test.beforeEach(({ page }) => {
  pageErrors = trackPageErrors(page)
})

test.afterEach(() => {
  expect(pageErrors, 'no console errors or uncaught exceptions').toEqual([])
})

function starControl(page: Page, name: string) {
  return page.getByTestId('winner-reveal').getByRole('group', { name: `ดาวของ ${name}` })
}

test.describe('Class Ranking', () => {
  test('stars from the winner screen rank the class, and the not-picked list feeds the studio', async ({ page }) => {
    await useTestSettings(page)
    await seedClassroom(page, 'ป.4/2', ROSTER.slice(0, 3))
    await openStudio(page)

    const winner = await drawWinner(page)
    const stars = starControl(page, winner)
    await stars.getByRole('button', { name: `ให้ดาว ${winner} 1 ดวง` }).click()
    await stars.getByRole('button', { name: `ให้ดาว ${winner} 1 ดวง` }).click()
    await expect(stars).toContainText('2 ดาว')
    await stars.getByRole('button', { name: `ลดดาวของ ${winner} 1 ดวง` }).click()
    await expect(stars).toContainText('1 ดาว')
    await stars.getByRole('button', { name: `ให้ดาว ${winner} 1 ดวง` }).click()
    await expect(stars).toContainText('2 ดาว')
    await closeReveal(page)

    await navigateTo(page, 'อันดับ')
    await expect(page.getByRole('heading', { level: 1, name: 'อันดับดาว' })).toBeVisible()
    const podium = page.getByTestId('podium')
    await expect(podium).toContainText(winner)
    await expect(podium.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByTestId('leaderboard')).toContainText('ถูกเลือก 1 ครั้ง')

    const notPicked = page.getByTestId('not-picked')
    await expect(notPicked.getByRole('listitem')).toHaveCount(2)
    await notPicked.getByRole('button', { name: 'สุ่มจาก 2 คนนี้' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByTestId('pool-count')).toHaveText('เหลือ 2 / 2')
    expect(await drawWinner(page)).not.toBe(winner)
  })

  test('winners of a multiple draw get stars on the summary', async ({ page }) => {
    await useTestSettings(page, { rules: { multipleCount: 2 } })
    await seedClassroom(page, 'ป.4/3', ROSTER.slice(0, 4))
    await openStudio(page)
    await page.getByRole('radio', { name: 'หลายคน' }).click()
    await page.getByTestId('draw-button').click()
    await page.getByRole('button', { name: 'ข้าม' }).click()

    const cards = page.getByTestId('summary-winner')
    await expect(cards).toHaveCount(2)
    await cards.first().getByRole('button', { name: /^ให้ดาว/ }).click()
    await expect(cards.first().getByTestId('star-control')).toContainText('1 ดาว')
    await expect(cards.last().getByTestId('star-control')).toContainText('0 ดาว')
    const label = (await cards.first().getByTestId('star-control').getAttribute('aria-label')) ?? ''
    const starred = label.replace(/^ดาวของ /, '')
    expect(starred).not.toBe('')

    await page.getByTestId('draw-summary').getByRole('button', { name: 'ปิด', exact: true }).click()
    await navigateTo(page, 'อันดับ')
    await expect(page.getByTestId('leaderboard').getByRole('listitem')).toHaveCount(1)
    await expect(page.getByTestId('leaderboard')).toContainText(starred)
  })
})

test.describe('winner extras', () => {
  test('Random Challenge, Surprise Reward and Lucky Streak are shown and saved to the history', async ({ page }) => {
    await useTestSettings(page, {
      rules: { repeatPolicy: 'allow-repeat' },
      features: {
        challenge: true,
        challenges: ['ภารกิจ ก', 'ภารกิจ ข'],
        reward: true,
        rewards: ['สติกเกอร์ดาว'],
        rewardChance: 1,
        streak: true,
      },
    })
    await seedClassroom(page, 'ห้องเดี่ยว', ['ต้นกล้า ใจดี'])
    await openStudio(page)

    await drawWinner(page)
    const reveal = page.getByTestId('winner-reveal')
    const mission = reveal.getByTestId('winner-challenge')
    const first = (await mission.innerText()).trim()
    expect(['ภารกิจ ก', 'ภารกิจ ข']).toContain(first)
    const other = first === 'ภารกิจ ก' ? 'ภารกิจ ข' : 'ภารกิจ ก'
    await reveal.getByRole('button', { name: 'สุ่มภารกิจใหม่' }).click()
    await expect(mission).toHaveText(other)
    await reveal.getByTestId('surprise-gift').click()
    await expect(reveal.getByTestId('winner-reward')).toHaveText('สติกเกอร์ดาว')
    await expect(reveal.getByTestId('streak-badge')).toHaveCount(0)
    await closeReveal(page)

    // Same student again on the same day.
    await drawWinner(page)
    await expect(page.getByTestId('streak-badge')).toContainText('Lucky Streak ×2')
    await closeReveal(page)

    await navigateTo(page, 'ประวัติ')
    const extras = page.getByTestId('result-extras')
    await expect(extras).toHaveCount(2)
    // Newest first: the second pick carries the streak; the first keeps the mission it was switched to.
    await expect(extras.first()).toContainText('Lucky Streak ×2')
    await expect(extras.last()).toContainText(other)
    await expect(extras.last()).toContainText('สติกเกอร์ดาว')
  })

  test('Quiz Mode: the answer timer runs out, and a correct answer earns a star', async ({ page }) => {
    // Real time on purpose: a fake clock that jumps ahead desynchronises the page's exit animations.
    test.slow()
    await useTestSettings(page, { features: { quiz: true, answerTimer: 10 } })
    await seedClassroom(page, 'ห้องควิซ', ROSTER.slice(0, 2))
    await openStudio(page)

    const winner = await drawWinner(page)
    const quiz = page.getByTestId('quiz-timer')
    const timer = quiz.getByRole('timer')
    await expect(timer).toHaveAccessibleName('เหลือเวลา 10 วินาที')
    await quiz.getByRole('button', { name: 'เริ่มจับเวลา' }).click()
    await expect(timer).toHaveAccessibleName(/เหลือเวลา [5-9] วินาที/, { timeout: 5_000 })
    // Pausing holds the time; resetting puts it back.
    await quiz.getByRole('button', { name: 'หยุดเวลา' }).click()
    const paused = await timer.getAttribute('aria-label')
    await page.waitForTimeout(1_200)
    await expect(timer).toHaveAttribute('aria-label', paused ?? '')
    await quiz.getByRole('button', { name: 'รีเซ็ตเวลา' }).click()
    await expect(timer).toHaveAccessibleName('เหลือเวลา 10 วินาที')
    await quiz.getByRole('button', { name: 'เริ่มจับเวลา' }).click()
    await expect(timer).toHaveAccessibleName('หมดเวลา', { timeout: 15_000 })
    await expect(quiz.getByText('หมดเวลา!')).toBeVisible()

    const correct = quiz.getByRole('button', { name: /ตอบถูก/ })
    await correct.click()
    await expect(correct).toHaveAttribute('aria-pressed', 'true')
    await expect(starControl(page, winner)).toContainText('1 ดาว')
    // Changing the answer takes the star back.
    await quiz.getByRole('button', { name: 'ตอบผิด' }).click()
    await expect(starControl(page, winner)).toContainText('0 ดาว')
    await correct.click()
    await expect(starControl(page, winner)).toContainText('1 ดาว')
    await closeReveal(page)

    await navigateTo(page, 'ประวัติ')
    await expect(page.getByTestId('result-extras')).toContainText('ตอบถูก')
  })
})

test.describe('Team Battle', () => {
  test('scores teams, picks who answers, and gives the winners stars', async ({ page }) => {
    await useTestSettings(page, { rules: { teamCount: 2, teamSplit: 'count' } })
    await seedClassroom(page, 'ห้องแข่ง', ROSTER)
    await openStudio(page)
    await page.getByRole('radio', { name: 'แบ่งทีม' }).click()
    await page.getByTestId('draw-button').click()
    await page.getByRole('button', { name: 'ข้าม' }).click()
    await page.getByRole('button', { name: 'เริ่ม Team Battle' }).click()
    await expect(page).toHaveURL(/\/battle$/)

    const score = (team: number) => page.getByTestId(`team-score-${team}`)
    await page.getByRole('button', { name: 'เพิ่ม 1 คะแนน ทีม 1' }).click()
    await page.getByRole('button', { name: 'เพิ่ม 1 คะแนน ทีม 1' }).click()
    await page.getByRole('button', { name: 'เพิ่ม 2 คะแนน ทีม 2' }).click()
    await expect(score(0)).toHaveText('2')
    await expect(score(1)).toHaveText('2')
    await expect(page.getByText('นำอยู่')).toHaveCount(0)
    await page.getByRole('button', { name: 'ย้อนกลับ' }).click()
    await expect(score(1)).toHaveText('0')
    await page.keyboard.press('Digit1')
    await expect(score(0)).toHaveText('3')
    await expect(page.getByTestId('team-card-0')).toContainText('นำอยู่')

    await page.getByRole('button', { name: 'สุ่มทีมตอบ' }).click()
    await expect(page.getByTestId('battle-pick')).toHaveText(/^ทีม [12] ได้ตอบ!$/)
    await page.getByTestId('team-card-0').getByRole('button', { name: 'สุ่มตัวแทนทีม' }).click()
    await expect(page.getByTestId('battle-pick')).toHaveText(/^ตัวแทนทีม 1: \S+/)

    // A reload in the middle of the game keeps the scores.
    await page.reload()
    await expect(score(0)).toHaveText('3')
    const members = (
      await page.getByRole('list', { name: 'สมาชิก ทีม 1' }).getByRole('listitem').allInnerTexts()
    ).map((name) => name.trim())
    expect(members).toHaveLength(3)

    await page.getByRole('button', { name: 'จบเกม' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'จบการแข่งขัน?' })
    await expect(dialog).toContainText('ทีม 1 ชนะ')
    await expect(dialog.getByRole('checkbox')).toBeChecked()
    await dialog.getByRole('button', { name: 'จบเกมและประกาศผล' }).click()
    const results = page.getByTestId('battle-results')
    await expect(results).toContainText('ทีม 1 ชนะ!')
    await expect(results).toContainText('ให้ดาวสมาชิกทีมที่ชนะแล้ว')
    await expect(page.getByRole('button', { name: 'เพิ่ม 1 คะแนน ทีม 1' })).toBeDisabled()

    await navigateTo(page, 'อันดับ')
    const leaderboard = page.getByTestId('leaderboard')
    await expect(leaderboard.getByRole('listitem')).toHaveCount(3)
    for (const member of members) await expect(leaderboard).toContainText(member)
    // A team split is not a pick: everyone is still waiting for a turn.
    await expect(page.getByTestId('not-picked').getByRole('listitem')).toHaveCount(ROSTER.length)

    await page.goto('/battle')
    await page.getByRole('button', { name: 'แข่งใหม่ด้วยทีมเดิม' }).click()
    await expect(score(0)).toHaveText('0')
    await page.getByRole('button', { name: 'ตัวเลือกการแข่งขัน' }).click()
    await page.getByRole('menuitem', { name: 'ปิดการแข่งขัน' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'ปิดการแข่งขัน' }).click()
    await expect(page.getByText('ยังไม่มีการแข่งขัน')).toBeVisible()
    await page.getByRole('button', { name: 'ไปแบ่งทีมในสตูดิโอ' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByTestId('draw-button')).toHaveText('แบ่งทีมเลย!')
  })
})

test.describe('Settings → Special Features', () => {
  test('edits the mission list and remembers it', async ({ page }) => {
    await useTestSettings(page)
    await page.goto('/settings?tab=features')

    const toggle = page.getByRole('switch', { name: 'สุ่มภารกิจ' })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect(page.getByRole('combobox', { name: 'เวลาตอบ' })).toBeDisabled()

    const list = page.getByRole('list', { name: 'รายการภารกิจ' })
    const presets = await list.getByRole('listitem').count()
    expect(presets).toBeGreaterThan(0)
    const input = page.getByLabel('เพิ่มภารกิจ')
    await input.fill('  แต่งกลอน   1 บท ')
    await input.press('Enter')
    await expect(list.getByRole('listitem')).toHaveCount(presets + 1)
    await expect(list).toContainText('แต่งกลอน 1 บท')
    await input.fill('แต่งกลอน 1 บท')
    await input.press('Enter')
    await expect(page.getByText('มีภารกิจนี้อยู่ในรายการแล้ว')).toBeVisible()
    await list.getByRole('button', { name: 'ลบ “ตอบคำถามข้อถัดไป”' }).click()
    await expect(list.getByRole('listitem')).toHaveCount(presets)

    await page.reload()
    await expect(page.getByRole('switch', { name: 'สุ่มภารกิจ' })).toBeChecked()
    await expect(list).toContainText('แต่งกลอน 1 บท')
    await expect(list).not.toContainText('ตอบคำถามข้อถัดไป')
    await page.getByRole('button', { name: 'ใช้ชุดตัวอย่าง' }).first().click()
    await expect(list).toContainText('ตอบคำถามข้อถัดไป')
    await expect(list.getByRole('listitem')).toHaveCount(presets)
  })
})
